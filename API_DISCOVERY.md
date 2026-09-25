## Selected API

- Endpoint: `https://www.kyero.com/<locale>/<search-slug>.data?_routes=routes/properties/search/routes/index.route&page=<n>`
- Method: `GET`
- Auth: No application auth; the current target also requires a Cloudflare-cleared browser session
- Response type: `text/x-script` packed route payload (decoded in actor)
- Pagination: `page` query parameter, plus `properties.pagination.nextPage` in response
- Required headers:
  - `x-remix-data: yes`
  - `x-requested-with: XMLHttpRequest`
- Optional context header:
  - `referer: <source search page>`
- Browser fingerprint headers:
  - Let the HTTP client generate browser headers; do not manually set `user-agent`, `accept-language`, or `sec-*` headers.
- Runtime transport: Patchright's active browser page fetches this endpoint directly; Impit is no longer used.

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
- Historical Impit validation: requests were later challenged; the actor now calls this endpoint from its Patchright page.

## Current Revalidation (2026-09-24)

The reported actor log shows the location-suggestions request returned HTTP 403, after which the empty suggestion list was surfaced as `No locations found`. The input schema's runtime default is `keyword: "italy"`; without a runtime `urls` value, that default sends the actor through location lookup.

| Candidate | Impit profile / request | Result | Decision |
|---|---|---|---|
| Location suggestions | Impit 0.14.5, `chrome` | HTTP 403, HTML title `Checking your browser`; no JSON results | Blocked by the current Cloudflare challenge |
| Location suggestions | Impit 0.14.5, `chrome151` | HTTP 403, same challenge response | Rejected as a fix; changing the Chrome fingerprint did not help |
| Location suggestions | Impit 0.14.5, `firefox144` | HTTP 403, same challenge response | Rejected as a fix; changing browser family did not help |
| Search route `.data` endpoint | Impit 0.14.5, `chrome`, with the documented `x-remix-data` and `x-requested-with` headers | HTTP 403, HTML challenge instead of packed route data | Also blocked under the tested request context |
| Browser navigation to a listing URL | Patchright 1.63.0, installed Chrome channel (Chrome 154), local direct connection | Initial navigation HTTP 403; after the browser challenge completed, the title became `Kyero` and `cf_clearance` was present | Patchright completed the challenge in this test; this result was not consistent across every run |
| Search route `.data` through browser `fetch` after clearance | Same Patchright context, with `x-remix-data`, `x-requested-with`, and the source page as referer | HTTP 200, `text/x-script`, 57,211-byte packed payload | The browser session could access the existing route endpoint |
| Search route `.data` through Impit after cookie transfer | Impit 0.14.5 profiles `chrome`, `chrome151`, and `firefox144`; same local direct connection, cookie jar, headers, and referer | HTTP 403 HTML challenge for all three profiles | Cookie transfer alone did not make Impit requests acceptable to Kyero |
| Actor URL-mode smoke test | Impit first, followed by the same-origin Patchright fetch after HTTP 403 | Patchright fetch returned route data; actor logged `Saved 1 properties` | Direct-URL mode completed locally through the browser fallback |
| Actor keyword-mode smoke test | Patchright bootstrapped directly on the known location-suggestions URL; Impit first, then Patchright fallback | Challenge cleared; 10 suggestions found; actor logged `Saved 1 properties` | Keyword mode completed locally through the browser fallback |

These tests established that copying browser cookies to Impit did not preserve Kyero access. Their results are historical: the implementation update at the end of this file removes Impit and keeps the browser context as the API transport. The local tests did not use Apify Proxy, so they do not establish whether a production Residential session behaves differently.

## Image Availability

- The selected search API returns preview listing images plus `images_count`.
- A direct comparison with `got-scraping` confirmed the same search API response includes only the preview image URLs, not the full gallery.
- Full galleries require an additional property data request per listing, which can trigger 429 rate limits at scale.
- Current actor behavior: keep extraction fast and smooth by saving all image URLs available in the search API response without making per-property gallery requests.

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

- The actor retains the existing route-data and location-suggestion endpoints, output mapping, and pagination.
- Patchright bootstraps one browser session and performs API requests directly from its same-origin page context.
- A single Residential proxy session and proxy URL are used for browser bootstrap and API requests when Apify Proxy is enabled. The actor does not fall back to direct requests or switch proxy groups.
- Earlier local direct-connection smoke tests succeeded in both URL and keyword modes through Patchright's browser fetch. Apify Residential behavior remains unverified.
- Null/empty values are removed before dataset push.

---

## Fresh Endpoint and Impit Discovery (2026-09-25)

### Actor contract and acceptance criteria

The actor must keep returning its existing property-record fields (including price, property type, bedroom/bathroom counts, areas, agency, images, features, property URL, and search metadata) and stop using Kyero's verified `properties.pagination.nextPage` value. A replacement is acceptable only if a replayable request returns actual listing records with those fields and demonstrable pagination; HTTP 200 or statistics alone is not enough.

### Candidate evidence

| Candidate | Evidence / status | Listing fields | Pagination | Decision |
|---|---|---|---|---|
| `www.kyero.com/kyero-api/location-suggestions` | Direct Impit 0.14.5 tests with `chrome` and `okhttp4` returned HTTP 403 Cloudflare challenge. `ios18` ended with `ConnectError`. | None | Not applicable; location lookup only | Keep as the existing keyword-resolution path; no alternative discovered |
| Search route `.data` (`routes/properties/search/routes/index.route`) | Direct Impit 0.14.5 tests with `chrome` and `okhttp4` returned HTTP 403 challenge. `ios18` ended with `ConnectError`. Prior local Patchright-session evidence in this file returned HTTP 200 packed route data. | Prior verified response contains the actor's property fields | Prior verified response exposes `properties.pagination.nextPage` | Keep as the only currently verified listing source; no replacement selected |
| `data.kyero.com` / `/en/data` | The 2026-08-15 public scan and the 2024-11-12 scan both resolve to `/en/data`; their URLScan transaction views show no listing-data transactions. A direct request during this discovery returned HTTP 403 challenge. | Market-data page, not individual listings | No listing pagination evidenced | Reject for this actor |
| Kyero homepage JSON calls | The 2026-09-06 public scan shows `/kyero-api/en/popular-searches`, `/kyero-api/session`, and `/kyero-api/me`, alongside static assets. These are curated search/account/session responses, not paginated listing records. | No listing records | None evidenced | Reject as listing sources |
| Kyero image and asset hosts | Scans show static JS/CSS/localization assets and property/agency images, not searchable property records. | Images/assets only | None | Reject as primary source |
| Localized/mobile domain variants | No scan or current request evidence identifies an alternate localized or mobile host carrying listing records. | Unknown | Unknown | Not probed; guessing another host would not be evidence-based |
| Current browser navigation to a search URL | This discovery environment received HTTP 403, title `Just a moment...`. Earlier local Patchright runs recorded in this file did clear the challenge and fetch the existing route data, but that behavior is not consistent or a guarantee. | No listing body in the current attempt | Not verified in the current attempt | No new endpoint found |

### Impit 0.14.5 options checked

The installed `node_modules/impit/index.d.ts` defines the supported browser profiles, including `chrome`, `chrome151`, `firefox144`, `okhttp4`, and `ios18`. Fresh direct-connection probes used the `chrome`, `ios18`, and `okhttp4` profiles against both already-evidenced Kyero endpoints (15-second timeout, the endpoint's existing request headers, no proxy). Neither `chrome` nor `okhttp4` changed the result from a Cloudflare 403; `ios18` failed to connect. Earlier probes documented above also had no success with `chrome151` or `firefox144`.

Other relevant declared options do not provide a supported access fix:

- `vanillaFallback` falls back to a vanilla user agent when the selected browser profile is unsupported by a target; it is not a Cloudflare challenge solver and was not enabled without evidence of profile incompatibility.
- `http3` is disabled by default and the package warns that it cannot be used with a proxy. The actor's configured Residential proxy flow therefore should not enable it speculatively.
- `ignoreTlsErrors` only relaxes certificate validation. There is no TLS error in the observed failures, so it would not address the HTTP 403 and should remain off.
- The public Impit declarations expose no HTTP/2-disable option. `timeout`, headers, redirects, proxy URL, and cookie-jar settings affect request mechanics but do not turn a challenge response into listing data.

The actor already requests listing pages through the paginated listing endpoint rather than making per-property detail requests. The implementation update below removes Impit after cookie transfer repeatedly failed; it keeps one Patchright context for the complete search. Apify Residential behavior remains unverified.

### Discovery decision

No less-protected, independently verified listing API was found. Preserve the existing route-data endpoint and output mapping; do not switch to the statistics page, homepage metadata, or an untested Impit profile. Reconsider only after evidence shows a candidate returning property records and a next-page signal under a replayable request. No new public URLScan scan was submitted.

---

## Patchright-Only API Transport Update

The actor now uses Patchright for both session bootstrap and the API requests themselves. It calls the existing location-suggestions JSON endpoint and paginated `.data` listing endpoint with same-origin `fetch` from the active browser page, including the required `x-requested-with` and, for listing data, `x-remix-data` headers. Browser-managed cookies and browser connection state remain in the same context; they are no longer copied to a separate HTTP client's cookie jar.

The listing endpoint, packed-response decoder, property mapping, deduplication, result/page limits, pagination signal, and batch dataset writes are unchanged. Transient status/network retries remain bounded, and browser API calls now have a 30-second timeout. A 403 or detected challenge is reported as an access failure rather than treated as data. The configured Residential proxy session remains attached to the browser context and is reused for its requests.

This change removes the extra Impit request that previously received 403 before the same request was retried in Patchright. It does not guarantee Kyero will clear the challenge on every run. Local Patchright-only smoke tests succeeded for both a direct search URL and the `italy` keyword path, saving one property in each run. Apify Residential behavior remains unverified.

### Apify Residential proxy authentication follow-up (2026-09-25)

A cloud run failed during browser bootstrap with Chromium `net::ERR_INVALID_AUTH_CREDENTIALS`, before any Kyero API request was made. The actor had passed Apify's full credential-bearing proxy URL as Patchright's `proxy.server` value. The browser configuration now separates the proxy address from its decoded username and password, while keeping the same Residential session bound to the browser context. Credentials are not logged, and the actor does not fall back to a direct connection. This code-level correction still requires a cloud run to verify against Apify Residential; it does not establish that Kyero will clear its challenge.

