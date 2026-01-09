/**
 * Extract profile details from Harvard Catalyst profile pages
 * 
 * EXTRACTION METHOD:
 * The page embeds profile data in a JavaScript variable g.preLoad within a <script> tag.
 * The data is a JSON string containing all profile information, including:
 * - FirstName, LastName, DisplayName
 * - Address lines 1-4
 * - Phone and Fax
 * - Affiliation information (Title, Institution, Department)
 */

/**
 * Extract all profile details from the page using g.preLoad
 * @param {Object} page - Playwright page object
 * @returns {Promise<Object>} Extracted profile details
 * 
 * Success response:
 * {
 *   success: true,
 *   FirstName: "Graham",
 *   LastName: "Colditz",
 *   DisplayName: "Graham Andrew Colditz, Dr.P.H., M.B.,B.S., M.D.",
 *   Title: "Adjunct Professor of Epidemiology",
 *   Department: "Epidemiology",
 *   Institution: "Harvard T.H. Chan School of Public Health",
 *   Address: "Channing Laboratory, 181 Longwood Ave, Boston, MA 02115",
 *   Phone: "314-454-7940",
 *   Fax: "",
 *   Email: ""
 * }
 * 
 * Error response:
 * {
 *   success: false,
 *   error: "Error message"
 * }
 */
async function extractProfileDetails(page) {
    try {
        // Wait for page to fully load with network idle (more stable)
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {
            // If networkidle times out, continue anyway (page might still be loading non-critical resources)
        });

        // Wait for DOM content to be loaded
        await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

        // Wait for g.preLoad script to be available with increased timeout
        // Some profiles need more time to fully render.
        // If not found, try reloading the page up to 2 times.
        let scriptFound = false;

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                // Try finding it (fast check first)
                scriptFound = await page.evaluate(() => {
                    // Check standard collection
                    for (const script of document.scripts) {
                        if (script.textContent && script.textContent.includes('g.preLoad')) return true;
                    }
                    return false;
                });

                if (scriptFound) break;

                // If not found immediately, wait a bit
                await page.waitForFunction(() => {
                    for (const script of document.scripts) {
                        if (script.textContent && script.textContent.includes('g.preLoad')) return true;
                    }
                    return false;
                }, { timeout: 10000 }); // 10s wait per attempt

                scriptFound = true;
                break;

            } catch (waitError) {
                if (attempt < 3) {
                    console.log(`⚠️  g.preLoad not found (Attempt ${attempt}/3). Reloading page...`);
                    try {
                        await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
                        // Wait for stability after reload
                        await page.waitForTimeout(2000);
                    } catch (reloadError) {
                        console.log(`   Reload failed: ${reloadError.message}`);
                    }
                } else {
                    console.log("⚠️  Timeout waiting for g.preLoad script after retries");

                    // Debug: Log page state
                    const debugInfo = await page.evaluate(() => ({
                        title: document.title,
                        bodyLen: document.body.innerText.length,
                        scriptCount: document.scripts.length,
                        htmlSnippet: document.body.innerHTML.substring(0, 200)
                    }));
                    console.log(`   Debug Info: Title="${debugInfo.title}", Scripts=${debugInfo.scriptCount}, BodyLen=${debugInfo.bodyLen}`);
                }
            }
        }

        // Check for email image with short timeout to ensure it has time to render
        // This is not critical so we catch constraints
        try {
            await page.waitForSelector('img[src*="EmailHandler"], img[src*="ShowEmail"]', { timeout: 2000 });
        } catch (e) {
            // Ignore timeout, image might not exist
        }

        const result = await page.evaluate(() => {
            // Find the script tag containing g.preLoad
            const scripts = document.querySelectorAll("script");

            for (const script of scripts) {
                const content = script.textContent;

                // Check if this script contains g.preLoad
                if (!content.includes("g.preLoad")) continue;

                // Find the assignment g.preLoad = '...'
                const startIdx = content.indexOf("g.preLoad");
                const segment = content.substring(startIdx);

                // Find the opening quote after the equals sign
                const eqIdx = segment.indexOf("=");
                const quoteIdx = segment.indexOf("'", eqIdx);

                if (quoteIdx === -1) continue;

                // Find the matching closing quote (accounting for escaping)
                let endIdx = quoteIdx + 1;
                let escaped = false;
                while (endIdx < segment.length) {
                    if (escaped) {
                        escaped = false;
                    } else if (segment[endIdx] === "\\") {
                        escaped = true;
                    } else if (segment[endIdx] === "'") {
                        break;
                    }
                    endIdx++;
                }

                if (endIdx >= segment.length) continue;

                // Extract the JSON string between the quotes
                let jsonStr = segment.substring(quoteIdx + 1, endIdx);

                // Unescape single quotes that are left over from the JS string literal
                // These are invalid in JSON: \' should just be '
                jsonStr = jsonStr.replace(/\'/g, "'");

                // Parse the JSON
                let parsed;
                try {
                    parsed = JSON.parse(jsonStr);
                } catch (parseError) {
                    return {
                        success: false,
                        error: "Failed to parse g.preLoad JSON: " + parseError.message
                    };
                }

                // Extract the first module's first data record (Person.GeneralInfo)
                if (!Array.isArray(parsed) || parsed.length === 0) {
                    return {
                        success: false,
                        error: "g.preLoad is not an array or is empty"
                    };
                }

                const moduleData = parsed[0].ModuleData;
                if (!Array.isArray(moduleData) || moduleData.length === 0) {
                    return {
                        success: false,
                        error: "No ModuleData found in g.preLoad"
                    };
                }

                const profile = moduleData[0];

                // Build address from individual lines
                const addressParts = [];
                [profile.AddressLine1, profile.AddressLine2, profile.AddressLine3, profile.AddressLine4]
                    .forEach(line => {
                        if (line && line.trim()) {
                            addressParts.push(line.trim());
                        }
                    });

                // Extract primary affiliation (first affiliation)
                let affiliation = {};
                if (profile.Affiliation && Array.isArray(profile.Affiliation) && profile.Affiliation.length > 0) {
                    const aff = profile.Affiliation[0];
                    affiliation = {
                        Title: aff.Title || "",
                        Institution: aff.InstitutionName || "",
                        Department: aff.DepartmentName || ""
                    };
                }

                // Format phone/fax (remove forward slashes used in original format and handle empty spaces)
                const formatPhoneNumber = (phone) => {
                    if (!phone) return "";
                    // Ensure it's a string
                    const str = String(phone);
                    // Replace slashes and trim
                    const cleaned = str.replace(/\//g, "-").trim();
                    // Return empty string if result is only whitespace
                    return cleaned.length > 0 ? cleaned : "";
                };

                // Check for email (mailto, raw text or image)
                // 1. Check profile.Email from JSON
                let email = profile.Email || "";
                
                // 2. If empty, check DOM for mailto links
                if (!email || email.trim() === "") {
                    const mailto = document.querySelector('a[href^="mailto:"]');
                    if (mailto) {
                        email = mailto.href.replace("mailto:", "").trim();
                    }
                }

                // 3. Check for email image in DOM
                // Updated to support both EmailHandler.ashx (new) and ShowEmail (legacy)
                const emailImg = document.querySelector('img[src*="EmailHandler"]') ||
                    document.querySelector('img[src*="ShowEmail"]') ||
                    document.querySelector('img[alt*="email" i]');
                
                if (!emailImg && !email) {
                     // Try to find email in text if it looks like an email
                     // This is a last resort fallback
                     const bodyText = document.body.innerText;
                     const emailMatch = bodyText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
                     if (emailMatch && emailMatch[0] && !emailMatch[0].includes(".png") && !emailMatch[0].includes(".jpg")) {
                         // Only if it's high confidence (e.g. near "Email:")
                         // For now, let's just leave it blank if not found in structured data or image
                     }
                }

                return {
                    success: true,
                    FirstName: profile.FirstName || "",
                    LastName: profile.LastName || "",
                    DisplayName: profile.DisplayName || "",
                    Title: affiliation.Title || profile.Title || "",
                    Department: affiliation.Department || profile.Department || "",
                    Institution: affiliation.Institution || profile.Institution || "",
                    Address: addressParts.join(", "),
                    Phone: formatPhoneNumber(profile.Phone),
                    Fax: formatPhoneNumber(profile.Fax),
                    Email: email,
                    EmailImageUrl: emailImg ? emailImg.src : ""
                };
            }

            // If we get here, g.preLoad was not found
            return {
                success: false,
                error: "g.preLoad not found in any script tag"
            };
        });

        return result;
    } catch (error) {
        return {
            success: false,
            error: "Error during extraction: " + error.message
        };
    }
}

module.exports = {
    extractProfileDetails
};