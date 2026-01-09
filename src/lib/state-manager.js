/**
 * State Manager for resumable large-scale scraping
 * Uses Apify Key-Value Store to persist progress
 *
 * OPTIMIZATION v2.0:
 * - Efficient Set operations
 * - Reduced memory peak during serialization
 * - Better checkpoint management
 */

const { Actor: DefaultActor } = require('apify');

const STATE_KEY = 'SCRAPING_STATE';
const CHECKPOINT_INTERVAL = 25; // Save state every 25 profiles

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
     * Initialize state (check for existing state to resume)
     */
    async initialize(searchParams, maxItems) {
        console.log('🔄 Initializing state manager...');

        const savedState = await this.Actor.getValue(STATE_KEY);

        if (this._canResume(savedState, searchParams)) {
            console.log('♻️  Resuming from saved state...');
            this.state = {
                processedPersonIds: new Set(savedState.processedIds || []),
                totalProcessed: savedState.totalProcessed || 0,
                totalRequested: maxItems,
                startedAt: savedState.startedAt,
                lastCheckpointAt: savedState.lastCheckpointAt,
                searchParams: savedState.searchParams,
                isResumed: true
            };
            console.log(`   Already processed: ${this.state.totalProcessed} profiles`);
            return true;
        }

        await this._clearState();
        this.state.startedAt = new Date().toISOString();
        this.state.searchParams = searchParams;
        this.state.totalRequested = maxItems;
        console.log('🆕 Starting new scraping session');
        return false;
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
     * Get processed IDs as Set (for filtering)
     */
    getProcessedIds() {
        return new Set(this.state.processedPersonIds);
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
     * Save current state to KV store
     * Optimized to reduce memory peak during serialization
     */
    async saveCheckpoint() {
        this.state.lastCheckpointAt = new Date().toISOString();

        // Convert Set to Array efficiently (avoid creating intermediate objects)
        const processedIdsArray = Array.from(this.state.processedPersonIds);

        const stateToSave = {
            processedIds: processedIdsArray,
            totalProcessed: this.state.totalProcessed,
            totalRequested: this.state.totalRequested,
            startedAt: this.state.startedAt,
            lastCheckpointAt: this.state.lastCheckpointAt,
            searchParams: this.state.searchParams,
            checkpointCount: (this.state.checkpointCount || 0) + 1
        };

        await this.Actor.setValue(STATE_KEY, stateToSave);

        const elapsed = this._getElapsedTime();
        const rate = this.state.totalProcessed / (elapsed / 60);

        // Get dataset info
        const dataset = await this.Actor.openDataset();
        const datasetInfo = await dataset.getInfo();

        console.log('💾 Checkpoint saved');
        console.log(`   Progress: ${this.state.totalProcessed}/${this.state.totalRequested} (${this._getProgressPercentage()}%)`);
        console.log(`   Dataset: ${datasetInfo.itemCount} items`);
        console.log(`   Rate: ${rate.toFixed(1)} profiles/min`);
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
            isResumed: false,
            checkpointCount: 0
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
        if (!this.state.startedAt) return 1; // Avoid division by zero
        return Math.max(1, (new Date() - new Date(this.state.startedAt)) / 1000);
    }

    /**
     * Get statistics
     */
    getStats() {
        const elapsed = this._getElapsedTime();
        const remaining = this.getRemainingCount();
        const rate = this.state.totalProcessed / (elapsed / 60);

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
