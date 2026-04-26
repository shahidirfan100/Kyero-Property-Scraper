# Kyero Property Scraper

Collect property listings from Kyero search pages at scale. Gather listing details such as price, bedrooms, bathrooms, images, agent info, and listing links in one structured dataset. Ideal for market analysis, lead generation, pricing research, and property monitoring workflows.

## Features

- **URL or keyword input** - Start from direct Kyero search URLs or location keywords
- **Pagination support** - Collect multiple pages per search automatically
- **Sale and rent modes** - Choose `for_sale` or `to_rent`
- **Rich listing data** - Extract key listing fields in a consistent structure
- **Clean dataset output** - Null and empty fields are removed before saving
- **Deduplication** - Prevent duplicate listings across pages and URLs

## Use Cases

### Property Market Research
Track listing volume, price ranges, and listing types across countries, regions, or cities. Build reusable datasets for trend analysis and benchmarking.

### Competitive Intelligence
Monitor what agencies publish, where inventory is concentrated, and how pricing differs by area. Use periodic runs to compare market movement over time.

### Lead Discovery
Collect relevant listing and agency information for outbound workflows. Filter output by location, budget tiers, or property profile.

### Investment Screening
Build shortlists for specific locations and price segments. Feed extracted data into your internal scoring or deal-evaluation pipeline.

---

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `urls` | Array | No | `["https://www.kyero.com/en/italy-property-for-sale-0l55732"]` | One or more Kyero search result URLs |
| `keyword` | String | No | `"italy"` | Location keyword used when URLs are not provided |
| `location` | String | No | `""` | Extra location phrase combined with keyword |
| `listing_type` | String | No | `"for_sale"` | Listing mode: `for_sale` or `to_rent` |
| `locale` | String | No | `"en"` | Locale used in requests |
| `results_wanted` | Integer | No | `20` | Maximum number of records to save |
| `max_pages` | Integer | No | `3` | Maximum pages to fetch per search URL |
| `proxyConfiguration` | Object | No | Apify Proxy preset | Proxy settings for reliability |

---

## Output Data

Each dataset item can include:

| Field | Type | Description |
|-------|------|-------------|
| `id` | Integer | Listing ID |
| `name` | String | Listing title |
| `price` | Number | Numeric listing price |
| `price_formatted` | String | Formatted price text |
| `reference_no` | String | Listing reference |
| `payment_scheme` | String | Sale or rent indicator |
| `location_id` | Integer | Location identifier |
| `images` | Array | Listing image URLs |
| `images_count` | Integer | Number of listing images |
| `property_url` | String | Absolute property detail URL |
| `bedroom_count` | Integer | Bedroom count |
| `bathroom_count` | Integer | Bathroom count |
| `built_m2` | Number | Built area |
| `plot_m2` | Number | Plot area |
| `property_type` | Object | Property type metadata |
| `agent` | Object | Agency metadata |
| `feature_keys` | Array | Listing feature tags |
| `badges` | Array | Listing badges |
| `search_url` | String | Source search URL |
| `page` | Integer | Search results page number |
| `fetched_at` | String | ISO timestamp of extraction |

---

## Usage Examples

### Basic URL Extraction

```json
{
  "urls": [
    "https://www.kyero.com/en/italy-property-for-sale-0l55732"
  ],
  "results_wanted": 20
}
```

### Multiple URLs with Pagination

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

### Keyword and Rent Listings

```json
{
  "keyword": "italy",
  "listing_type": "to_rent",
  "results_wanted": 30,
  "max_pages": 3
}
```

---

## Sample Output

```json
{
  "id": 19758817,
  "name": "Country house in Monopoli, Bari",
  "price": 390000,
  "price_formatted": "€ 390,000",
  "payment_scheme": "for_sale",
  "location_id": 60227,
  "images_count": 50,
  "bedroom_count": 2,
  "bathroom_count": 1,
  "built_m2": 105,
  "plot_m2": 1000,
  "property_url": "https://www.kyero.com/en/property/19758817-country-house-for-sale-monopoli?prime_boost_id=19758817",
  "search_url": "https://www.kyero.com/en/italy-property-for-sale-0l55732",
  "page": 1,
  "fetched_at": "2026-04-26T12:00:00.000Z"
}
```

---

## Tips for Best Results

### Use Stable Search URLs
- Prefer official Kyero search result links
- Keep locale and listing type consistent within one run

### Start Small, Then Scale
- Test with `results_wanted: 20` first
- Increase limits after confirming your filters

### Control Runtime with `max_pages`
- Use low values for quick checks
- Raise gradually for broader collection

### Use Proxy for Reliability
- Proxy helps keep runs stable for larger extractions
- Residential routing is recommended for sustained workloads

---

## Integrations

Connect your dataset with:

- **Google Sheets** - Quick tabular analysis
- **Airtable** - Searchable property databases
- **Make** - Automated enrichment workflows
- **Zapier** - Trigger notifications and downstream actions
- **Webhooks** - Push data to custom systems

### Export Formats

- **JSON** - API and application usage
- **CSV** - Spreadsheet workflows
- **Excel** - Reporting and sharing
- **XML** - System integration needs

---

## Frequently Asked Questions

### Can I run with only a keyword?
Yes. If `urls` is empty, keyword-based discovery is used.

### Can I scrape both sale and rent in one run?
Use separate runs for `for_sale` and `to_rent` for clean segmentation.

### Why are some optional fields missing?
Some listings do not expose every field. Empty values are removed from output.

### Does it handle pagination automatically?
Yes. It moves through result pages up to your `max_pages` and `results_wanted`.

### Can I provide multiple URLs?
Yes. Add multiple Kyero search URLs in the `urls` array.

---

## Support

For issues or feature requests, use the Apify actor support channel.

### Resources

- [Apify Documentation](https://docs.apify.com/)
- [Apify API Reference](https://docs.apify.com/api/v2)
- [Scheduling Runs](https://docs.apify.com/platform/schedules)

---

## Legal Notice

This actor is intended for legitimate data collection use cases. You are responsible for complying with applicable laws, site terms, and data usage requirements.
