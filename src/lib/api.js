/**
 * API integration for Harvard Catalyst Profiles
 */

const API_BASE = 'https://connects.catalyst.harvard.edu/profiles';
const SEARCH_ENDPOINT = `${API_BASE}/Search/SearchSvc.aspx?SearchType=person`;
const PROFILE_BASE = `${API_BASE}/display/Person`;

/**
 * Sanitize user input to prevent injection attacks
 * @param {string} input - User input string
 * @returns {string} Sanitized string
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';

    // Remove potentially dangerous characters and normalize
    return input
        .normalize('NFC')                   // Unicode normalization
        .replace(/[\x00-\x1F\x7F]/g, '')   // Control characters and DEL
        .replace(/[<>'";&|`$()\\]/g, '')   // HTML, SQL, shell metacharacters
        .substring(0, 200)                  // Limit length
        .trim();
}

/**
 * Search profiles via API
 * @param {Object} params - Search parameters
 * @returns {Array} Array of profile objects
 */
async function searchProfiles({ keyword, department, institution, maxItems }) {
    const profiles = [];
    const pageSize = 10; // API default
    let offset = 1;
    let totalAvailable = null;
    let emptyPagesCount = 0;
    const MAX_EMPTY_PAGES = 5; // Stop after 5 consecutive empty pages

    // Sanitize all user inputs
    const safeKeyword = sanitizeInput(keyword || '');
    const safeDepartment = sanitizeInput(department || '');
    const safeInstitution = sanitizeInput(institution || '');

    console.log(`🔎 Searching for researchers...`);

    while (profiles.length < maxItems) {
        try {
            // Build request payload - MUST include all fields
            const payload = {
                Keyword: safeKeyword,
                LastName: '',
                FirstName: '',
                InstitutionName: safeInstitution,
                DepartmentName: safeDepartment,
                FacultyTypeName: '',
                OtherOptionsName: [],
                KeywordExact: false,
                DepartmentExcept: false,
                InstitutionExcept: false,
                Sort: 'relevance',
                SearchType: 'people',
                Count: pageSize,
                Offset: offset
            };

            // Make API request with retry logic
            const data = await withRetry(async () => {
                const response = await fetch(SEARCH_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'User-Agent': 'Mozilla/5.0'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
                }

                return await response.json();
            });

            // Track total available from first response
            if (totalAvailable === null && data.Count) {
                totalAvailable = data.Count;
                console.log(`📊 Total available researchers: ${totalAvailable}`);
            }

            // Check response - field is "People" not "Profiles"!
            if (!data.People || !Array.isArray(data.People) || data.People.length === 0) {
                emptyPagesCount++;
                console.log(`⏭️  Empty page at offset ${offset} (${emptyPagesCount}/${MAX_EMPTY_PAGES})`);

                // If we've hit too many consecutive empty pages, stop
                if (emptyPagesCount >= MAX_EMPTY_PAGES) {
                    console.log(`ℹ️  Search complete. Total collected: ${profiles.length}`);
                    break;
                }

                // If we know the total and we've passed it, stop
                if (totalAvailable !== null && offset > totalAvailable) {
                    console.log(`ℹ️  Reached end of results. Total collected: ${profiles.length}`);
                    break;
                }

                // Skip this empty page and try next offset
                offset += pageSize;
                await new Promise(resolve => setTimeout(resolve, 200));
                continue;
            }

            // Reset empty pages counter on successful page
            emptyPagesCount = 0;

            console.log(`📊 Progress: Found ${profiles.length + data.People.length} / ${totalAvailable || '?'} researchers`);

            // Process profiles
            for (const item of data.People) {
                if (profiles.length >= maxItems) break;

                const profile = {
                    displayName: item.DisplayName || '',
                    personId: item.PersonID || '',
                    institutionName: item.InstitutionName || '',
                    departmentName: item.DepartmentName || '',
                    facultyRank: item.FacultyRank || '',
                    profileUrl: `${PROFILE_BASE}/${item.PersonID}`
                };

                profiles.push(profile);
            }

            // Check if we've reached maxItems
            if (profiles.length >= maxItems) {
                console.log(`✅ Reached requested maximum: ${profiles.length} profiles`);
                break;
            }

            offset += pageSize;

            // Rate limiting (reduced for faster collection)
            await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
            console.error(`⚠️  Search temporarily unavailable: ${error.message}`);
            break;
        }
    }

    console.log(`\n✅ Search completed: ${profiles.length} profiles collected`);
    return profiles.slice(0, maxItems);
}

/**
 * Exponential backoff for network retries
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {*} Function result
 */
async function withRetry(fn, maxRetries = 3) {
    let lastError;
    const delays = [1000, 2000, 4000]; // 1s, 2s, 4s

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                console.log(`🔄 Reconnecting... (attempt ${i + 1} of ${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delays[i]));
            }
        }
    }

    throw lastError;
}

module.exports = {
    searchProfiles
};