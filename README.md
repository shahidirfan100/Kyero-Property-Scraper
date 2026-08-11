## What does Kyero Property Scraper do?

Kyero Property Scraper collects structured property listings from Kyero.com, a real estate marketplace covering homes and investment properties across European locations. Provide one or more Kyero search URLs, or search by a location keyword, and receive property records with prices, bedrooms, bathrooms, areas, property types, agency details, images, features, and listing URLs.

Use the dataset for property market research, investment screening, agency lead discovery, price comparisons, inventory monitoring, and real estate data pipelines. The results can be downloaded as JSON, CSV, Excel, or XML, connected to integrations, or accessed through the Apify API.

## Why use Kyero Property Scraper?

- **Collect property inventory** - Gather listings from countries, regions, cities, and resort areas represented on Kyero.
- **Compare sale and rental markets** - Run separate searches for `for_sale` and `to_rent` listings.
- **Build research datasets** - Combine prices, property sizes, bedroom counts, features, and locations for market analysis.
- **Find agency opportunities** - Use listing references, agency information, property URLs, and key property facts for lead qualification.
- **Track listing changes** - Schedule repeat runs against the same search URLs to review changing inventory and prices.
- **Control collection size** - Set a maximum result count and page limit for small tests or larger research runs.
- **Export ready-to-use data** - Download structured results or connect datasets to spreadsheets, webhooks, and automation tools.

## What data can you extract from Kyero?

Each saved item represents one property listing. Available fields depend on the information published for that listing.

| Field | Type | Description |
|-------|------|-------------|
| `id` | Integer | Kyero property ID. |
| `name` | String | Listing title. |
| `price` | Number | Numeric property price. |
| `price_formatted` | String | Price as displayed on Kyero, including the currency format. |
| `reference_no` | String | Agency or listing reference number when available. |
| `payment_scheme` | String | Sale or rental listing indicator. |
| `location_id` | Integer | Kyero location identifier. |
| `location_name` | String | Location name associated with the search. |
| `property_type` | Object | Property type information such as apartment, house, or villa. |
| `bedroom_count` | Integer | Number of bedrooms. |
| `bathroom_count` | Integer | Number of bathrooms. |
| `built_m2` | Number | Built area in square meters. |
| `plot_m2` | Number | Plot area in square meters. |
| `short_html_description` | String | Short description supplied with the listing when available. |
| `agent` | Object | Advertiser or agency details. |
| `images` | Array | Available listing image URLs. |
| `images_count` | Integer | Number of images reported for the listing. |
| `video_url` | String | Listing video URL when available. |
| `remote_viewing_enabled` | Boolean | Indicates whether remote viewing is offered. |
| `feature_keys` | Array | Feature labels such as pool, garden, parking, or terrace. |
| `badges` | Array | Listing badges shown by Kyero. |
| `primary_badge` | String | Main listing badge when available. |
| `property_url` | String | Full URL of the Kyero property listing. |
| `search_url` | String | Search URL used to collect the record. |
| `page` | Integer | Result page number where the listing was found. |
| `locale` | String | Kyero locale used for the run. |
| `search_title` | String | Title of the search results page. |
| `fetched_at` | String | ISO timestamp when the record was saved. |

## How to use Kyero Property Scraper

1. Open the Actor in Apify Console.
2. Add a Kyero search URL, or leave `urls` empty and provide a `keyword` or `location`.
3. Choose `for_sale` or `to_rent` when using keyword discovery.
4. Set `results_wanted` and `max_pages` for the size of the run.
5. Start the run and review the dataset preview.
6. Download the results or connect the dataset to your workflow.

For larger or recurring collections, configure Apify Proxy in the input. A smaller first run makes it easier to confirm that the selected location and listing type are correct.

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `urls` | Array of strings | No | Kyero Italy sale search URL | One or more Kyero search result URLs. When valid URLs are provided, they are used directly. |
| `keyword` | String | No | `italy` | Location keyword used for Kyero location discovery when no valid search URL is provided. |
| `location` | String | No | Empty | Optional location phrase used with `keyword`. When provided, the first matching location is selected. |
| `listing_type` | String | No | `for_sale` | Listing mode for keyword discovery: `for_sale` or `to_rent`. |
| `locale` | String | No | `en` | Two-letter Kyero language locale used for requests and output metadata. |
| `results_wanted` | Integer | No | `20` | Maximum number of unique property records to save. Minimum value is `1`. |
| `max_pages` | Integer | No | `3` | Maximum number of result pages to process for each search URL. Minimum value is `1`. |
| `proxyConfiguration` | Object | No | Apify Proxy preset | Optional Apify Proxy settings for larger or recurring runs. |

The `urls` input accepts a list of Kyero search pages, including country, region, city, and other location searches. If no usable URL is supplied, provide at least one of `keyword` or `location`.

## Output Data

The Actor saves one dataset item per unique property. Optional values are omitted when the source listing does not publish them.

| Field | Type | Description |
|-------|------|-------------|
| `id` | Integer | Kyero property identifier. |
| `name` | String | Property listing name. |
| `price` | Number | Numeric price value. |
| `price_formatted` | String | Human-readable price value. |
| `payment_scheme` | String | Sale or rent classification. |
| `bedroom_count` | Integer | Bedroom count. |
| `bathroom_count` | Integer | Bathroom count. |
| `built_m2` | Number | Built area in square meters. |
| `plot_m2` | Number | Plot area in square meters. |
| `property_type` | Object | Property category details. |
| `agent` | Object | Agency or advertiser details. |
| `images` | Array | Image URLs available for the listing. |
| `feature_keys` | Array | Available property feature labels. |
| `property_url` | String | Direct Kyero listing URL. |
| `search_url` | String | Source search page. |
| `page` | Integer | Source result page. |
| `locale` | String | Locale used for the run. |
| `fetched_at` | String | ISO collection timestamp. |

## Usage Examples

### Basic URL Extraction

Collect the first 20 properties from a Kyero search page:

```json
{
  "urls": [
    "https://www.kyero.com/en/italy-property-for-sale-0l55732"
  ],
  "results_wanted": 20
}
```

### Multiple Search URLs

Collect unique properties from two search pages and allow up to four pages per URL:

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

### Keyword-Based Location Discovery

Use a location keyword when you do not already have a Kyero search URL:

```json
{
  "keyword": "italy",
  "listing_type": "for_sale",
  "locale": "en",
  "results_wanted": 30,
  "max_pages": 3
}
```

### Rental Market Collection

Collect rental listings for a specific location keyword:

```json
{
  "keyword": "spain",
  "location": "Alicante",
  "listing_type": "to_rent",
  "results_wanted": 50,
  "max_pages": 5,
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

## Sample Output

The following example shows one realistic dataset item. Optional fields can differ between listings.

```json
{
  "id": 20757031,
  "name": "Villa in Monopoli, Bari",
  "price": 590000,
  "price_formatted": "€ 590,000",
  "reference_no": "Rif: 9113RA5201",
  "payment_scheme": "for_sale",
  "location_id": 60227,
  "bedroom_count": 4,
  "bathroom_count": 2,
  "built_m2": 153,
  "plot_m2": 1100,
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
  "images": [
    "https://images.kyero.com/crop/960x720/https://production-kyero-property-images.s3.amazonaws.com/20757/20757031/gvnd7fn6t1_DSC_9464-HDR.jpg"
  ],
  "images_count": 28,
  "feature_keys": [
    "garage",
    "parking",
    "terrace",
    "garden",
    "pool"
  ],
  "property_url": "https://www.kyero.com/en/property/20757031-villa-for-sale-monopoli",
  "search_url": "https://www.kyero.com/en/italy-property-for-sale-0l55732",
  "page": 1,
  "locale": "en",
  "location_name": "Italy",
  "fetched_at": "2026-07-18T06:26:10.361Z"
}
```

## Tips for Best Results

- **Use targeted search URLs** - Start with a Kyero country, region, city, or resort-area search page when you need a precise market segment.
- **Separate sale and rental runs** - Use separate scheduled runs for `for_sale` and `to_rent` so the resulting datasets remain easy to compare.
- **Test before scaling** - Begin with 20 results and a small page limit, then increase both values after confirming the output.
- **Keep limits aligned** - A higher `results_wanted` value may require a higher `max_pages` value to reach the desired number of records.
- **Use stable input locations** - Check that a keyword or URL points to the intended country or region before starting a large collection.
- **Expect optional fields** - Price, agency, media, descriptions, and features can be missing when they are not published on a particular listing.
- **Schedule monitoring runs** - Repeat the same search on a daily or weekly schedule to compare available properties over time.

## Integrations and Export Formats

- **Google Sheets** - Review prices, locations, and property attributes in a spreadsheet.
- **Airtable** - Create a searchable property inventory with views for markets, prices, or agencies.
- **Make and Zapier** - Send new dataset items into alerts, workflows, or other services.
- **Webhooks** - Trigger downstream processing after an Actor run finishes.
- **Apify API** - Fetch run status and dataset records from your own application.
- **JSON, CSV, Excel, and XML** - Download the results in formats suited to analysis, reporting, or system imports.

## Frequently Asked Questions

### Can I collect both properties for sale and rentals?

Yes. Use `listing_type: "for_sale"` or `listing_type: "to_rent"` for keyword-based discovery. For direct URLs, use a Kyero search page that matches the listing category you want.

### Can I run the Actor with only a keyword?

Yes. Leave `urls` empty and provide `keyword`, `location`, or both. The Actor finds matching Kyero locations and uses the selected listing type to choose sale or rental results.

### Can I provide multiple Kyero search URLs?

Yes. Add multiple URLs to `urls`. The Actor processes them in one run and removes duplicate properties found across pages.

### Does the Actor support pagination?

Yes. `max_pages` controls the maximum number of result pages processed per search URL, while `results_wanted` controls the total number of records saved.

### Why is a field missing from a listing?

A field is omitted when the Kyero listing does not provide a value for it. Review several records before treating an absent optional field as a collection problem.

### Can I export Kyero data to CSV or Excel?

Yes. Apify datasets can be downloaded as CSV, Excel, JSON, XML, and other supported formats, or consumed through integrations and the API.

### Can I schedule recurring Kyero data collection?

Yes. Create an Apify schedule for hourly, daily, weekly, or custom recurring runs. Reusing the same search URLs makes inventory and price comparisons easier.

### Is collecting Kyero data legal?

You are responsible for complying with Kyero's terms, applicable laws, privacy requirements, and any restrictions that apply to your intended use. Collect and use public property data responsibly.

## Related Actors

- [Housing.com Property Scraper](https://apify.com/shahidirfan/housing-com-property-scraper) - Collect property listings from the Indian real estate market.
- [Rightmove Property Scraper](https://apify.com/shahidirfan/rightmove-property-scraper) - Extract sale and rental listings from the UK property market.
- [Propertyfinder Scraper](https://apify.com/shahidirfan/propertyfinder-scraper) - Gather property details, prices, and locations from Propertyfinder.
- [Savills Property Scraper](https://apify.com/shahidirfan/savills-property-scraper) - Collect real estate listings for market research and property analysis.

## Support

For issues, feature requests, or reports about changed Kyero pages, use the Issues tab on the Actor page or contact the developer through Apify.

## Legal Notice

This Actor is intended for legitimate collection of publicly available property information. Users are responsible for complying with Kyero's terms of service, applicable laws, privacy rules, and any restrictions on storing, sharing, or contacting agencies using collected data.
