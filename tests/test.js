/**
 * Main test runner
 * Executes all test suites in the correct order
 */

const { execSync } = require('child_process');
const path = require('path');

/**
 * Run a test file and capture output
 */
function runTest(testPath, testName) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Running: ${testName}`);
    console.log('='.repeat(60));

    try {
        execSync(`node ${testPath}`, {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });
        console.log(`✅ ${testName} completed successfully\n`);
        return true;
    } catch (error) {
        console.error(`❌ ${testName} failed\n`);
        return false;
    }
}

/**
 * Main test execution
 */
async function main() {
    console.log('\n');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║' + ' '.repeat(58) + '║');
    console.log('║' + '   🧪 Harvard Catalyst Profiles Scraper - Test Suite   '.padEnd(58) + '║');
    console.log('║' + ' '.repeat(58) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
    console.log('\n');

    const startTime = Date.now();
    const results = {
        passed: [],
        failed: []
    };

    // Test suite configuration
    const tests = [
        {
            path: 'tests/unit/api.test.js',
            name: 'API Module Unit Tests'
        },
        {
            path: 'tests/unit/ocr.test.js',
            name: 'OCR Module Unit Tests'
        },
        {
            path: 'tests/unit/state-manager.test.js',
            name: 'State Manager Unit Tests'
        },
        {
            path: 'tests/boundary/edge-cases.test.js',
            name: 'Boundary & Edge Case Tests'
        }
    ];

    // Run all tests
    for (const test of tests) {
        const success = runTest(test.path, test.name);
        if (success) {
            results.passed.push(test.name);
        } else {
            results.failed.push(test.name);
        }
    }

    // Calculate duration
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Print summary
    console.log('\n');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║' + ' '.repeat(58) + '║');
    console.log('║' + '                    Test Summary                        '.padEnd(58) + '║');
    console.log('║' + ' '.repeat(58) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
    console.log('\n');

    console.log(`📊 Total Tests: ${tests.length}`);
    console.log(`✅ Passed: ${results.passed.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log('\n');

    if (results.passed.length > 0) {
        console.log('✅ Passed Tests:');
        results.passed.forEach(name => {
            console.log(`   • ${name}`);
        });
        console.log('');
    }

    if (results.failed.length > 0) {
        console.log('❌ Failed Tests:');
        results.failed.forEach(name => {
            console.log(`   • ${name}`);
        });
        console.log('');
    }

    // Exit with appropriate code
    if (results.failed.length > 0) {
        console.log('❌ Some tests failed. Please review the output above.\n');
        process.exit(1);
    } else {
        console.log('✅ All tests passed successfully!\n');
        process.exit(0);
    }
}

// Run main
main().catch(error => {
    console.error('❌ Test runner error:', error);
    process.exit(1);
});
