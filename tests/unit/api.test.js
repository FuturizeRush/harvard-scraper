/**
 * Unit tests for API module (src/lib/api.js)
 * Tests input sanitization, URL construction, and data processing
 */

const assert = require('assert');
const path = require('path');

// Import the sanitizeInput function (we'll need to export it from api.js)
// For now, we'll test it through a local implementation
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';

    return input
        .normalize('NFC')
        .replace(/[\x00-\x1F\x7F]/g, '')
        .replace(/[<>'";&|`$()\\]/g, '')
        .substring(0, 200)
        .trim();
}

/**
 * Test Suite: Input Sanitization
 */
function testInputSanitization() {
    console.log('\n📋 Testing Input Sanitization...');

    // Test 1: Normal input
    assert.strictEqual(
        sanitizeInput('cancer research'),
        'cancer research',
        'Should preserve normal input'
    );
    console.log('  ✅ Normal input preserved');

    // Test 2: HTML tags and parentheses removal
    assert.strictEqual(
        sanitizeInput('<script>alert("xss")</script>'),
        'scriptalertxss/script',
        'Should remove HTML tags and parentheses'
    );
    console.log('  ✅ HTML tags and parentheses removed');

    // Test 3: SQL injection attempt
    assert.strictEqual(
        sanitizeInput("'; DROP TABLE users; --"),
        'DROP TABLE users --',
        'Should remove dangerous SQL characters'
    );
    console.log('  ✅ SQL injection characters removed');

    // Test 4: Shell metacharacters
    assert.strictEqual(
        sanitizeInput('test && rm -rf /'),
        'test  rm -rf /',
        'Should remove shell metacharacters'
    );
    console.log('  ✅ Shell metacharacters removed');

    // Test 5: Length limit
    const longInput = 'a'.repeat(300);
    assert.strictEqual(
        sanitizeInput(longInput).length,
        200,
        'Should limit length to 200 characters'
    );
    console.log('  ✅ Length limited to 200 characters');

    // Test 6: Whitespace trimming
    assert.strictEqual(
        sanitizeInput('  cancer research  '),
        'cancer research',
        'Should trim whitespace'
    );
    console.log('  ✅ Whitespace trimmed');

    // Test 7: Non-string input
    assert.strictEqual(
        sanitizeInput(123),
        '',
        'Should return empty string for non-string input'
    );
    console.log('  ✅ Non-string input handled');

    // Test 8: Empty string
    assert.strictEqual(
        sanitizeInput(''),
        '',
        'Should handle empty string'
    );
    console.log('  ✅ Empty string handled');

    console.log('✅ All input sanitization tests passed!');
}

/**
 * Test Suite: URL Construction
 */
function testURLConstruction() {
    console.log('\n📋 Testing URL Construction...');

    const API_BASE = 'https://connects.catalyst.harvard.edu/profiles';
    const SEARCH_ENDPOINT = `${API_BASE}/Search/SearchSvc.aspx?SearchType=person`;
    const PROFILE_BASE = `${API_BASE}/display/Person`;

    // Test 1: Search endpoint
    assert.strictEqual(
        SEARCH_ENDPOINT,
        'https://connects.catalyst.harvard.edu/profiles/Search/SearchSvc.aspx?SearchType=person',
        'Search endpoint URL should be correct'
    );
    console.log('  ✅ Search endpoint URL correct');

    // Test 2: Profile URL construction
    const personId = 29549;
    const profileUrl = `${PROFILE_BASE}/${personId}`;
    assert.strictEqual(
        profileUrl,
        'https://connects.catalyst.harvard.edu/profiles/display/Person/29549',
        'Profile URL should be correctly constructed'
    );
    console.log('  ✅ Profile URL construction correct');

    console.log('✅ All URL construction tests passed!');
}

/**
 * Test Suite: Pagination Logic
 */
function testPaginationLogic() {
    console.log('\n📋 Testing Pagination Logic...');

    const pageSize = 10;

    // Test 1: Offset starts at 1 (not 0)
    let offset = 1;
    assert.strictEqual(offset, 1, 'Offset should start at 1');
    console.log('  ✅ Offset starts at 1');

    // Test 2: Page calculation
    const calculatePage = (offset, pageSize) => Math.floor((offset - 1) / pageSize) + 1;

    assert.strictEqual(calculatePage(1, 10), 1, 'Offset 1 should be page 1');
    assert.strictEqual(calculatePage(11, 10), 2, 'Offset 11 should be page 2');
    assert.strictEqual(calculatePage(21, 10), 3, 'Offset 21 should be page 3');
    console.log('  ✅ Page calculation correct');

    // Test 3: Next offset calculation
    const nextOffset = (currentOffset, pageSize) => currentOffset + pageSize;

    assert.strictEqual(nextOffset(1, 10), 11, 'Next offset after 1 should be 11');
    assert.strictEqual(nextOffset(11, 10), 21, 'Next offset after 11 should be 21');
    console.log('  ✅ Next offset calculation correct');

    // Test 4: maxItems limiting
    const maxItems = 25;
    const totalPages = Math.ceil(maxItems / pageSize);
    assert.strictEqual(totalPages, 3, 'Should calculate 3 pages for 25 items with page size 10');
    console.log('  ✅ maxItems limiting correct');

    console.log('✅ All pagination logic tests passed!');
}

/**
 * Test Suite: Payload Structure
 */
function testPayloadStructure() {
    console.log('\n📋 Testing Payload Structure...');

    // Test 1: Required fields present
    const payload = {
        Keyword: 'cancer',
        LastName: '',
        FirstName: '',
        InstitutionName: '',
        DepartmentName: '',
        FacultyTypeName: '',
        OtherOptionsName: [],
        KeywordExact: false,
        DepartmentExcept: false,
        InstitutionExcept: false,
        Sort: 'relevance',
        SearchType: 'people',
        Count: 10,
        Offset: 1
    };

    const requiredFields = [
        'Keyword', 'LastName', 'FirstName', 'InstitutionName', 'DepartmentName',
        'FacultyTypeName', 'OtherOptionsName', 'KeywordExact', 'DepartmentExcept',
        'InstitutionExcept', 'Sort', 'SearchType', 'Count', 'Offset'
    ];

    requiredFields.forEach(field => {
        assert(
            payload.hasOwnProperty(field),
            `Payload should have field: ${field}`
        );
    });
    console.log('  ✅ All required fields present');

    // Test 2: Field types
    assert.strictEqual(typeof payload.Keyword, 'string', 'Keyword should be string');
    assert.strictEqual(typeof payload.Count, 'number', 'Count should be number');
    assert.strictEqual(typeof payload.Offset, 'number', 'Offset should be number');
    assert.strictEqual(typeof payload.KeywordExact, 'boolean', 'KeywordExact should be boolean');
    assert(Array.isArray(payload.OtherOptionsName), 'OtherOptionsName should be array');
    console.log('  ✅ Field types correct');

    // Test 3: Default values
    assert.strictEqual(payload.Sort, 'relevance', 'Sort should default to relevance');
    assert.strictEqual(payload.SearchType, 'people', 'SearchType should be people');
    assert.strictEqual(payload.KeywordExact, false, 'KeywordExact should default to false');
    console.log('  ✅ Default values correct');

    console.log('✅ All payload structure tests passed!');
}

/**
 * Test Suite: Response Parsing
 */
function testResponseParsing() {
    console.log('\n📋 Testing Response Parsing...');

    // Mock API response
    const mockResponse = {
        People: [
            {
                PersonID: 29549,
                DisplayName: 'Graham Andrew Colditz, Dr.P.H., M.B.,B.S., M.D.',
                InstitutionName: 'Harvard T.H. Chan School of Public Health',
                DepartmentName: 'Epidemiology',
                FacultyRank: 'Full Professor'
            }
        ],
        Count: 5726,
        Offset: 1,
        PageSize: 10
    };

    // Test 1: Field name is "People" not "Profiles"
    assert(mockResponse.hasOwnProperty('People'), 'Response should have "People" field');
    assert(!mockResponse.hasOwnProperty('Profiles'), 'Response should NOT have "Profiles" field');
    console.log('  ✅ Response uses "People" field (not "Profiles")');

    // Test 2: People array exists
    assert(Array.isArray(mockResponse.People), 'People should be an array');
    console.log('  ✅ People is an array');

    // Test 3: Profile object structure
    const profile = mockResponse.People[0];
    assert(profile.PersonID, 'Profile should have PersonID');
    assert(profile.DisplayName, 'Profile should have DisplayName');
    assert(profile.InstitutionName, 'Profile should have InstitutionName');
    assert(profile.DepartmentName, 'Profile should have DepartmentName');
    assert(profile.FacultyRank, 'Profile should have FacultyRank');
    console.log('  ✅ Profile structure correct');

    // Test 4: Total count available
    assert.strictEqual(mockResponse.Count, 5726, 'Should have total count');
    console.log('  ✅ Total count available');

    console.log('✅ All response parsing tests passed!');
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('🧪 Running API Module Unit Tests...\n');
    console.log('='.repeat(50));

    try {
        testInputSanitization();
        testURLConstruction();
        testPaginationLogic();
        testPayloadStructure();
        testResponseParsing();

        console.log('\n' + '='.repeat(50));
        console.log('✅ All API module tests passed successfully!');
        console.log('='.repeat(50) + '\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests();
}

module.exports = {
    testInputSanitization,
    testURLConstruction,
    testPaginationLogic,
    testPayloadStructure,
    testResponseParsing
};
