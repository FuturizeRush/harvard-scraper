# Harvard Catalyst Profiles Scraper

Extract comprehensive researcher profiles from the Harvard Catalyst Profiles directory, including contact information, research interests, and recent publications.

## What This Actor Does

This Actor collects detailed information about researchers from the Harvard Catalyst Profiles directory. Simply provide your search criteria, and it will automatically:
1. Search for researchers matching your keywords and filters
2. Collect complete profile information for each researcher

Perfect for:
- Academic research collaboration discovery
- Building researcher databases
- Analyzing institutional expertise
- Finding subject matter experts

## Input Parameters

- **Search Keywords** - Terms to search for in profiles (e.g., "cancer research", "neuroscience")
- **Department** - Filter results by specific department (optional)
- **Institution** - Filter results by institution name (optional)
- **Maximum Items** - Number of profiles to collect (50-30000, default: 50)
  - **Small runs (1-100)**: 10-30 minutes, ideal for testing
  - **Medium runs (100-1000)**: 30 minutes - 5 hours, balanced approach
  - **Large runs (1000-10000)**: 5-50 hours, comprehensive collection
  - **Extra large runs (10000-30000)**: 50-150 hours (2-6 days), complete datasets

**Note**: For complete datasets (25,000+ profiles), use empty search keywords to get all available profiles. The Actor is optimized for long-running tasks with automatic data persistence.

### Important Notice for Large-Scale Scraping

**Before running large-scale collections (10,000+ profiles):**

1. **Timeout Configuration**: Large-scale runs may take 100-150 hours (4-6 days) to complete. Ensure your run configuration allows sufficient time or set timeout to 0 (no limit) when starting the Actor.

2. **Account Balance**: For collecting ~25,000 profiles over several days of runtime, please verify your Apify account has sufficient credit to cover the platform usage.

3. **Potential Issues**: Extended scraping operations may encounter:
   - Network connectivity interruptions
   - Source website maintenance or changes
   - Platform resource fluctuations
   - Rate limiting or access restrictions

4. **Responsible Use**: This Actor is provided for educational and research purposes. Users should:
   - Verify compliance with applicable laws and institutional policies
   - Respect the Harvard Catalyst Profiles terms of service
   - Use collected data ethically and appropriately
   - Understand the scope and impact of data collection activities

**By using this Actor for large-scale data collection, you acknowledge these considerations and agree to use it responsibly.**

## Output Data

Each profile includes:
- **Basic Information**: Name, ID, title, institution, department
- **Contact Details**: Full address, phone number, email (when available)
- **Professional Information**: Faculty rank, research interests
- **Publications**: Recent publication highlights
- **Profile URL**: Direct link to the researcher's profile page
- **Metadata**: Collection timestamp and search query used

## Quick Start

### Using Prefill Configuration

The fastest way to start is using our prefill configuration which searches for cancer researchers:

```json
{
    "searchKeywords": "cancer research",
    "department": "",
    "institution": "",
    "maxItems": 50
}
```

### Custom Search Examples

**Search by Keywords**
```json
{
    "searchKeywords": "machine learning healthcare",
    "maxItems": 50
}
```

**Filter by Department**
```json
{
    "searchKeywords": "genomics",
    "department": "Genetics",
    "maxItems": 50
}
```

**Institution-Specific Search**
```json
{
    "institution": "Harvard Medical School",
    "department": "Cell Biology",
    "maxItems": 50
}
```

**Get All Available Profiles**
```json
{
    "searchKeywords": "",
    "department": "",
    "institution": "",
    "maxItems": 25000
}
```

## Data Quality

- Structured JSON output in Apify Dataset format
- Automatically extracts email addresses from available sources (approximately 75% success rate)
- Comprehensive error handling with informative logging
- Clean, normalized data ready for analysis
- Progress tracking for large-scale data collection

## Limitations

- Email addresses may not be available for all profiles (approximately 75% success rate)
- Some profiles may have incomplete information depending on source data
- English language interface only
- No authentication required (public data only)
- Large-scale runs are designed for reliability:
  - Runs can continue for multiple days without interruption
  - Automatic data saving - all collected data is preserved immediately
  - Regular progress updates for monitoring

## Troubleshooting

### No Results Found
- Verify your search keywords are spelled correctly
- Try broader search terms
- Remove department/institution filters to expand results

### Incomplete Profile Data
- Some researchers may not have all fields populated in their public profiles
- Email extraction depends on source data format and image quality
- Check the profile URL to verify data availability on the source website

### Slow Performance
- Consider reducing the maxItems parameter for faster completion
- Check your Apify plan's resource allocation
- Large-scale runs naturally require extended time for thorough data collection

## Use Cases

**Academic Collaboration**
Find researchers working on similar topics for potential collaborations and partnerships.

**Grant Applications**
Identify experts in specific fields to support research proposals and grant applications.

**Conference Planning**
Discover potential speakers and panelists in your field of interest.

**Talent Recruitment**
Build a comprehensive database of researchers for academic recruitment purposes.

## Data Privacy & Educational Use

This Actor collects only publicly available information from the Harvard Catalyst Profiles directory. All data is already accessible through the public website.

**Educational Purpose**: This tool is provided for educational and research purposes. It demonstrates web scraping techniques and data collection methodologies for learning and academic use.

**User Responsibility**: Users are responsible for ensuring their use complies with applicable laws, regulations, and the Harvard Catalyst Profiles terms of service. Please use this tool responsibly and ethically.

## Support

For issues or questions about this Actor:
1. Review the troubleshooting section above
2. Check your input parameters and configuration
3. Examine the run log for specific error messages and diagnostic information
