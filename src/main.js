/**
 * Harvard Catalyst Profiles Scraper
 * Two-stage scraper: API for listings + Browser for detail enrichment
 */

const { Actor } = require('apify');
const { PlaywrightCrawler } = require('crawlee');
const { searchProfiles } = require('./lib/api.js');
const { extractProfileDetails } = require('./lib/extractor.js');
const { performOCR } = require('./lib/ocr.js');
const { StateManager } = require('./lib/state-manager.js');

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

        console.log('🔍 Harvard Catalyst Profiles Scraper started');
        console.log(`📋 Search criteria: Keywords="${searchKeywords}", Department="${department}", Institution="${institution}", Max profiles=${maxItems}`);

        // Ensure dataset is ready
        const dataset = await Actor.openDataset();
        const initialInfo = await dataset.getInfo();
        console.log(`📊 Dataset ready: ${initialInfo.itemCount} existing items`);

        // Initialize state manager for progress tracking
        const stateManager = new StateManager();
        const searchParams = { searchKeywords, department, institution };
        await stateManager.initialize(searchParams, maxItems);

        // ========== STAGE 1: API-based listing extraction ==========
        console.log('\n📋 Searching for researcher profiles...');

        let profiles = [];
        try {
            profiles = await searchProfiles({
                keyword: searchKeywords,
                department,
                institution,
                maxItems
            });

            console.log(`✅ Found ${profiles.length} researchers matching your criteria`);
            console.log(`📝 Will process ${profiles.length} profiles`);
        } catch (error) {
            console.error(`❌ Search failed: ${error.message}`);
            console.error('Error details:', error);
            await Actor.exit({ exitCode: 1 });
            return;
        }

        // ========== STAGE 2: Browser-based detail enrichment ==========
        console.log(`\n📝 Collecting detailed information for ${profiles.length} researchers...`);

        // Report dataset status before starting
        const preProcessingInfo = await dataset.getInfo();
        console.log(`📊 Dataset before processing: ${preProcessingInfo.itemCount} items`);

        const crawler = new PlaywrightCrawler({
            maxConcurrency: 5,
            launchContext: {
                launchOptions: {
                    headless: true
                }
            },
            browserPoolOptions: {
                useFingerprints: false,
                maxOpenPagesPerBrowser: 1
            },
            requestHandlerTimeoutSecs: 60,
            navigationTimeoutSecs: 30,

            async requestHandler({ request, page }) {
                const { profile } = request.userData;
                console.log(`📄 Collecting profile: ${profile.displayName} (ID: ${profile.personId})`);

                // Check if already processed (prevent duplicates)
                if (stateManager.isProcessed(profile.personId)) {
                    console.log(`⏭️  Skipping ${profile.displayName} - already processed`);
                    return;
                }

                try {
                    // Set English language
                    await page.setExtraHTTPHeaders({
                        'Accept-Language': 'en-US,en;q=0.9'
                    });

                    // Extract profile details (uses g.preLoad)
                    const result = await extractProfileDetails(page);

                    if (!result.success) {
                        throw new Error(result.error || 'Extraction failed');
                    }

                    // Extract email if image present and no direct email
                    let extractedEmail = result.Email;
                    if (!extractedEmail && result.EmailImageUrl) {
                        try {
                            console.log(`📧 Extracting email address...`);
                            extractedEmail = await performOCR(result.EmailImageUrl);
                            if (extractedEmail) {
                                console.log(`✅ Email found: ${extractedEmail}`);
                            } else {
                                console.log(`ℹ️  Email not found in profile`);
                            }
                        } catch (ocrError) {
                            console.log(`⚠️  Unable to extract email: ${ocrError.message}`);
                        }
                    }

                    // Combine listing and detail data (merge enrichment)
                    const enrichedProfile = {
                        // Unique identifier (prevents duplicates)
                        personId: profile.personId,
                        profileUrl: profile.profileUrl,

                        // From detail page extraction (enriched data)
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

                        // Metadata
                        collectedAt: new Date().toISOString(),
                        query: {
                            searchKeywords,
                            department,
                            institution
                        }
                    };

                    // Verify enrichment worked (detail data should be present)
                    const hasEnrichment = result.FirstName || result.LastName || result.Address;
                    if (!hasEnrichment) {
                        console.log(`⚠️  Limited detail data for ${profile.displayName}`);
                    }

                    // Save enriched profile to dataset (only saved ONCE per personId)
                    try {
                        await Actor.pushData(enrichedProfile);
                        console.log(`✅ Saved: ${enrichedProfile.displayName}`);

                        // Mark as processed only after successful save
                        stateManager.markProcessed(profile.personId);
                    } catch (pushError) {
                        console.error(`❌ Failed to save ${enrichedProfile.displayName}: ${pushError.message}`);
                        throw pushError; // Re-throw to trigger partial data save
                    }

                    // Save checkpoint periodically
                    if (stateManager.shouldCheckpoint()) {
                        await stateManager.saveCheckpoint();
                    }

                } catch (error) {
                    console.error(`❌ Error processing ${profile.displayName} (ID: ${profile.personId}): ${error.message}`);

                    // If we haven't exhausted retries, throw the error to let Crawlee retry
                    // Default maxRequestRetries is 3. So retryCount 0, 1, 2.
                    if (request.retryCount < 3 &&
                        (error.message.includes('g.preLoad') || error.message.includes('Timeout') || error.message.includes('Extraction failed'))) {
                        console.log(`🔄 Retrying ${profile.displayName} (Attempt ${request.retryCount + 1}/3)...`);
                        throw error;
                    }

                    // Save partial data even on failure (with personId for tracking)
                    const partialData = {
                        // Ensure personId is preserved for deduplication
                        personId: profile.personId,
                        profileUrl: profile.profileUrl,

                        // Basic info from listing
                        displayName: profile.displayName,
                        institution: profile.institutionName,
                        department: profile.departmentName,
                        facultyRank: profile.facultyRank,

                        // Mark as partial/error
                        error: error.message,
                        isPartial: true,

                        // Metadata
                        collectedAt: new Date().toISOString(),
                        query: {
                            searchKeywords,
                            department,
                            institution
                        }
                    };

                    await Actor.pushData(partialData);
                    console.log(`⚠️  Partial data saved: ${profile.displayName} (Retries exhausted)`);

                    // Mark as processed even on error to avoid infinite retry
                    stateManager.markProcessed(profile.personId);

                    // Save checkpoint periodically
                    if (stateManager.shouldCheckpoint()) {
                        await stateManager.saveCheckpoint();
                    }
                }
            },

            async failedRequestHandler({ request }, error) {
                console.error(`⚠️  Could not access profile page: ${error.message}`);
            }
        });

        // Save search results immediately to prevent data loss on crash
        await Actor.setValue('SEARCH_DUMP', profiles);
        console.log(`💾 Saved ${profiles.length} profiles to intermediate storage (SEARCH_DUMP)`);

        // Queue all profile detail pages in batches to prevent event loop blocking
        console.log('🔄 Adding profiles to request queue...');
        const BATCH_SIZE = 1000;
        for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
            const batch = profiles.slice(i, i + BATCH_SIZE);
            const requests = batch.map(profile => ({
                url: profile.profileUrl,
                userData: { profile }
            }));
            await crawler.addRequests(requests);
            if (i % 5000 === 0 && i > 0) console.log(`   - Queued ${i} / ${profiles.length}`);
        }
        console.log('✅ All profiles queued for processing');

        // Free up memory
        const profilesCount = profiles.length;
        profiles = null;

        // Run the crawler
        await crawler.run();

        // Wait for data persistence (ensure all pushData buffers are flushed)
        console.log('\n⏳ Finalizing data persistence...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Summary with detailed dataset verification
        const finalDataset = await Actor.openDataset();
        const finalInfo = await finalDataset.getInfo();
        const stats = stateManager.getStats();

        const newItemsCollected = finalInfo.itemCount - preProcessingInfo.itemCount;
        const processedCount = stats.totalProcessed;

        console.log(`\n✅ Collection completed!`);
        console.log(`   📊 Dataset status:`);
        console.log(`      - Initial items: ${preProcessingInfo.itemCount}`);
        console.log(`      - Processed: ${processedCount} profiles`);
        console.log(`      - Successfully saved: ${newItemsCollected} profiles`);
        console.log(`      - Total items now: ${finalInfo.itemCount}`);
        
        // Use profilesCount which was saved before profiles was set to null
        const safeProfilesCount = profilesCount || 0;
        console.log(`   🔍 Researchers found: ${safeProfilesCount}`);
        
        const successRate = safeProfilesCount > 0 
            ? Math.round((newItemsCollected / safeProfilesCount) * 100) 
            : 0;
        console.log(`   ✨ Success rate: ${successRate}%`);
        console.log(`   ⏱️  Total processing rate: ${stats.ratePerMinute} profiles/min`);

        // Warning if there's a mismatch
        if (processedCount !== newItemsCollected) {
            console.log(`\n⚠️  Note: ${processedCount - newItemsCollected} profiles were processed but not found in final dataset`);
            console.log(`   This may be due to data validation or deduplication`);
        }

        console.log(`\n💾 All data has been saved to Apify Dataset`);

        // Clear state after successful completion
        await stateManager.finalize();

        await Actor.exit();
    } catch (error) {
        console.error('❌ Critical error occurred:', error.message);
        console.error('Error details:', error.stack);

        // Report dataset status even on error
        try {
            const errorDataset = await Actor.openDataset();
            const errorInfo = await errorDataset.getInfo();
            console.log(`\n📊 Dataset status at error: ${errorInfo.itemCount} items saved`);
            console.log(`💾 All collected data has been preserved in Apify Dataset`);
        } catch (reportError) {
            console.error('Unable to report dataset status:', reportError.message);
        }

        await Actor.exit({ exitCode: 1 });
    }
})().catch(error => {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
});