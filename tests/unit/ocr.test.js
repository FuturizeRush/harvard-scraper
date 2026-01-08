/**
 * Unit tests for OCR module (src/lib/ocr.js)
 * Tests email extraction, text cleaning, and validation functions
 */

const assert = require('assert');
const { cleanOCRText, isValidEmail, isNotAvailable } = require('../../src/lib/ocr.js');

/**
 * Test Suite: cleanOCRText Function
 */
function testCleanOCRText() {
    console.log('\n📋 Testing cleanOCRText...');

    // Test 1: Remove spaces (critical fix for "pogara@bwh. harvard. edu")
    assert.strictEqual(
        cleanOCRText('pogara@bwh. harvard. edu'),
        'pogara@bwh.harvard.edu',
        'Should remove all spaces'
    );
    console.log('  ✅ Spaces removed correctly');

    // Test 2: Pipe character to lowercase L
    assert.strictEqual(
        cleanOCRText('emai|@example.com'),
        'email@example.com',
        'Should convert pipe to lowercase L'
    );
    console.log('  ✅ Pipe character converted');

    // Test 3: Domain ending with 0 -> org
    assert.strictEqual(
        cleanOCRText('test@example.0rg'),
        'test@example.org',
        'Should convert 0rg to org'
    );
    console.log('  ✅ Domain 0rg corrected');

    // Test 4: Domain ending with 0 -> om
    assert.strictEqual(
        cleanOCRText('test@example.c0m'),
        'test@example.com',
        'Should convert 0m to om'
    );
    console.log('  ✅ Domain 0m corrected');

    // Test 5: Lowercase conversion
    assert.strictEqual(
        cleanOCRText('John.Doe@EXAMPLE.COM'),
        'john.doe@example.com',
        'Should convert to lowercase'
    );
    console.log('  ✅ Lowercase conversion correct');

    // Test 6: Multiple spaces
    assert.strictEqual(
        cleanOCRText('test  @  example  .  com'),
        'test@example.com',
        'Should remove multiple spaces'
    );
    console.log('  ✅ Multiple spaces handled');

    // Test 7: Trim whitespace
    assert.strictEqual(
        cleanOCRText('  test@example.com  '),
        'test@example.com',
        'Should trim leading/trailing whitespace'
    );
    console.log('  ✅ Whitespace trimmed');

    // Test 8: Empty string
    assert.strictEqual(
        cleanOCRText(''),
        '',
        'Should handle empty string'
    );
    console.log('  ✅ Empty string handled');

    // Test 9: Null/undefined
    assert.strictEqual(
        cleanOCRText(null),
        '',
        'Should handle null'
    );
    console.log('  ✅ Null handled');

    // Test 10: Complex case
    assert.strictEqual(
        cleanOCRText('David.Mi||er2@chi|drens.harvard.0rg'),
        'david.miller2@childrens.harvard.org',
        'Should handle complex OCR errors'
    );
    console.log('  ✅ Complex case handled');

    console.log('✅ All cleanOCRText tests passed!');
}

/**
 * Test Suite: isValidEmail Function
 */
function testIsValidEmail() {
    console.log('\n📋 Testing isValidEmail...');

    // Test 1: Valid emails
    const validEmails = [
        'john.doe@example.com',
        'jane_smith@university.edu',
        'test+filter@domain.org',
        'user123@sub.domain.co.uk',
        'first.last@medical.harvard.edu'
    ];

    validEmails.forEach(email => {
        assert.strictEqual(
            isValidEmail(email),
            true,
            `Should accept valid email: ${email}`
        );
    });
    console.log('  ✅ Valid emails accepted');

    // Test 2: Invalid emails - no @
    assert.strictEqual(
        isValidEmail('notanemail.com'),
        false,
        'Should reject email without @'
    );
    console.log('  ✅ Emails without @ rejected');

    // Test 3: Invalid emails - no domain
    assert.strictEqual(
        isValidEmail('test@'),
        false,
        'Should reject email without domain'
    );
    console.log('  ✅ Emails without domain rejected');

    // Test 4: Invalid emails - no TLD
    assert.strictEqual(
        isValidEmail('test@domain'),
        false,
        'Should reject email without TLD'
    );
    console.log('  ✅ Emails without TLD rejected');

    // Test 5: Too short
    assert.strictEqual(
        isValidEmail('a@b.c'),
        false,
        'Should reject emails shorter than 5 characters'
    );
    console.log('  ✅ Too short emails rejected');

    // Test 6: Too long
    const longEmail = 'a'.repeat(90) + '@example.com';
    assert.strictEqual(
        isValidEmail(longEmail),
        false,
        'Should reject emails longer than 100 characters'
    );
    console.log('  ✅ Too long emails rejected');

    // Test 7: Empty string
    assert.strictEqual(
        isValidEmail(''),
        false,
        'Should reject empty string'
    );
    console.log('  ✅ Empty string rejected');

    // Test 8: Null/undefined
    assert.strictEqual(
        isValidEmail(null),
        false,
        'Should reject null'
    );
    assert.strictEqual(
        isValidEmail(undefined),
        false,
        'Should reject undefined'
    );
    console.log('  ✅ Null/undefined rejected');

    // Test 9: Special characters
    assert.strictEqual(
        isValidEmail('test@exam ple.com'),
        false,
        'Should reject emails with spaces'
    );
    console.log('  ✅ Emails with spaces rejected');

    // Test 10: Multiple @
    assert.strictEqual(
        isValidEmail('test@@example.com'),
        false,
        'Should reject emails with multiple @'
    );
    console.log('  ✅ Emails with multiple @ rejected');

    console.log('✅ All isValidEmail tests passed!');
}

/**
 * Test Suite: isNotAvailable Function
 */
function testIsNotAvailable() {
    console.log('\n📋 Testing isNotAvailable...');

    // Test 1: N/A variations
    const naVariations = [
        'N/A',
        'n/a',
        'NA',
        'na',
        'N/a',
        'n/A'
    ];

    naVariations.forEach(text => {
        assert.strictEqual(
            isNotAvailable(text),
            true,
            `Should detect N/A: ${text}`
        );
    });
    console.log('  ✅ N/A variations detected');

    // Test 2: "Not Available"
    assert.strictEqual(
        isNotAvailable('Not Available'),
        true,
        'Should detect "Not Available"'
    );
    assert.strictEqual(
        isNotAvailable('not available'),
        true,
        'Should detect "not available"'
    );
    assert.strictEqual(
        isNotAvailable('notavailable'),
        true,
        'Should detect "notavailable" (no space)'
    );
    console.log('  ✅ "Not Available" detected');

    // Test 3: "None"
    assert.strictEqual(
        isNotAvailable('None'),
        true,
        'Should detect "None"'
    );
    assert.strictEqual(
        isNotAvailable('none'),
        true,
        'Should detect "none"'
    );
    console.log('  ✅ "None" detected');

    // Test 4: Dashes
    assert.strictEqual(
        isNotAvailable('-'),
        true,
        'Should detect single dash'
    );
    assert.strictEqual(
        isNotAvailable('---'),
        true,
        'Should detect multiple dashes'
    );
    console.log('  ✅ Dashes detected');

    // Test 5: Valid text should not be detected as N/A
    const validTexts = [
        'john@example.com',
        'Available',
        'Contact me',
        'Email available',
        'NA123',  // Not just "NA"
        'National'
    ];

    validTexts.forEach(text => {
        assert.strictEqual(
            isNotAvailable(text),
            false,
            `Should not detect as N/A: ${text}`
        );
    });
    console.log('  ✅ Valid text not detected as N/A');

    // Test 6: Empty/null
    assert.strictEqual(
        isNotAvailable(''),
        false,
        'Should handle empty string'
    );
    assert.strictEqual(
        isNotAvailable(null),
        false,
        'Should handle null'
    );
    console.log('  ✅ Empty/null handled');

    // Test 7: Whitespace variations
    assert.strictEqual(
        isNotAvailable('  n/a  '),
        true,
        'Should detect N/A with whitespace'
    );
    assert.strictEqual(
        isNotAvailable('  not  available  '),
        true,
        'Should detect "not available" with extra spaces'
    );
    console.log('  ✅ Whitespace variations handled');

    console.log('✅ All isNotAvailable tests passed!');
}

/**
 * Test Suite: Email Extraction Integration
 */
function testEmailExtractionIntegration() {
    console.log('\n📋 Testing Email Extraction Integration...');

    // Simulate full OCR text processing flow
    const testCases = [
        {
            input: 'pogara@bwh. harvard. edu',
            expected: 'pogara@bwh.harvard.edu',
            description: 'Spaces in domain'
        },
        {
            input: 'David.Mi||er2@chi|drens.harvard.0rg',
            expected: 'david.miller2@childrens.harvard.org',
            description: 'Pipe characters and 0rg'
        },
        {
            input: '  john.doe@example.COM  ',
            expected: 'john.doe@example.com',
            description: 'Whitespace and uppercase'
        },
        {
            input: 'test@domain.c0m',
            expected: 'test@domain.com',
            description: '0m correction'
        }
    ];

    testCases.forEach(({ input, expected, description }) => {
        const cleaned = cleanOCRText(input);
        const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const match = cleaned.match(emailPattern);

        if (match) {
            const email = match[0].toLowerCase().trim();
            assert.strictEqual(email, expected, `Test case: ${description}`);
            assert.strictEqual(isValidEmail(email), true, `Should be valid: ${email}`);
        } else {
            assert.fail(`No email found in cleaned text: ${cleaned}`);
        }
    });
    console.log('  ✅ All integration test cases passed');

    console.log('✅ Email extraction integration tests passed!');
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('🧪 Running OCR Module Unit Tests...\n');
    console.log('='.repeat(50));

    try {
        testCleanOCRText();
        testIsValidEmail();
        testIsNotAvailable();
        testEmailExtractionIntegration();

        console.log('\n' + '='.repeat(50));
        console.log('✅ All OCR module tests passed successfully!');
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
    testCleanOCRText,
    testIsValidEmail,
    testIsNotAvailable,
    testEmailExtractionIntegration
};
