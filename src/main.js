import { Actor, log } from 'apify';
import { Dataset } from 'crawlee';
import { gotScraping } from 'got-scraping';

const KYERO_ORIGIN = 'https://www.kyero.com';
const ROUTE_ID = 'routes/properties/search/routes/index.route';
const SEARCH_DATA_ACCEPT = 'text/x-script, text/plain, application/json, */*';
const JSON_ACCEPT = 'application/json, text/plain, */*';
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 524]);
const MAX_HTTP_ATTEMPTS = 4;

function normalizeList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim());
    if (typeof value === 'string' && value.trim()) return [value.trim()];
    return [];
}

function normalizeLocale(value) {
    const locale = typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : 'en';
    return locale.slice(0, 2);
}

function normalizeListingType(value) {
    const type = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return type === 'to_rent' ? 'to_rent' : 'for_sale';
}

function normalizePositiveInt(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(1, Math.floor(number));
}

function buildAbsoluteUrl(pathOrUrl) {
    if (!pathOrUrl) return undefined;
    try {
        return new URL(pathOrUrl, KYERO_ORIGIN).href;
    } catch {
        return undefined;
    }
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function isRetryableError(error) {
    const message = String(error?.message || '').toLowerCase();
    return [
        'timeout',
        'socket',
        'econnreset',
        'etimedout',
        'econnrefused',
        'ecanceled',
        'network',
    ].some((word) => message.includes(word));
}

function isProxyFailureMessage(message) {
    const text = String(message || '').toLowerCase();
    return text.includes('proxy.apify.com')
        || text.includes('407')
        || text.includes('enotfound')
        || text.includes('proxy');
}

function shouldDisableProxyLocally(proxyConfigInput) {
    if (!proxyConfigInput?.useApifyProxy) return false;
    if (process.env.APIFY_IS_AT_HOME === '1') return false;
    return !process.env.APIFY_PROXY_PASSWORD && !process.env.APIFY_TOKEN;
}

function prepareSearchUrl(inputUrl, locale) {
    const url = new URL(inputUrl, `${KYERO_ORIGIN}/${locale}/`);
    if (!url.hostname.endsWith('kyero.com')) throw new Error(`Unsupported URL host: ${url.hostname}`);

    url.hash = '';
    if (url.pathname.endsWith('.data')) {
        url.pathname = url.pathname.slice(0, -5);
    }
    return url;
}

function buildSearchDataUrl(searchUrl, page) {
    const url = new URL(searchUrl.href);
    const normalizedPath = url.pathname.replace(/\/+$/, '');
    url.pathname = `${normalizedPath}.data`;

    if (page > 1) url.searchParams.set('page', String(page));
    else url.searchParams.delete('page');
    url.searchParams.set('_routes', ROUTE_ID);
    return url;
}

function decodePackedResponse(body) {
    const table = JSON.parse(body);
    const cache = new Map();

    function decodeRefOrValue(value) {
        if (typeof value === 'number') {
            if (value === -5 || value === -7) return undefined;
            if (Number.isInteger(value) && value >= 0 && value < table.length) return decodeRef(value);
            return value;
        }
        return decodeEntry(value);
    }

    function decodeEntry(entry) {
        if (Array.isArray(entry)) {
            const output = [];
            for (const item of entry) {
                const decoded = decodeRefOrValue(item);
                if (decoded !== undefined) output.push(decoded);
            }
            return output;
        }

        if (entry && typeof entry === 'object') {
            const output = {};
            for (const [rawKey, rawValue] of Object.entries(entry)) {
                const key = /^_\d+$/.test(rawKey) ? decodeRef(Number(rawKey.slice(1))) : rawKey;
                const value = decodeRefOrValue(rawValue);
                if (value !== undefined) output[key] = value;
            }
            return output;
        }

        return entry;
    }

    function decodeRef(index) {
        if (cache.has(index)) return cache.get(index);
        cache.set(index, null);
        const decoded = decodeEntry(table[index]);
        cache.set(index, decoded);
        return decoded;
    }

    return decodeRef(0);
}

function extractSearchPayloadFromPacked(body) {
    const decodedRoot = decodePackedResponse(body);
    const candidate = decodedRoot?.[ROUTE_ID] ?? Object.values(decodedRoot || {}).find((value) => {
        return value?.data?.data?.properties?.items;
    });
    const payload = candidate?.data?.data;
    if (!payload?.properties?.items || !payload?.properties?.pagination) {
        throw new Error('Unable to decode Kyero search payload.');
    }
    return payload;
}

async function requestUrl({
    url,
    proxyConfiguration,
    referer,
    accept,
    remixData = false,
}) {
    let lastError;
    let useProxy = Boolean(proxyConfiguration);

    for (let attempt = 1; attempt <= MAX_HTTP_ATTEMPTS; attempt++) {
        const proxyUrl = useProxy ? await proxyConfiguration.newUrl() : undefined;
        try {
            const response = await gotScraping({
                url: url.toString(),
                proxyUrl,
                throwHttpErrors: false,
                timeout: { request: 30000 },
                headers: {
                    accept,
                    'accept-language': 'en-US,en;q=0.9',
                    'x-requested-with': 'XMLHttpRequest',
                    ...(remixData ? { 'x-remix-data': 'yes' } : {}),
                    ...(referer ? { referer } : {}),
                },
            });

            if (response.statusCode === 407 && useProxy) {
                useProxy = false;
                log.warning('Proxy authentication failed (407). Retrying without proxy.', { url: url.toString() });
                continue;
            }

            if (RETRYABLE_STATUS_CODES.has(response.statusCode) && attempt < MAX_HTTP_ATTEMPTS) {
                const waitMs = 600 * attempt + Math.floor(Math.random() * 400);
                log.warning(`Retryable status ${response.statusCode}, retrying in ${waitMs}ms`, { url: url.toString(), attempt });
                await sleep(waitMs);
                continue;
            }

            return response;
        } catch (error) {
            lastError = error;
            if (useProxy && isProxyFailureMessage(error?.message)) {
                useProxy = false;
                log.warning(`Proxy failed, retrying without proxy: ${error.message}`, { url: url.toString(), attempt });
                continue;
            }
            if (attempt >= MAX_HTTP_ATTEMPTS || !isRetryableError(error)) throw error;
            const waitMs = 600 * attempt + Math.floor(Math.random() * 400);
            log.warning(`Retryable request error, retrying in ${waitMs}ms: ${error.message}`, { url: url.toString(), attempt });
            await sleep(waitMs);
        }
    }

    throw lastError ?? new Error(`Request failed for ${url.toString()}`);
}

async function fetchLocationSuggestions({ query, locale, proxyConfiguration }) {
    const endpoint = new URL('/kyero-api/location-suggestions', KYERO_ORIGIN);
    endpoint.searchParams.set('locale', locale);
    endpoint.searchParams.set('q', query);

    const response = await requestUrl({
        url: endpoint,
        proxyConfiguration,
        accept: JSON_ACCEPT,
        referer: `${KYERO_ORIGIN}/${locale}/`,
    });

    if (response.statusCode !== 200) {
        log.warning(`Location suggestions failed with status ${response.statusCode}`, { query, locale });
        return [];
    }

    try {
        const data = JSON.parse(response.body);
        return Array.isArray(data?.results) ? data.results : [];
    } catch (error) {
        log.warning(`Failed to parse location suggestions JSON: ${error.message}`, { query, locale });
        return [];
    }
}

function pruneNullish(value) {
    if (value === null || value === undefined || value === '') return undefined;

    if (Array.isArray(value)) {
        const cleaned = value
            .map((item) => pruneNullish(item))
            .filter((item) => item !== undefined);
        return cleaned.length ? cleaned : undefined;
    }

    if (typeof value === 'object') {
        const cleanedObject = {};
        for (const [key, item] of Object.entries(value)) {
            const cleaned = pruneNullish(item);
            if (cleaned !== undefined) cleanedObject[key] = cleaned;
        }
        return Object.keys(cleanedObject).length ? cleanedObject : undefined;
    }

    return value;
}

async function collectFromSearchUrl({
    searchUrl,
    locale,
    resultsWanted,
    maxPages,
    proxyConfiguration,
    seenKeys,
    savedCount,
}) {
    const baseUrl = new URL(searchUrl.href);
    const initialPage = normalizePositiveInt(baseUrl.searchParams.get('page') || 1, 1);
    let page = initialPage;
    let processedPages = 0;
    let saved = savedCount;

    while (processedPages < maxPages && saved < resultsWanted) {
        const dataUrl = buildSearchDataUrl(baseUrl, page);
        let response;
        try {
            response = await requestUrl({
                url: dataUrl,
                proxyConfiguration,
                referer: baseUrl.toString(),
                accept: SEARCH_DATA_ACCEPT,
                remixData: true,
            });
        } catch (error) {
            log.warning(`Search request failed after retries: ${error.message}`, { dataUrl: dataUrl.toString() });
            break;
        }

        if (response.statusCode !== 200) {
            log.warning(`Search request failed (${response.statusCode})`, { dataUrl: dataUrl.toString() });
            break;
        }

        let payload;
        try {
            payload = extractSearchPayloadFromPacked(response.body);
        } catch (error) {
            log.warning(`Failed to decode Kyero response: ${error.message}`, { dataUrl: dataUrl.toString() });
            break;
        }

        const items = payload.properties.items || [];
        if (!items.length) break;

        const records = [];
        for (const item of items) {
            if (saved >= resultsWanted) break;

            const propertyUrl = buildAbsoluteUrl(item.path);
            const uniqueKey = String(item.id ?? propertyUrl ?? `${baseUrl.toString()}::${page}`);
            if (seenKeys.has(uniqueKey)) continue;

            seenKeys.add(uniqueKey);
            const record = pruneNullish({
                ...item,
                property_url: propertyUrl,
                search_url: baseUrl.toString(),
                page,
                locale: payload.urlParams?.locale ?? locale,
                location_name: payload.location?.name,
                search_title: payload.title,
                fetched_at: new Date().toISOString(),
            });

            if (record) {
                records.push(record);
                saved++;
            }
        }

        if (records.length) await Dataset.pushData(records);

        processedPages++;
        const nextPage = Number(payload.properties.pagination?.nextPage || 0);
        if (!nextPage || nextPage <= page) break;
        page = nextPage;
    }

    return saved;
}

await Actor.main(async () => {
    const input = (await Actor.getInput()) || {};

    const {
        urls = [],
        keyword = '',
        location = '',
        listing_type: listingTypeInput = 'for_sale',
        locale: inputLocale = 'en',
        results_wanted: resultsWantedInput = 20,
        max_pages: maxPagesInput = 3,
        proxyConfiguration: proxyConfigInput,
    } = input;

    const locale = normalizeLocale(inputLocale);
    const listingType = normalizeListingType(listingTypeInput);
    const resultsWanted = normalizePositiveInt(resultsWantedInput, 20);
    const maxPages = normalizePositiveInt(maxPagesInput, 3);
    const trimmedKeyword = typeof keyword === 'string' ? keyword.trim() : '';
    const trimmedLocation = typeof location === 'string' ? location.trim() : '';

    let proxyConfiguration;
    if (proxyConfigInput && !shouldDisableProxyLocally(proxyConfigInput)) {
        proxyConfiguration = await Actor.createProxyConfiguration(proxyConfigInput);
    }
    if (!proxyConfiguration && proxyConfigInput?.useApifyProxy) {
        log.warning('Apify Proxy disabled for this run (missing local credentials).');
    }

    const rawInputUrls = normalizeList(urls);
    let searchUrls = [];
    for (const inputUrl of rawInputUrls) {
        try {
            searchUrls.push(prepareSearchUrl(inputUrl, locale));
        } catch (error) {
            log.warning(`Skipping invalid URL "${inputUrl}": ${error.message}`);
        }
    }

    if (!searchUrls.length) {
        const queryCandidates = [];
        if (trimmedLocation) queryCandidates.push(trimmedLocation);
        if (trimmedKeyword) queryCandidates.push(trimmedKeyword);
        if (trimmedKeyword && trimmedLocation) queryCandidates.push(`${trimmedKeyword} ${trimmedLocation}`);

        const uniqueCandidates = [...new Set(queryCandidates.map((q) => q.trim()).filter(Boolean))];
        if (!uniqueCandidates.length) throw new Error('Provide either "urls" or at least one of "keyword"/"location".');

        let suggestions = [];
        let matchedQuery = '';
        for (const query of uniqueCandidates) {
            suggestions = await fetchLocationSuggestions({ query, locale, proxyConfiguration });
            if (suggestions.length) {
                matchedQuery = query;
                break;
            }
        }
        if (!suggestions.length) throw new Error(`No locations found for query candidates: ${uniqueCandidates.join(', ')}.`);
        log.info(`Keyword discovery matched "${matchedQuery}" with ${suggestions.length} suggestion(s).`);

        const pathKey = listingType === 'to_rent' ? 'to_rent_path' : 'for_sale_path';
        const selectedSuggestions = trimmedLocation ? suggestions.slice(0, 1) : suggestions;
        searchUrls = selectedSuggestions
            .map((suggestion) => suggestion[pathKey])
            .filter((path) => typeof path === 'string' && path.trim())
            .map((path) => prepareSearchUrl(buildAbsoluteUrl(path), locale));
        if (!searchUrls.length) throw new Error(`No valid "${pathKey}" paths found for query discovery.`);
    }

    const uniqueUrls = [...new Map(searchUrls.map((url) => [url.toString(), url])).values()];
    const seenKeys = new Set();
    let savedCount = 0;

    log.info(`Starting Kyero API crawl for ${uniqueUrls.length} URL(s).`);

    for (const searchUrl of uniqueUrls) {
        if (savedCount >= resultsWanted) break;
        try {
            savedCount = await collectFromSearchUrl({
                searchUrl,
                locale,
                resultsWanted,
                maxPages,
                proxyConfiguration,
                seenKeys,
                savedCount,
            });
        } catch (error) {
            log.warning(`Skipping failed search URL: ${error.message}`, { searchUrl: searchUrl.toString() });
        }
    }

    log.info(`Finished. Saved ${savedCount} properties.`);
});
