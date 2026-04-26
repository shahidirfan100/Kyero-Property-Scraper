## Selected API

- Endpoint: `https://www.kyero.com/<locale>/<search-slug>.data?_routes=routes/properties/search/routes/index.route&page=<n>`
- Method: `GET`
- Auth: None
- Response type: `text/x-script` packed route payload (decoded in actor)
- Pagination: `page` query parameter, plus `properties.pagination.nextPage` in response
- Required headers:
  - `accept: text/x-script, text/plain, application/json, */*`
  - `x-remix-data: yes`
  - `x-requested-with: XMLHttpRequest`
  - `accept-language: en-US,en;q=0.9`
  - Browser-like `user-agent`
- Works with plain `gotScraping`: Yes

### Fields available (sample)

- `id`, `name`, `price`, `price_formatted`, `reference_no`, `payment_scheme`
- `location_id`, `images`, `images_count`, `path`
- `bedroom_count`, `bathroom_count`, `built_m2`, `plot_m2`
- `short_html_description`, `property_type`, `agent`
- `video_url`, `remote_viewing_enabled`, `feature_keys`, `badges`, `primary_badge`
- Additional route payload metadata: `location`, `country`, `filterOptions`, `urlParams`, `mergedParams`, `pagination`

### Field count comparison

- Existing actor (Remote.co): ~8 core fields
- Selected Kyero endpoint: 20+ listing fields plus search metadata

### Score (selection matrix)

- Returns JSON-like structured payload: +30
- >15 unique fields: +25
- No auth required: +20
- Pagination support: +15
- Extends current output significantly: +10
- **Total: 100**

---

## Supporting Endpoint (Keyword Resolution)

- Endpoint: `https://www.kyero.com/kyero-api/location-suggestions?locale=<locale>&q=<query>`
- Method: `GET`
- Auth: None
- Purpose: Convert keyword/location input into working Kyero search paths (`for_sale_path`, `to_rent_path`)
- Works with plain `gotScraping`: Yes

---

## Rejected Candidates

1. `https://www.kyero.com/kyero-api/en/simple-properties`
- Why rejected: returns non-actionable error payload without required context/parameters; unstable as primary listing source.

2. `https://www.kyero.com/kyero-api/en/popular-searches`
- Why rejected: returns only curated links, not full paginated listing results.

3. HTML page parsing (`https://www.kyero.com/en/<slug>`)
- Why rejected: lower reliability and lower data density than the route data endpoint.

---

## Implementation Notes

- Actor remains API-based using route data and JSON endpoints only.
- Browser automation is not required for current endpoint access with `gotScraping`.
- Null/empty values are removed before dataset push.
