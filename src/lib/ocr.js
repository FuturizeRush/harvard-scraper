/**
 * OCR module for extracting email from images
 * Uses Tesseract.js for optical character recognition
 */

const Tesseract = require('tesseract.js');

/**
 * Perform OCR on an email image URL
 * @param {string} imageUrl - URL of the email image
 * @returns {Promise<string|null>} Extracted email address or null
 */
async function performOCR(imageUrl) {
    if (!imageUrl) return null;

    let worker;
    try {
        // Fetch the image with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(imageUrl, {
            signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));

        if (!response.ok) {
            return null;
        }

        const imageBuffer = await response.arrayBuffer();

        // Validate image buffer
        if (!imageBuffer || imageBuffer.byteLength === 0) {
            return null;
        }

        // Check minimum size (at least 100 bytes for a valid image)
        if (imageBuffer.byteLength < 100) {
            return null;
        }

        // Create and initialize Tesseract worker with error handler
        worker = await Tesseract.createWorker('eng', 1, {
            logger: () => {}, // Silent logger to reduce noise
            errorHandler: (err) => {
                // Suppress errors - will be caught in try/catch
            }
        });

        // Wrap recognize in a Promise with timeout to catch async errors
        const recognizeWithTimeout = () => {
            return Promise.race([
                worker.recognize(Buffer.from(imageBuffer)),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('OCR timeout')), 15000)
                )
            ]);
        };

        // Perform OCR with Tesseract.js
        const { data: { text } } = await recognizeWithTimeout();

        // Check if the image contains N/A or similar indicators
        if (isNotAvailable(text)) {
            return null;
        }

        // Clean the OCR text to handle common issues (spaces, character confusion)
        const cleanedText = cleanOCRText(text);

        // Try to extract email from cleaned text
        const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const match = cleanedText.match(emailPattern);

        if (match) {
            const email = match[0].toLowerCase().trim();

            // Validate the extracted email
            if (isValidEmail(email)) {
                return email;
            } else {
                return null;
            }
        }

        return null;

    } catch (error) {
        // Silently catch all errors including async ones
        return null;
    } finally {
        // Always terminate the worker to free resources
        if (worker) {
            try {
                await worker.terminate();
            } catch (terminateError) {
                // Silently ignore termination errors
            }
        }
    }
}

/**
 * Clean OCR text to improve email extraction
 * Handles common OCR issues like extra spaces and character confusion
 * Uses context-aware replacements to avoid over-correction
 * @param {string} text - Raw OCR text
 * @returns {string} Cleaned text
 */
function cleanOCRText(text) {
    if (!text) return '';

    // Step 1: Remove all whitespace (critical for "pogara@bwh. harvard. edu")
    let cleaned = text.replace(/\s+/g, '');

    // Step 2: Context-aware character corrections
    // Only fix obvious OCR errors in domain/username parts

    // Fix standalone pipe characters that should be lowercase L
    cleaned = cleaned.replace(/\|/g, 'l');

    // Fix zero that appears at the end of domain parts (e.g., "0rg" → "org")
    cleaned = cleaned.replace(/0rg\b/gi, 'org');
    cleaned = cleaned.replace(/0m\b/gi, 'om');

    // Step 3: Lowercase for consistency
    cleaned = cleaned.toLowerCase();

    return cleaned.trim();
}

/**
 * Check if text represents N/A or missing email
 * @param {string} text - Text to check
 * @returns {boolean} True if text indicates N/A
 */
function isNotAvailable(text) {
    if (!text) return false;

    const naPatterns = [
        /^n\/?a$/i,           // N/A, n/a
        /^not\s*available$/i, // Not Available
        /^none$/i,            // None
        /^-+$/,               // ---
        /^na$/i               // NA
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

    // Check minimum length
    if (email.length < 5 || email.length > 100) return false;

    // Basic structure check
    if (!email.includes('@') || !email.includes('.')) return false;

    // Regex validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

module.exports = {
    performOCR,
    isValidEmail,
    cleanOCRText,
    isNotAvailable
};
