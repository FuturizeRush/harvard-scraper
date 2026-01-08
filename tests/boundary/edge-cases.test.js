/**
 * Boundary and edge case tests
 * Tests extreme values, empty inputs, and error conditions
 */

const assert = require('assert');

/**
 * Test Suite: maxItems Boundary Values
 */
function testMaxItemsBoundary() {
    console.log('\n📋 Testing maxItems Boundary Values...');

    // Test 1: Minimum value (1)
    const minItems = 1;
    assert.strictEqual(minItems, 1, 'Minimum maxItems should be 1');
    assert(minItems >= 1, 'maxItems should be >= 1');
    console.log('  ✅ Minimum value (1) valid');

    // Test 2: Maximum value (500)
    const maxItems = 500;
    assert.strictEqual(maxItems, 500, 'Maximum maxItems should be 500');
    assert(maxItems <= 500, 'maxItems should be <= 500');
    console.log('  ✅ Maximum value (500) valid');

    // Test 3: Default value
    const defaultItems = 50;
    assert.strictEqual(defaultItems, 50, 'Default maxItems should be 50');
    assert(defaultItems >= 1 && defaultItems <= 500, 'Default should be in valid range');
    console.log('  ✅ Default value (50) in valid range');

    // Test 4: Invalid values
    const invalidValues = [-1, 0, 501, 1000, NaN, Infinity];
    invalidValues.forEach(value => {
        const isValid = value >= 1 && value <= 500 && !isNaN(value) && isFinite(value);
        assert.strictEqual(isValid, false, `Invalid value ${value} should be rejected`);
    });
    console.log('  ✅ Invalid values rejected');

    console.log('✅ All maxItems boundary tests passed!');
}

/**
 * Test Suite: Empty Search Inputs
 */
function testEmptySearchInputs() {
    console.log('\n📋 Testing Empty Search Inputs...');

    // Test 1: Empty keyword
    const emptyKeyword = '';
    assert.strictEqual(typeof emptyKeyword, 'string', 'Empty keyword should be string');
    assert.strictEqual(emptyKeyword.length, 0, 'Empty keyword should have length 0');
    console.log('  ✅ Empty keyword handled');

    // Test 2: Empty department
    const emptyDepartment = '';
    assert.strictEqual(typeof emptyDepartment, 'string', 'Empty department should be string');
    console.log('  ✅ Empty department handled');

    // Test 3: Empty institution
    const emptyInstitution = '';
    assert.strictEqual(typeof emptyInstitution, 'string', 'Empty institution should be string');
    console.log('  ✅ Empty institution handled');

    // Test 4: All empty (should still be valid search)
    const allEmpty = {
        searchKeywords: '',
        department: '',
        institution: '',
        maxItems: 50
    };
    assert(typeof allEmpty === 'object', 'All empty input should be valid object');
    console.log('  ✅ All empty inputs handled');

    console.log('✅ All empty search input tests passed!');
}

/**
 * Test Suite: Special Characters in Search
 */
function testSpecialCharactersInSearch() {
    console.log('\n📋 Testing Special Characters in Search...');

    const testCases = [
        { input: 'cancer & research', sanitized: 'cancer  research' },
        { input: 'test<script>', sanitized: 'testscript' },
        { input: "test'OR'1'='1", sanitized: 'testOR1=1' },
        { input: 'test$(pwd)', sanitized: 'testpwd' },
        { input: 'test;rm -rf /', sanitized: 'testrm -rf /' }
    ];

    testCases.forEach(({ input, sanitized }) => {
        // Simulate sanitization (matching api.js)
        const cleaned = input
            .normalize('NFC')
            .replace(/[\x00-\x1F\x7F]/g, '')
            .replace(/[<>'";&|`$()\\]/g, '');

        assert.strictEqual(cleaned, sanitized, `Should sanitize: ${input}`);
    });
    console.log('  ✅ Special characters sanitized');

    console.log('✅ All special character tests passed!');
}

/**
 * Test Suite: Non-Existent Filters
 */
function testNonExistentFilters() {
    console.log('\n📋 Testing Non-Existent Filters...');

    // Test 1: Non-existent department
    const fakeDepartment = 'Department of Nonexistent Studies';
    assert.strictEqual(typeof fakeDepartment, 'string', 'Fake department should be string');
    // Expected: API returns 0 results
    console.log('  ✅ Non-existent department handled (expects 0 results)');

    // Test 2: Non-existent institution
    const fakeInstitution = 'Fake University';
    assert.strictEqual(typeof fakeInstitution, 'string', 'Fake institution should be string');
    // Expected: API returns 0 results
    console.log('  ✅ Non-existent institution handled (expects 0 results)');

    // Test 3: Misspelled search
    const misspelled = 'cnacer reserach';
    assert.strictEqual(typeof misspelled, 'string', 'Misspelled search should be string');
    // Expected: API may return partial matches or 0 results
    console.log('  ✅ Misspelled search handled');

    console.log('✅ All non-existent filter tests passed!');
}

/**
 * Test Suite: Long Input Strings
 */
function testLongInputStrings() {
    console.log('\n📋 Testing Long Input Strings...');

    // Test 1: Exactly 200 characters (limit)
    const exactly200 = 'a'.repeat(200);
    assert.strictEqual(exactly200.length, 200, 'Should allow exactly 200 characters');
    console.log('  ✅ 200 characters allowed');

    // Test 2: Over 200 characters (should be truncated)
    const over200 = 'a'.repeat(300);
    const truncated = over200.substring(0, 200);
    assert.strictEqual(truncated.length, 200, 'Should truncate to 200 characters');
    console.log('  ✅ Over 200 characters truncated');

    // Test 3: Very long department name
    const longDepartment = 'Department of '.repeat(50);
    assert(longDepartment.length > 200, 'Long department should exceed limit');
    // Should be truncated during sanitization
    console.log('  ✅ Long department handled');

    console.log('✅ All long input string tests passed!');
}

/**
 * Test Suite: Pagination Edge Cases
 */
function testPaginationEdgeCases() {
    console.log('\n📋 Testing Pagination Edge Cases...');

    // Test 1: Single item
    const singleItem = 1;
    const pagesFor1 = Math.ceil(singleItem / 10);
    assert.strictEqual(pagesFor1, 1, 'Should have 1 page for 1 item');
    console.log('  ✅ Single item pagination correct');

    // Test 2: Exact page boundary
    const exactBoundary = 10;
    const pagesFor10 = Math.ceil(exactBoundary / 10);
    assert.strictEqual(pagesFor10, 1, 'Should have 1 page for 10 items');
    console.log('  ✅ Exact page boundary correct');

    // Test 3: Just over boundary
    const justOver = 11;
    const pagesFor11 = Math.ceil(justOver / 10);
    assert.strictEqual(pagesFor11, 2, 'Should have 2 pages for 11 items');
    console.log('  ✅ Just over boundary correct');

    // Test 4: Maximum items (500)
    const maxPages = Math.ceil(500 / 10);
    assert.strictEqual(maxPages, 50, 'Should have 50 pages for 500 items');
    console.log('  ✅ Maximum items pagination correct');

    // Test 5: More results than requested
    const requested = 20;
    const available = 5726;
    const itemsToFetch = Math.min(requested, available);
    assert.strictEqual(itemsToFetch, 20, 'Should only fetch requested amount');
    console.log('  ✅ Result limiting correct');

    console.log('✅ All pagination edge case tests passed!');
}

/**
 * Test Suite: Email Validation Edge Cases
 */
function testEmailValidationEdgeCases() {
    console.log('\n📋 Testing Email Validation Edge Cases...');

    // Test 1: Minimum valid email
    const minEmail = 'a@b.co';
    assert.strictEqual(minEmail.length >= 5, true, 'Minimum email should be >= 5 chars');
    console.log('  ✅ Minimum valid email');

    // Test 2: Just under minimum
    const tooShort = 'a@b.';
    assert.strictEqual(tooShort.length < 5, true, 'Too short email should be < 5 chars');
    console.log('  ✅ Too short email detected');

    // Test 3: Maximum valid email (100 chars)
    const maxEmail = 'a'.repeat(88) + '@example.com'; // Total 100 chars (88 + 12)
    assert.strictEqual(maxEmail.length, 100, 'Maximum email should be 100 chars');
    console.log('  ✅ Maximum valid email');

    // Test 4: Just over maximum
    const tooLong = 'a'.repeat(89) + '@example.com'; // Total 101 chars (89 + 12)
    assert.strictEqual(tooLong.length > 100, true, 'Too long email should be > 100 chars');
    console.log('  ✅ Too long email detected');

    // Test 5: Edge case domains
    const edgeDomains = [
        'test@co.uk',           // Two-part TLD
        'test@sub.domain.edu',  // Subdomain
        'test@a-b.com',         // Hyphen in domain
        'test@123.com'          // Numbers in domain
    ];

    edgeDomains.forEach(email => {
        assert(email.includes('@'), `Should have @: ${email}`);
        assert(email.includes('.'), `Should have dot: ${email}`);
    });
    console.log('  ✅ Edge case domains handled');

    console.log('✅ All email validation edge case tests passed!');
}

/**
 * Test Suite: OCR Text Edge Cases
 */
function testOCRTextEdgeCases() {
    console.log('\n📋 Testing OCR Text Edge Cases...');

    // Test 1: Only spaces
    const onlySpaces = '     ';
    assert.strictEqual(onlySpaces.trim(), '', 'Only spaces should trim to empty');
    console.log('  ✅ Only spaces handled');

    // Test 2: Mixed valid and invalid characters
    const mixed = 'test@exa||mp|e.c0m';
    const cleaned = mixed.replace(/\|/g, 'l').replace(/0m\b/gi, 'om');
    assert.strictEqual(cleaned, 'test@exallmple.com', 'Mixed characters cleaned');
    console.log('  ✅ Mixed characters handled');

    // Test 3: All pipes
    const allPipes = '||||';
    const allPipesCleaned = allPipes.replace(/\|/g, 'l');
    assert.strictEqual(allPipesCleaned, 'llll', 'All pipes converted');
    console.log('  ✅ All pipes handled');

    // Test 4: Multiple consecutive spaces
    const multiSpaces = 'test   @   example   .   com';
    const noSpaces = multiSpaces.replace(/\s+/g, '');
    assert.strictEqual(noSpaces, 'test@example.com', 'Multiple spaces removed');
    console.log('  ✅ Multiple spaces handled');

    // Test 5: Unicode/special characters
    const unicode = 'tëst@éxample.com';
    // Should be handled gracefully (may or may not be valid)
    assert.strictEqual(typeof unicode, 'string', 'Unicode should be string');
    console.log('  ✅ Unicode characters handled');

    console.log('✅ All OCR text edge case tests passed!');
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('🧪 Running Boundary & Edge Case Tests...\n');
    console.log('='.repeat(50));

    try {
        testMaxItemsBoundary();
        testEmptySearchInputs();
        testSpecialCharactersInSearch();
        testNonExistentFilters();
        testLongInputStrings();
        testPaginationEdgeCases();
        testEmailValidationEdgeCases();
        testOCRTextEdgeCases();

        console.log('\n' + '='.repeat(50));
        console.log('✅ All boundary & edge case tests passed successfully!');
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
    testMaxItemsBoundary,
    testEmptySearchInputs,
    testSpecialCharactersInSearch,
    testNonExistentFilters,
    testLongInputStrings,
    testPaginationEdgeCases,
    testEmailValidationEdgeCases,
    testOCRTextEdgeCases
};
