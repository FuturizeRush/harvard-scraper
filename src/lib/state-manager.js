/**
 * State Manager for resumable large-scale scraping
 * Uses Apify Key-Value Store to persist progress
 */

const { Actor: DefaultActor } = require('apify');

const STATE_KEY = 'SCRAPING_STATE';
const CHECKPOINT_INTERVAL = 50; // Save state every 50 profiles

class StateManager {
    constructor(Actor = null) {
        this.Actor = Actor || DefaultActor;
        this.state = {
            processedPersonIds: new Set(),
            totalProcessed: 0,
            totalRequested: 0,
            startedAt: null,
            lastCheckpointAt: null,
            searchParams: null,
            isResumed: false
        };
    }

    /**
     * Initialize state (always start fresh)
     */
    async initialize(searchParams, maxItems) {
        console.log('🔄 Initializing state manager...');

        // Always clear any existing state to ensure independent runs
        await this._clearState();

        // Initialize new state
        this.state.startedAt = new Date().toISOString();
        this.state.searchParams = searchParams;
        this.state.totalRequested = maxItems;

        console.log('🆕 Starting new scraping session');
        return false; // Always indicates new run
    }

    /**
     * Check if we can resume from saved state
     */
    _canResume(savedState, currentParams) {
        if (!savedState || !savedState.searchParams) return false;

        const saved = savedState.searchParams;
        return (
            saved.searchKeywords === currentParams.searchKeywords &&
            saved.department === currentParams.department &&
            saved.institution === currentParams.institution
        );
    }

    /**
     * Mark a profile as processed
     */
    markProcessed(personId) {
        this.state.processedPersonIds.add(personId);
        this.state.totalProcessed++;
    }

    /**
     * Check if a profile has been processed
     */
    isProcessed(personId) {
        return this.state.processedPersonIds.has(personId);
    }

    /**
     * Get remaining count
     */
    getRemainingCount() {
        return this.state.totalRequested - this.state.totalProcessed;
    }

    /**
     * Check if we need to save checkpoint
     */
    shouldCheckpoint() {
        return this.state.totalProcessed % CHECKPOINT_INTERVAL === 0;
    }

    /**
     * Save current state to KV store and report dataset status
     */
    async saveCheckpoint() {
        this.state.lastCheckpointAt = new Date().toISOString();

        const stateToSave = {
            ...this.state,
            processedPersonIds: Array.from(this.state.processedPersonIds)
        };

        await this.Actor.setValue(STATE_KEY, stateToSave);

        const elapsed = this._getElapsedTime();
        const remaining = this.getRemainingCount();
        const rate = this.state.totalProcessed / (elapsed / 60); // profiles per minute
        const estimatedRemaining = remaining / rate; // minutes

        // Get dataset info to confirm data is saved
        const dataset = await this.Actor.openDataset();
        const datasetInfo = await dataset.getInfo();

        console.log('💾 Checkpoint saved');
        console.log(`   Progress: ${this.state.totalProcessed}/${this.state.totalRequested} (${this._getProgressPercentage()}%)`);
        console.log(`   ✅ Dataset items: ${datasetInfo.itemCount} profiles saved`);
        console.log(`   Rate: ${rate.toFixed(1)} profiles/min`);
        console.log(`   Estimated time remaining: ${Math.round(estimatedRemaining)} minutes`);
    }

    /**
     * Clear state (start fresh)
     */
    async _clearState() {
        await this.Actor.setValue(STATE_KEY, null);
        this.state = {
            processedPersonIds: new Set(),
            totalProcessed: 0,
            totalRequested: 0,
            startedAt: null,
            lastCheckpointAt: null,
            searchParams: null,
            isResumed: false
        };
    }

    /**
     * Finalize and clear state
     */
    async finalize() {
        console.log('✅ Scraping completed - clearing state');
        await this._clearState();
    }

    /**
     * Get progress percentage
     */
    _getProgressPercentage() {
        if (this.state.totalRequested === 0) return 0;
        return Math.round((this.state.totalProcessed / this.state.totalRequested) * 100);
    }

    /**
     * Get elapsed time in seconds
     */
    _getElapsedTime() {
        if (!this.state.startedAt) return 0;
        return (new Date() - new Date(this.state.startedAt)) / 1000;
    }

    /**
     * Get statistics
     */
    getStats() {
        const elapsed = this._getElapsedTime();
        const remaining = this.getRemainingCount();
        const rate = this.state.totalProcessed / (elapsed / 60); // profiles per minute

        return {
            totalProcessed: this.state.totalProcessed,
            totalRequested: this.state.totalRequested,
            remaining: remaining,
            progressPercentage: this._getProgressPercentage(),
            elapsedSeconds: Math.round(elapsed),
            ratePerMinute: rate.toFixed(1),
            isResumed: this.state.isResumed
        };
    }
}

module.exports = { StateManager };
