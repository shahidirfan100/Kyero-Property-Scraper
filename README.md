# Kyero Property Scraper

Extract property listings from Kyero in a clean, structured dataset. Collect prices, locations, bedroom and bathroom counts, floor areas, agency details, property links, feature tags, available image URLs, and image counts for research, monitoring, lead discovery, and property market analysis.

This Kyero scraper is built for users who need reliable real estate listing data without manually copying results from search pages. Start with Kyero search URLs or use a keyword, choose sale or rental listings, set your result limit, and export the data in the format your workflow needs.

## Features

- **Search URL collection** - Collect listings from one or more Kyero search result pages
- **Keyword discovery** - Use a location keyword when you don't already have a search URL
- **Sale and rental modes** - Choose `for_sale` or `to_rent` depending on your target market
- **Image data** - Save available listing image URLs plus the reported `images_count`
- **Pagination support** - Move through result pages until your limit or page cap is reached
- **Rich property fields** - Capture price, size, bedroom count, bathroom count, agency details, and features
- **Clean output** - Empty values are removed so exports stay tidy
- **Duplicate handling** - Avoid repeated properties across URLs and pages

## Use Cases

### Property Market Research

Track available properties across countries, regions, cities, and resort areas. Use listing counts, prices, bedrooms, property types, and image availability to compare markets and spot patterns in supply.

### Real Estate Lead Discovery

Collect property and agency information for outreach, CRM enrichment, or internal lead scoring. The dataset includes agency names, listing URLs, reference numbers, and key property facts that help qualify opportunities.

### Pricing Analysis

Build datasets for comparing price bands by location, property type, bedroom count, and usable area. Export results to a spreadsheet or analytics tool to review price movement and inventory changes over time.

### Investment Screening

Create shortlists for target regions and property profiles. Use fields like `price`, `built_m2`, `plot_m2`, `bedroom_count`, `feature_keys`, and `property_url` to feed your own investment checks.

### Listing Monitoring

Run the actor on the same URLs on a schedule to monitor new listings, changed inventory, or changes in available properties. This is useful for recurring research and competitive tracking.

---

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `urls` | Array | No | `["https://www.kyero.com/en/italy-property-for-sale-0l55732"]` | One or more Kyero search result URLs |
| `keyword` | String | No | `"italy"` | Location keyword used when `urls` is empty |
| `location` | String | No | `""` | Optional location phrase used with `keyword` |
| `listing_type` | String | No | `"for_sale"` | Listing mode: `for_sale` or `to_rent` |
| `locale` | String | No | `"en"` | Kyero language locale to use for results |
| `results_wanted` | Integer | No | `20` | Maximum number of property records to save |
| `max_pages` | Integer | No | `3` | Maximum result pages to collect per search URL |
| `proxyConfiguration` | Object | No | Apify Residential Proxy preset | Proxy settings for stable larger runs |

---

## Output Data

Each dataset item can include:

| Field | Type | Description |
|-------|------|-------------|
| `id` | Integer | Kyero property ID |
| `name` | String | Listing title |
| `price` | Number | Numeric property price |
| `price_formatted` | String | Display price shown on Kyero |
| `reference_no` | String | Listing reference number |
| `payment_scheme` | String | Sale or rental indicator |
| `location_id` | Integer | Kyero location ID |
| `images` | Array | Listing image URLs available in search results |
| `images_count` | Integer | Number of images reported for the listing |
| `path` | String | Kyero relative listing path |
| `property_url` | String | Full property listing URL |
| `bedroom_count` | Integer | Number of bedrooms |
| `bathroom_count` | Integer | Number of bathrooms |
| `built_m2` | Number | Built area in square meters |
| `plot_m2` | Number | Plot area in square meters |
| `short_html_description` | String | Short listing description |
| `property_type` | Object | Property type information |
| `agent` | Object | Agency or advertiser details |
| `video_url` | String | Listing video URL when available |
| `remote_viewing_enabled` | Boolean | Whether remote viewing is offered |
| `feature_keys` | Array | Property feature labels |
| `badges` | Array | Listing badges |
| `primary_badge` | String | Main listing badge |
| `search_url` | String | Source search URL |
| `page` | Integer | Result page number |
| `locale` | String | Locale used during extraction |
| `location_name` | String | Search location name |
| `search_title` | String | Search result title |
| `fetched_at` | String | Timestamp when the record was saved |

---

## Usage Examples

### Basic URL Extraction

Collect 20 properties from a Kyero search page:

```json
{
    "urls": [
        "https://www.kyero.com/en/italy-property-for-sale-0l55732"
    ],
    "results_wanted": 20
}
```

### Multiple Search URLs

Collect listings from more than one search page:

```json
{
    "urls": [
        "https://www.kyero.com/en/italy-property-for-sale-0l55732",
        "https://www.kyero.com/en/tuscany-property-for-sale-0l55733"
    ],
    "results_wanted": 80,
    "max_pages": 4
}
```

### Keyword Search

Use a keyword when you don't have a Kyero search URL ready:

```json
{
    "keyword": "italy",
    "listing_type": "for_sale",
    "results_wanted": 30,
    "max_pages": 3
}
```

### Rental Listings

Collect rental listings instead of properties for sale:

```json
{
    "keyword": "spain",
    "listing_type": "to_rent",
    "results_wanted": 50,
    "max_pages": 5
}
```

---

## Sample Output

```json
{
    "id": 20757031,
    "name": "Villa in Monopoli, Bari",
    "price": 590000,
    "price_formatted": "€ 590,000",
    "reference_no": "Rif: 9113RA5201",
    "payment_scheme": "for_sale",
    "location_id": 60227,
    "images": [
        "https://images.kyero.com/crop/960x720/https://production-kyero-property-images.s3.amazonaws.com/20757/20757031/gvnd7fn6t1_DSC_9464-HDR.jpg",
        "https://images.kyero.com/crop/960x720/https://production-kyero-property-images.s3.amazonaws.com/20757/20757031/5vnud6dzvr9_DSC_9452-HDR.jpg"
    ],
    "images_count": 28,
    "bedroom_count": 4,
    "bathroom_count": 2,
    "built_m2": 153,
    "plot_m2": 1100,
    "property_url": "https://www.kyero.com/en/property/20757031-villa-for-sale-monopoli",
    "property_type": {
        "id": 10,
        "key": "villa",
        "property_group_id": 2
    },
    "agent": {
        "id": 20879,
        "name": "Pregio Immobiliare",
        "status": "live"
    },
    "feature_keys": [
        "garage",
        "parking",
        "terrace",
        "garden",
        "pool"
    ],
    "search_url": "https://www.kyero.com/en/italy-property-for-sale-0l55732",
    "page": 1,
    "locale": "en",
    "location_name": "Italy",
    "fetched_at": "2026-07-18T06:26:10.361Z"
}
```

---

## Tips for Best Results

### Use Specific Search URLs

- Use official Kyero search result pages for the most targeted output
- Keep sale and rental URLs in separate runs for cleaner datasets
- Confirm the page matches your target country, region, or city before scaling up

### Start With a Small Run

- Test with `results_wanted: 20` before larger runs
- Increase `max_pages` after confirming the fields and location are correct
- Use smaller test runs when checking a new keyword or market

### Tune Pagination

- Use `max_pages` to control how far the actor moves through each search
- Raise `results_wanted` and `max_pages` together for broader collection
- Keep limits practical when monitoring multiple search URLs

### Use Proxy for Stability

For larger recurring jobs, use Apify Proxy:

```json
{
    "proxyConfiguration": {
        "useApifyProxy": true
    }
}
```

---

## Integrations

Connect your Kyero dataset with:

- **Google Sheets** - Review property data in a spreadsheet
- **Airtable** - Build searchable real estate databases
- **Make** - Send listings into automated workflows
- **Zapier** - Trigger alerts and downstream actions
- **Webhooks** - Push data to your own systems
- **CRM tools** - Add agency and property leads to sales pipelines

### Export Formats

- **JSON** - For applications and data pipelines
- **CSV** - For spreadsheet analysis
- **Excel** - For reporting and sharing
- **XML** - For system imports

---

## Frequently Asked Questions

### Can I collect image data for each property?

Yes. The actor saves the listing image URLs available in the search results and also includes `images_count` so you can see how many images Kyero reports for the property.

### Can I run the scraper with only a keyword?

Yes. If `urls` is empty, the actor uses the keyword and listing type to find matching Kyero locations.

### Can I scrape both sale and rental listings in one run?

Use separate runs for `for_sale` and `to_rent`. Separate runs keep output easier to filter, compare, and schedule.

### Does the actor handle pagination?

Yes. The actor moves through result pages until it reaches `results_wanted`, `max_pages`, or the available result limit.

### Why are some fields missing from some records?

Some Kyero listings don't include every optional field. Empty values are removed from the saved output.

### Can I provide multiple Kyero URLs?

Yes. Add multiple search pages to `urls`, and the actor will collect unique properties across them.

### What is the best way to monitor a market?

Use the same search URLs on a recurring schedule and export each run. This lets you compare inventory, pricing, and new listings over time.

---

## Support

For issues or feature requests, contact support through the Apify Console.

### Resources

- [Apify Documentation](https://docs.apify.com/)
- [Apify API Reference](https://docs.apify.com/api/v2)
- [Scheduling Runs](https://docs.apify.com/platform/schedules)

---

## Legal Notice

This actor is designed for legitimate data collection purposes. Users are responsible for complying with website terms of service, privacy rules, and applicable laws. Use collected data responsibly and respect source website limits.
