/**
 * Unit tests for StateManager
 * Tests checkpoint/resume functionality for large-scale scraping
 */

const { StateManager } = require('../../src/lib/state-manager.js');

// Mock Apify Actor module
const mockState = {};
const mockActor = {
    getValue: async (key) => mockState[key] || null,
    setValue: async (key, value) => {
        mockState[key] = value;
    }
};

// Test utilities
function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, but got ${actual}`);
    }
}

function assertDeepEqual(actual, expected, message) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
        throw new Error(message || `Expected ${expectedStr}, but got ${actualStr}`);
    }
}

// Test suite
async function runTests() {
    let passed = 0;
    let failed = 0;
    const searchParams = {
        searchKeywords: 'cancer research',
        department: '',
        institution: ''
    };

    console.log('\n🧪 Testing StateManager\n');

    // Helper to reset state
    function resetMockState() {
        Object.keys(mockState).forEach(key => delete mockState[key]);
    }

    // Test 1: Initialize new state
    try {
        resetMockState();
        const stateManager = new StateManager(mockActor);
        const isResumed = await stateManager.initialize(searchParams, 100);

        assertEqual(isResumed, false, 'Should not be resumed for new state');
        assertEqual(stateManager.state.totalRequested, 100, 'Total requested should be 100');
        assertEqual(stateManager.state.totalProcessed, 0, 'Total processed should be 0');
        assertEqual(stateManager.state.isResumed, false, 'isResumed should be false');
        assertDeepEqual(stateManager.state.searchParams, searchParams, 'Search params should match');

        console.log('  ✓ Initialize new state');
        passed++;
    } catch (error) {
        console.log(`  ✗ Initialize new state: ${error.message}`);
        failed++;
    }

    // Test 2: Resume from saved state
    try {
        resetMockState();
        mockState['SCRAPING_STATE'] = {
            processedPersonIds: [123, 456, 789],
            totalProcessed: 3,
            totalRequested: 100,
            searchParams: searchParams,
            startedAt: new Date().toISOString(),
            lastCheckpointAt: new Date().toISOString()
        };

        const stateManager = new StateManager(mockActor);
        const isResumed = await stateManager.initialize(searchParams, 100);

        assertEqual(isResumed, true, 'Should be resumed');
        assertEqual(stateManager.state.totalProcessed, 3, 'Total processed should be 3');
        assertEqual(stateManager.state.processedPersonIds.size, 3, 'Should have 3 processed IDs');
        assertEqual(stateManager.isProcessed(123), true, 'Should recognize processed ID');

        console.log('  ✓ Resume from saved state');
        passed++;
    } catch (error) {
        console.log(`  ✗ Resume from saved state: ${error.message}`);
        failed++;
    }

    // Test 3: Start fresh with different params
    try {
        resetMockState();
        mockState['SCRAPING_STATE'] = {
            processedPersonIds: [123, 456],
            totalProcessed: 2,
            totalRequested: 100,
            searchParams: {
                searchKeywords: 'different search',
                department: '',
                institution: ''
            },
            startedAt: new Date().toISOString()
        };

        const stateManager = new StateManager(mockActor);
        const isResumed = await stateManager.initialize(searchParams, 100);

        assertEqual(isResumed, false, 'Should not resume with different params');
        assertEqual(stateManager.state.totalProcessed, 0, 'Should start fresh');

        console.log('  ✓ Start fresh with different params');
        passed++;
    } catch (error) {
        console.log(`  ✗ Start fresh with different params: ${error.message}`);
        failed++;
    }

    // Test 4: Mark profiles as processed
    try {
        resetMockState();
        const stateManager = new StateManager(mockActor);
        await stateManager.initialize(searchParams, 100);

        stateManager.markProcessed(123);
        stateManager.markProcessed(456);
        stateManager.markProcessed(789);

        assertEqual(stateManager.state.totalProcessed, 3, 'Should have 3 processed');
        assertEqual(stateManager.isProcessed(123), true, 'ID 123 should be processed');
        assertEqual(stateManager.isProcessed(999), false, 'ID 999 should not be processed');

        console.log('  ✓ Mark profiles as processed');
        passed++;
    } catch (error) {
        console.log(`  ✗ Mark profiles as processed: ${error.message}`);
        failed++;
    }

    // Test 5: Checkpoint at 50 intervals
    try {
        resetMockState();
        const stateManager = new StateManager(mockActor);
        await stateManager.initialize(searchParams, 500);

        // Mark 49 profiles - should not checkpoint
        for (let i = 1; i <= 49; i++) {
            stateManager.markProcessed(i);
        }
        assertEqual(stateManager.shouldCheckpoint(), false, 'Should not checkpoint at 49');

        // Mark 50th profile - should checkpoint
        stateManager.markProcessed(50);
        assertEqual(stateManager.shouldCheckpoint(), true, 'Should checkpoint at 50');

        console.log('  ✓ Checkpoint at 50 intervals');
        passed++;
    } catch (error) {
        console.log(`  ✗ Checkpoint at 50 intervals: ${error.message}`);
        failed++;
    }

    // Test 6: Save checkpoint
    try {
        resetMockState();
        const stateManager = new StateManager(mockActor);
        await stateManager.initialize(searchParams, 200);

        for (let i = 1; i <= 50; i++) {
            stateManager.markProcessed(i);
        }

        await stateManager.saveCheckpoint();

        const saved = mockState['SCRAPING_STATE'];
        assert(saved !== null && saved !== undefined, 'State should be saved');
        assertEqual(saved.totalProcessed, 50, 'Saved total should be 50');
        assertEqual(saved.processedPersonIds.length, 50, 'Saved IDs should be 50');
        assert(saved.lastCheckpointAt !== null, 'Should have checkpoint timestamp');

        console.log('  ✓ Save checkpoint');
        passed++;
    } catch (error) {
        console.log(`  ✗ Save checkpoint: ${error.message}`);
        failed++;
    }

    // Test 7: Calculate remaining count
    try {
        resetMockState();
        const stateManager = new StateManager(mockActor);
        await stateManager.initialize(searchParams, 200);

        stateManager.markProcessed(1);
        stateManager.markProcessed(2);
        stateManager.markProcessed(3);

        assertEqual(stateManager.getRemainingCount(), 197, 'Remaining should be 197');

        console.log('  ✓ Calculate remaining count');
        passed++;
    } catch (error) {
        console.log(`  ✗ Calculate remaining count: ${error.message}`);
        failed++;
    }

    // Test 8: Get statistics
    try {
        resetMockState();
        const stateManager = new StateManager(mockActor);
        await stateManager.initialize(searchParams, 200);

        for (let i = 1; i <= 50; i++) {
            stateManager.markProcessed(i);
        }

        const stats = stateManager.getStats();

        assertEqual(stats.totalProcessed, 50, 'Stats total processed should be 50');
        assertEqual(stats.totalRequested, 200, 'Stats total requested should be 200');
        assertEqual(stats.remaining, 150, 'Stats remaining should be 150');
        assertEqual(stats.progressPercentage, 25, 'Progress should be 25%');
        assertEqual(stats.isResumed, false, 'Should not be resumed');

        console.log('  ✓ Get statistics');
        passed++;
    } catch (error) {
        console.log(`  ✗ Get statistics: ${error.message}`);
        failed++;
    }

    // Test 9: Progress percentage calculation
    try {
        resetMockState();
        const stateManager = new StateManager(mockActor);
        await stateManager.initialize(searchParams, 100);

        assertEqual(stateManager._getProgressPercentage(), 0, 'Should be 0% initially');

        for (let i = 1; i <= 25; i++) {
            stateManager.markProcessed(i);
        }
        assertEqual(stateManager._getProgressPercentage(), 25, 'Should be 25% after 25');

        for (let i = 26; i <= 50; i++) {
            stateManager.markProcessed(i);
        }
        assertEqual(stateManager._getProgressPercentage(), 50, 'Should be 50% after 50');

        console.log('  ✓ Progress percentage calculation');
        passed++;
    } catch (error) {
        console.log(`  ✗ Progress percentage calculation: ${error.message}`);
        failed++;
    }

    // Test 10: Finalize and clear state
    try {
        resetMockState();
        const stateManager = new StateManager(mockActor);
        await stateManager.initialize(searchParams, 100);

        stateManager.markProcessed(1);
        stateManager.markProcessed(2);

        await stateManager.finalize();

        assertEqual(mockState['SCRAPING_STATE'], null, 'State should be cleared');
        assertEqual(stateManager.state.totalProcessed, 0, 'Total processed should be reset');
        assertEqual(stateManager.state.processedPersonIds.size, 0, 'Processed IDs should be cleared');

        console.log('  ✓ Finalize and clear state');
        passed++;
    } catch (error) {
        console.log(`  ✗ Finalize and clear state: ${error.message}`);
        failed++;
    }

    // Test 11: Update totalRequested on resume
    try {
        resetMockState();
        mockState['SCRAPING_STATE'] = {
            processedPersonIds: [123],
            totalProcessed: 1,
            totalRequested: 50,
            searchParams: searchParams,
            startedAt: new Date().toISOString()
        };

        const stateManager = new StateManager(mockActor);
        const isResumed = await stateManager.initialize(searchParams, 200);

        assertEqual(isResumed, true, 'Should resume');
        assertEqual(stateManager.state.totalRequested, 200, 'Should update to 200');
        assertEqual(stateManager.state.totalProcessed, 1, 'Should keep processed count');

        console.log('  ✓ Update totalRequested on resume');
        passed++;
    } catch (error) {
        console.log(`  ✗ Update totalRequested on resume: ${error.message}`);
        failed++;
    }

    // Test 12: Handle large maxItems
    try {
        resetMockState();
        const stateManager = new StateManager(mockActor);
        await stateManager.initialize(searchParams, 30000);

        assertEqual(stateManager.state.totalRequested, 30000, 'Should handle 30000');

        console.log('  ✓ Handle large maxItems');
        passed++;
    } catch (error) {
        console.log(`  ✗ Handle large maxItems: ${error.message}`);
        failed++;
    }

    // Test 13: Complete workflow simulation
    try {
        resetMockState();

        // First run - process 50 profiles
        let stateManager = new StateManager(mockActor);
        await stateManager.initialize(searchParams, 200);

        for (let i = 1; i <= 50; i++) {
            stateManager.markProcessed(i);
        }
        await stateManager.saveCheckpoint();

        // Simulate interruption and restart
        stateManager = new StateManager(mockActor);
        const isResumed = await stateManager.initialize(searchParams, 200);

        assertEqual(isResumed, true, 'Should resume after interruption');
        assertEqual(stateManager.state.totalProcessed, 50, 'Should remember 50 processed');
        assertEqual(stateManager.getRemainingCount(), 150, 'Should have 150 remaining');

        // Continue processing
        for (let i = 51; i <= 100; i++) {
            stateManager.markProcessed(i);
        }

        assertEqual(stateManager.state.totalProcessed, 100, 'Should have 100 total');

        console.log('  ✓ Complete workflow simulation');
        passed++;
    } catch (error) {
        console.log(`  ✗ Complete workflow simulation: ${error.message}`);
        failed++;
    }

    // Summary
    console.log(`\n📊 StateManager Tests: ${passed} passed, ${failed} failed\n`);

    if (failed > 0) {
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    console.error('❌ Test execution error:', error);
    process.exit(1);
});
