/**
 * Harvard Catalyst Profiles Scraper
 * Two-stage scraper: API for listings + Browser for detail enrichment
 *
 * OPTIMIZATION v2.0:
 * - Batch processing to prevent memory overflow
 * - Longer delays to avoid anti-bot detection
 * - Periodic browser restart for memory cleanup
 * - Checkpoint resume support
 */

const { Actor } = require('apify');
const { PlaywrightCrawler, Configuration } = require('crawlee');
const { searchProfiles } = require('./lib/api.js');
const { extractProfileDetails } = require('./lib/extractor.js');
const { performOCR, terminateWorker } = require('./lib/ocr.js');
const { StateManager } = require('./lib/state-manager.js');

// Configuration constants
const BATCH_SIZE = 200; // Process profiles in batches
const DELAY_BETWEEN_REQUESTS_MIN = 4000; // 4 seconds minimum
const DELAY_BETWEEN_REQUESTS_MAX = 8000; // 8 seconds maximum
const DELAY_BETWEEN_BATCHES = 30000; // 30 seconds between batches
const BROWSER_RESTART_INTERVAL = 50; // Restart browser every 50 profiles
const CHECKPOINT_INTERVAL = 25; // Save state every 25 profiles

(async () => {
    try {
        await Actor.init();

        const input = await Actor.getInput() || {};
        const {
            searchKeywords = '',
            department = '',
            institution = '',
            maxItems = 50
        } = input;

        console.log('🔍 Harvard Catalyst Profiles Scraper started (Optimized v2.0)');
        console.log(`📋 Search: Keywords="${searchKeywords}", Department="${department}", Institution="${institution}"`);
        console.log(`📊 Target: ${maxItems} profiles`);

        // Ensure dataset is ready
        const dataset = await Actor.openDataset();
        const initialInfo = await dataset.getInfo();
        console.log(`📊 Dataset ready: ${initialInfo.itemCount} existing items`);

        // Initialize state manager for progress tracking
        const stateManager = new StateManager();
        const searchParams = { searchKeywords, department, institution };
        const isResumed = await stateManager.initialize(searchParams, maxItems);

        // ========== STAGE 1: API-based listing extraction ==========
        console.log('\n📋 Searching for researcher profiles...');

        let profiles = [];
        try {
            // Check if we have cached search results
            const cachedProfiles = await Actor.getValue('SEARCH_DUMP');
            if (cachedProfiles && cachedProfiles.length > 0 && isResumed) {
                profiles = cachedProfiles;
                console.log(`♻️  Using cached search results: ${profiles.length} profiles`);
            } else {
                profiles = await searchProfiles({
                    keyword: searchKeywords,
                    department,
                    institution,
                    maxItems
                });
                // Save search results for resume
                await Actor.setValue('SEARCH_DUMP', profiles);
                console.log(`💾 Saved ${profiles.length} profiles to cache`);
            }

            console.log(`✅ Found ${profiles.length} researchers matching your criteria`);
        } catch (error) {
            console.error(`❌ Search failed: ${error.message}`);
            await Actor.exit({ exitCode: 1 });
            return;
        }

        // Filter out already processed profiles
        const processedIds = stateManager.getProcessedIds();
        const remainingProfiles = profiles.filter(p => !processedIds.has(p.personId));
        console.log(`📝 Remaining profiles to process: ${remainingProfiles.length}`);

        if (remainingProfiles.length === 0) {
            console.log('✅ All profiles already processed!');
            await Actor.exit();
            return;
        }

        // ========== STAGE 2: Browser-based detail enrichment (Batch Processing) ==========
        console.log(`\n📝 Starting batch processing...`);
        console.log(`   Batch size: ${BATCH_SIZE}`);
        console.log(`   Total batches: ${Math.ceil(remainingProfiles.length / BATCH_SIZE)}`);

        let totalProcessed = 0;
        let totalErrors = 0;
        let profilesInCurrentBatch = 0;

        // Process in batches
        for (let batchIndex = 0; batchIndex < Math.ceil(remainingProfiles.length / BATCH_SIZE); batchIndex++) {
            const batchStart = batchIndex * BATCH_SIZE;
            const batchEnd = Math.min(batchStart + BATCH_SIZE, remainingProfiles.length);
            const batchProfiles = remainingProfiles.slice(batchStart, batchEnd);
            profilesInCurrentBatch = 0;

            console.log(`\n🔄 Processing batch ${batchIndex + 1}/${Math.ceil(remainingProfiles.length / BATCH_SIZE)}`);
            console.log(`   Profiles ${batchStart + 1} to ${batchEnd} of ${remainingProfiles.length}`);

            // Create fresh crawler for each batch to prevent memory buildup
            const crawler = new PlaywrightCrawler({
                maxConcurrency: 1, // Single request at a time for stability
                launchContext: {
                    launchOptions: {
                        headless: true,
                        args: [
                            '--disable-dev-shm-usage',
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-gpu',
                            '--disable-extensions',
                            '--disable-background-networking',
                            '--disable-default-apps',
                            '--disable-sync',
                            '--disable-translate',
                            '--metrics-recording-only',
                            '--mute-audio',
                            '--no-first-run',
                            '--safebrowsing-disable-auto-update'
                        ]
                    }
                },
                browserPoolOptions: {
                    useFingerprints: true,
                    maxOpenPagesPerBrowser: 1,
                    retireBrowserAfterPageCount: BROWSER_RESTART_INTERVAL,
                    preLaunchHooks: [
                        async () => {
                            // Force garbage collection before launching new browser
                            if (global.gc) {
                                global.gc();
                            }
                        }
                    ]
                },
                requestHandlerTimeoutSecs: 120,
                navigationTimeoutSecs: 90,
                maxRequestRetries: 2, // Reduced retries

                preNavigationHooks: [
                    async ({ page, log }) => {
                        // Random delay between requests (4-8 seconds)
                        const delay = Math.floor(Math.random() * (DELAY_BETWEEN_REQUESTS_MAX - DELAY_BETWEEN_REQUESTS_MIN)) + DELAY_BETWEEN_REQUESTS_MIN;
                        log.info(`💤 Waiting ${(delay / 1000).toFixed(1)}s...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                ],

                async requestHandler({ request, page }) {
                    const { profile } = request.userData;
                    console.log(`📄 [${totalProcessed + 1}] ${profile.displayName}`);

                    // Double-check if already processed
                    if (stateManager.isProcessed(profile.personId)) {
                        console.log(`⏭️  Skipping - already processed`);
                        return;
                    }

                    try {
                        // Set headers for English content
                        await page.setExtraHTTPHeaders({
                            'Accept-Language': 'en-US,en;q=0.9'
                        });

                        // Extract profile details
                        const result = await extractProfileDetails(page);

                        if (!result.success) {
                            throw new Error(result.error || 'Extraction failed');
                        }

                        // Extract email if image present
                        let extractedEmail = result.Email;
                        if (!extractedEmail && result.EmailImageUrl) {
                            try {
                                extractedEmail = await performOCR(result.EmailImageUrl);
                                if (extractedEmail) {
                                    console.log(`   ✉️  Email: ${extractedEmail}`);
                                }
                            } catch (ocrError) {
                                // Silent OCR failure
                            }
                        }

                        // Build enriched profile
                        const enrichedProfile = {
                            personId: profile.personId,
                            profileUrl: profile.profileUrl,
                            displayName: result.DisplayName || profile.displayName,
                            firstName: result.FirstName,
                            lastName: result.LastName,
                            title: result.Title,
                            institution: result.Institution || profile.institutionName,
                            department: result.Department || profile.departmentName,
                            facultyRank: profile.facultyRank,
                            address: result.Address,
                            phone: result.Phone,
                            fax: result.Fax,
                            email: extractedEmail || '',
                            collectedAt: new Date().toISOString(),
                            query: { searchKeywords, department, institution }
                        };

                        // Save to dataset
                        await Actor.pushData(enrichedProfile);
                        console.log(`   ✅ Saved`);

                        // Mark as processed
                        stateManager.markProcessed(profile.personId);
                        totalProcessed++;
                        profilesInCurrentBatch++;

                        // Periodic checkpoint
                        if (totalProcessed % CHECKPOINT_INTERVAL === 0) {
                            await stateManager.saveCheckpoint();
                        }

                    } catch (error) {
                        console.error(`   ❌ Error: ${error.message}`);
                        totalErrors++;

                        // Save partial data on error
                        if (request.retryCount >= 2) {
                            const partialData = {
                                personId: profile.personId,
                                profileUrl: profile.profileUrl,
                                displayName: profile.displayName,
                                institution: profile.institutionName,
                                department: profile.departmentName,
                                facultyRank: profile.facultyRank,
                                error: error.message,
                                isPartial: true,
                                collectedAt: new Date().toISOString(),
                                query: { searchKeywords, department, institution }
                            };
                            await Actor.pushData(partialData);
                            stateManager.markProcessed(profile.personId);
                            totalProcessed++;
                            profilesInCurrentBatch++;
                            console.log(`   ⚠️  Saved partial data`);
                        } else {
                            throw error; // Let crawler retry
                        }
                    }
                },

                async failedRequestHandler({ request }, error) {
                    const { profile } = request.userData;
                    console.error(`⚠️  Failed after retries: ${profile.displayName}`);

                    // Save failure record
                    const failedData = {
                        personId: profile.personId,
                        profileUrl: profile.profileUrl,
                        displayName: profile.displayName,
                        error: error.message,
                        isPartial: true,
                        collectedAt: new Date().toISOString()
                    };
                    await Actor.pushData(failedData);
                    stateManager.markProcessed(profile.personId);
                    totalProcessed++;
                    totalErrors++;
                }
            });

            // Add batch profiles to queue
            const requests = batchProfiles.map(profile => ({
                url: profile.profileUrl,
                userData: { profile }
            }));
            await crawler.addRequests(requests);

            // Run crawler for this batch
            await crawler.run();

            // Save checkpoint after each batch
            await stateManager.saveCheckpoint();

            // Memory cleanup between batches
            console.log(`\n🧹 Batch ${batchIndex + 1} complete. Cleaning up...`);
            console.log(`   Processed in batch: ${profilesInCurrentBatch}`);
            console.log(`   Total processed: ${totalProcessed}`);

            // Force garbage collection
            if (global.gc) {
                global.gc();
                console.log('   GC triggered');
            }

            // Delay between batches (except last batch)
            if (batchIndex < Math.ceil(remainingProfiles.length / BATCH_SIZE) - 1) {
                console.log(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...`);
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
            }
        }

        // Cleanup OCR worker
        await terminateWorker();

        // Final summary
        const finalDataset = await Actor.openDataset();
        const finalInfo = await finalDataset.getInfo();
        const stats = stateManager.getStats();

        console.log(`\n${'═'.repeat(50)}`);
        console.log(`✅ SCRAPING COMPLETED`);
        console.log(`${'═'.repeat(50)}`);
        console.log(`📊 Results:`);
        console.log(`   - Total profiles found: ${profiles.length}`);
        console.log(`   - Processed this run: ${totalProcessed}`);
        console.log(`   - Errors: ${totalErrors}`);
        console.log(`   - Dataset items: ${finalInfo.itemCount}`);
        console.log(`   - Success rate: ${((totalProcessed - totalErrors) / totalProcessed * 100).toFixed(1)}%`);
        console.log(`   - Processing rate: ${stats.ratePerMinute} profiles/min`);
        console.log(`${'═'.repeat(50)}`);

        // Clear state on successful completion
        await stateManager.finalize();

        await Actor.exit();

    } catch (error) {
        console.error('❌ Critical error:', error.message);
        console.error('Stack:', error.stack);

        // Cleanup
        await terminateWorker();

        // Report dataset status
        try {
            const errorDataset = await Actor.openDataset();
            const errorInfo = await errorDataset.getInfo();
            console.log(`\n📊 Dataset preserved: ${errorInfo.itemCount} items`);
        } catch (e) {
            // Ignore
        }

        await Actor.exit({ exitCode: 1 });
    }
})().catch(error => {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
});
