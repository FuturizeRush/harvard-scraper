/**
 * OCR module for extracting email from images
 * Uses Tesseract.js with worker pool for memory efficiency
 *
 * OPTIMIZATION: Single shared worker to avoid memory leaks from
 * repeated worker creation/destruction in large-scale scraping
 */

const Tesseract = require('tesseract.js');

// Singleton worker instance
let sharedWorker = null;
let workerUsageCount = 0;
const MAX_WORKER_USAGE = 100; // Recreate worker after 100 uses to prevent memory buildup

/**
 * Get or create shared Tesseract worker
 * @returns {Promise<Tesseract.Worker>} Tesseract worker instance
 */
async function getWorker() {
    // Recreate worker if it's been used too many times
    if (sharedWorker && workerUsageCount >= MAX_WORKER_USAGE) {
        try {
            await sharedWorker.terminate();
        } catch (e) {
            // Ignore termination errors
        }
        sharedWorker = null;
        workerUsageCount = 0;
    }

    if (!sharedWorker) {
        sharedWorker = await Tesseract.createWorker('eng', 1, {
            logger: () => {}, // Silent logger
            errorHandler: () => {} // Suppress errors
        });
    }

    return sharedWorker;
}

/**
 * Terminate the shared worker (call at end of scraping)
 */
async function terminateWorker() {
    if (sharedWorker) {
        try {
            await sharedWorker.terminate();
        } catch (e) {
            // Ignore
        }
        sharedWorker = null;
        workerUsageCount = 0;
    }
}

/**
 * Perform OCR on an email image URL
 * @param {string} imageUrl - URL of the email image
 * @returns {Promise<string|null>} Extracted email address or null
 */
async function performOCR(imageUrl) {
    if (!imageUrl) return null;

    try {
        // Fetch the image with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(imageUrl, {
            signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));

        if (!response.ok) {
            return null;
        }

        const imageBuffer = await response.arrayBuffer();

        // Validate image buffer
        if (!imageBuffer || imageBuffer.byteLength < 100) {
            return null;
        }

        // Use shared worker
        const worker = await getWorker();
        workerUsageCount++;

        // Wrap recognize in a Promise with timeout
        const recognizeWithTimeout = () => {
            return Promise.race([
                worker.recognize(Buffer.from(imageBuffer)),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('OCR timeout')), 15000)
                )
            ]);
        };

        const { data: { text } } = await recognizeWithTimeout();

        // Check if the image contains N/A or similar indicators
        if (isNotAvailable(text)) {
            return null;
        }

        // Clean the OCR text
        const cleanedText = cleanOCRText(text);

        // Try to extract email
        const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const match = cleanedText.match(emailPattern);

        if (match) {
            const email = match[0].toLowerCase().trim();
            if (isValidEmail(email)) {
                return email;
            }
        }

        return null;

    } catch (error) {
        return null;
    }
}

/**
 * Clean OCR text to improve email extraction
 * @param {string} text - Raw OCR text
 * @returns {string} Cleaned text
 */
function cleanOCRText(text) {
    if (!text) return '';

    // Remove all whitespace
    let cleaned = text.replace(/\s+/g, '');

    // Context-aware character corrections
    cleaned = cleaned.replace(/\|/g, 'l');
    cleaned = cleaned.replace(/0rg\b/gi, 'org');
    cleaned = cleaned.replace(/0m\b/gi, 'om');

    return cleaned.toLowerCase().trim();
}

/**
 * Check if text represents N/A or missing email
 * @param {string} text - Text to check
 * @returns {boolean} True if text indicates N/A
 */
function isNotAvailable(text) {
    if (!text) return false;

    const naPatterns = [
        /^n\/?a$/i,
        /^not\s*available$/i,
        /^none$/i,
        /^-+$/,
        /^na$/i
    ];

    const cleaned = text.trim().toLowerCase();
    return naPatterns.some(pattern => pattern.test(cleaned));
}

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email
 */
function isValidEmail(email) {
    if (!email) return false;
    if (email.length < 5 || email.length > 100) return false;
    if (!email.includes('@') || !email.includes('.')) return false;

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

module.exports = {
    performOCR,
    terminateWorker,
    isValidEmail,
    cleanOCRText,
    isNotAvailable
};
