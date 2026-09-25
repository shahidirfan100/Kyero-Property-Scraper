import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Actor, log } from 'apify';
import { Dataset } from 'crawlee';
import { chromium } from 'patchright';

const KYERO_ORIGIN = 'https://www.kyero.com';
const ROUTE_ID = 'routes/properties/search/routes/index.route';
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 524]);
const MAX_HTTP_ATTEMPTS = 4;
const MAX_SESSION_REFRESHES = 2;

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

function getRetryAfterMs(headers) {
    const retryAfter = headers?.get?.('retry-after');
    if (!retryAfter) return 0;

    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

    const dateMs = Date.parse(retryAfter);
    if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());

    return 0;
}

function getRetryDelayMs(statusCode, attempt, headers) {
    const retryAfterMs = getRetryAfterMs(headers);
    if (retryAfterMs > 0) {
        const maxRetryAfterMs = statusCode === 429 ? 25000 : 8000;
        return Math.min(retryAfterMs, maxRetryAfterMs) + Math.floor(Math.random() * 2500);
    }

    if (statusCode === 429) {
        return Math.min(25000, 3000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 2500);
    }

    return 800 * attempt + Math.floor(Math.random() * 700);
}

function isRetryableError(error) {
    const message = String(error?.message || '').toLowerCase();
    return [
        'timeout',
        'socket',
        'econnreset',
        'etimedout',
        'econnrefused',
        'ehostunreach',
        'enetunreach',
        'enotfound',
        'ecanceled',
        'network',
        'failed to fetch',
        'fetch failed',
        'proxy',
    ].some((word) => message.includes(word));
}


function shouldDisableProxyLocally(proxyConfigInput) {
    if (!proxyConfigInput?.useApifyProxy) return false;
    if (process.env.APIFY_IS_AT_HOME === '1') return false;
    return !process.env.APIFY_PROXY_PASSWORD && !process.env.APIFY_TOKEN;
}

function normalizeProxyConfig(proxyConfigInput) {
    if (!proxyConfigInput?.useApifyProxy) return proxyConfigInput;
    if (Array.isArray(proxyConfigInput.apifyProxyGroups) && proxyConfigInput.apifyProxyGroups.length) {
        return proxyConfigInput;
    }
    return {
        ...proxyConfigInput,
        apifyProxyGroups: ['RESIDENTIAL'],
    };
}

function getProxyGroups(proxyConfigInput) {
    const groups = proxyConfigInput?.apifyProxyGroups ?? proxyConfigInput?.groups;
    return Array.isArray(groups) ? groups : [];
}

function isCloudflareChallenge(body) {
    return /checking your browser|just a moment|__cf_chl|cf-chl|challenge-platform|enable javascript and cookies|attention required/i.test(String(body || ''));
}


function getPatchrightProxySettings(proxyUrl) {
    if (!proxyUrl) return undefined;

    const parsedUrl = new URL(proxyUrl);
    const proxy = { server: `${parsedUrl.protocol}//${parsedUrl.host}` };
    if (parsedUrl.username || parsedUrl.password) {
        proxy.username = decodeURIComponent(parsedUrl.username);
        proxy.password = decodeURIComponent(parsedUrl.password);
    }
    return proxy;
}

async function closeBrowserSession({ browserContext, userDataDir }) {
    try {
        if (browserContext) await browserContext.close();
    } finally {
        if (userDataDir) await rm(userDataDir, { recursive: true, force: true });
    }
}

async function bootstrapKyeroBrowser({ proxyUrl, bootstrapUrl }) {
    const userDataDir = await mkdtemp(join(tmpdir(), 'kyero-patchright-'));
    let browserContext;
    let keepBrowserOpen = false;

    try {
        browserContext = await chromium.launchPersistentContext(userDataDir, {
            channel: 'chrome',
            headless: false,
            noViewport: true,
            ...(proxyUrl && { proxy: getPatchrightProxySettings(proxyUrl) }),
        });
        const page = await browserContext.newPage();
        let navigationResponse;
        try {
            navigationResponse = await page.goto(bootstrapUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        } catch (error) {
            if (proxyUrl && String(error?.message || '').includes('ERR_INVALID_AUTH_CREDENTIALS')) {
                throw new Error('Browser proxy authentication failed. Check Apify Proxy credentials and access to the selected group; no direct connection was attempted.');
            }
            throw error;
        }
        const navigationStatus = navigationResponse?.status();

        try {
            await page.waitForFunction(() => {
                const challenge = /checking your browser|just a moment|enable javascript and cookies|__cf_chl|cf-chl|challenge-platform|attention required/i;
                return !challenge.test(`${document.title} ${document.body?.innerText || ''}`);
            }, null, { timeout: 45000 });
        } catch {
            // Inspect the final page below so the failure can be reported without saving its body.
        }

        const pageState = await page.evaluate(() => ({
            title: document.title,
            body: document.body?.innerText?.slice(0, 500) || '',
            challengeMarkup: /checking your browser|just a moment|__cf_chl|cf-chl|challenge-platform|enable javascript and cookies|attention required/i.test(document.documentElement?.innerHTML || ''),
        }));
        const challengeRemains = pageState.challengeMarkup || isCloudflareChallenge(`${pageState.title} ${pageState.body}`);
        const browserCookies = await browserContext.cookies(KYERO_ORIGIN);
        const hasClearanceCookie = browserCookies.some((cookie) => cookie.name.toLowerCase() === 'cf_clearance');
        if (challengeRemains || (navigationStatus >= 400 && !hasClearanceCookie)) {
            const reason = challengeRemains
                ? 'Kyero browser challenge remained after the bootstrap wait'
                : `Kyero browser bootstrap returned HTTP ${navigationStatus} without a clearance cookie`;
            throw new Error(`${reason}; API requests were not started.`);
        }

        log.info('Patchright browser session is ready for Kyero API requests.');
        keepBrowserOpen = true;
        return { browserContext, browserPage: page, userDataDir };
    } finally {
        if (!keepBrowserOpen) await closeBrowserSession({ browserContext, userDataDir });
    }
}

async function createKyeroBrowserSession({
    proxyConfiguration,
    proxyConfigInput,
    bootstrapUrl,
}) {
    const proxyGroups = getProxyGroups(normalizeProxyConfig(proxyConfigInput));
    const usesUnblocker = proxyGroups.some((group) => String(group).toUpperCase() === 'UNBLOCKER');
    if (proxyConfiguration && usesUnblocker) {
        throw new Error('Kyero browser requests need a stable proxy identity. Select Residential instead of UNBLOCKER.');
    }

    const usesApifyProxy = Boolean(proxyConfigInput?.useApifyProxy) || proxyGroups.length > 0;
    const sessionId = proxyConfiguration && usesApifyProxy
        ? `kyero_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
        : undefined;
    let proxyUrl;
    if (proxyConfiguration) {
        proxyUrl = sessionId
            ? await proxyConfiguration.newUrl(sessionId)
            : await proxyConfiguration.newUrl();
    }

    if (proxyUrl && proxyGroups.includes('RESIDENTIAL')) {
        log.info('Using one Apify Residential session for Patchright bootstrap and API requests.');
    } else if (proxyUrl) {
        log.info('Reusing the configured proxy URL for Patchright bootstrap and API requests.');
    }

    const browserSession = await bootstrapKyeroBrowser({ proxyUrl, bootstrapUrl });
    return {
        proxyConfiguration,
        proxyConfigInput,
        bootstrapUrl,
        proxyUrl,
        ...browserSession,
        refreshCount: 0,
    };
}

async function refreshKyeroBrowserSession(session) {
    const refreshCount = session.refreshCount + 1;
    const refreshedSession = await createKyeroBrowserSession(session);
    const previousBrowserSession = {
        browserContext: session.browserContext,
        userDataDir: session.userDataDir,
    };
    Object.assign(session, refreshedSession, { refreshCount });
    await closeBrowserSession(previousBrowserSession);
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

function normalizePropertyImageUrls(images) {
    if (!Array.isArray(images)) return [];
    return [...new Set(images.filter((image) => typeof image === 'string' && image.trim()).map((image) => {
        return image.trim().replace('/crop/480x320/', '/crop/960x720/');
    }))];
}

async function fetchKyeroFromPatchright({ url, session, referer, remixData }) {
    const targetUrl = url.toString();
    const targetOrigin = new URL(targetUrl).origin;
    const pageOrigin = new URL(session.browserPage.url()).origin;
    if (targetOrigin !== pageOrigin) {
        throw new Error(`Patchright session cannot fetch cross-origin URL: ${targetOrigin}`);
    }

    const headers = {
        'x-requested-with': 'XMLHttpRequest',
        ...(remixData ? { 'x-remix-data': 'yes' } : {}),
    };
    const response = await session.browserPage.evaluate(async ({ targetUrl: fetchUrl, requestHeaders, requestReferer, timeoutMs }) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const result = await fetch(fetchUrl, {
                method: 'GET',
                credentials: 'include',
                headers: requestHeaders,
                signal: controller.signal,
                ...(requestReferer ? { referrer: requestReferer } : {}),
            });
            const body = await result.text();
            const cloudflareChallenge = /checking your browser|just a moment|__cf_chl|cf-chl|challenge-platform|enable javascript and cookies|attention required/i.test(body);
            return {
                statusCode: result.status,
                contentType: result.headers.get('content-type') || '',
                body,
                retryAfter: result.headers.get('retry-after'),
                isCloudflareChallenge: cloudflareChallenge,
            };
        } catch (error) {
            if (controller.signal.aborted) throw new Error(`Kyero API request timed out after ${timeoutMs}ms.`);
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }, { targetUrl, requestHeaders: headers, requestReferer: referer, timeoutMs: 30000 });

    return response;
}

async function requestUrl({
    url,
    session,
    referer,
    remixData = false,
}) {
    let lastError;

    for (let attempt = 1; attempt <= MAX_HTTP_ATTEMPTS; attempt++) {
        try {
            const response = await fetchKyeroFromPatchright({ url, session, referer, remixData });
            if (
                response.statusCode === 403
                || response.isCloudflareChallenge
                || !RETRYABLE_STATUS_CODES.has(response.statusCode)
                || attempt >= MAX_HTTP_ATTEMPTS
            ) {
                return response;
            }

            const retryHeaders = { get: (name) => name.toLowerCase() === 'retry-after' ? response.retryAfter : undefined };
            const waitMs = getRetryDelayMs(response.statusCode, attempt, retryHeaders);
            log.warning(`Kyero returned temporary HTTP ${response.statusCode}; retrying in ${Math.round(waitMs / 1000)}s.`, { attempt });
            await sleep(waitMs);

            const needsNewSession = [502, 520, 521, 522, 524].includes(response.statusCode);
            if (needsNewSession && session.refreshCount < MAX_SESSION_REFRESHES) {
                await refreshKyeroBrowserSession(session);
            }
        } catch (error) {
            lastError = error;
            if (attempt >= MAX_HTTP_ATTEMPTS || !isRetryableError(error)) throw error;

            const waitMs = 800 * attempt + Math.floor(Math.random() * 700);
            log.warning(`Temporary Kyero browser/network error; retrying in ${Math.round(waitMs / 1000)}s.`, { attempt });
            await sleep(waitMs);
            if (session.refreshCount < MAX_SESSION_REFRESHES) {
                await refreshKyeroBrowserSession(session);
            }
        }
    }

    throw lastError ?? new Error(`Request failed for ${url.toString()}`);
}

async function fetchLocationSuggestions({ query, locale, session }) {
    const endpoint = new URL('/kyero-api/location-suggestions', KYERO_ORIGIN);
    endpoint.searchParams.set('locale', locale);
    endpoint.searchParams.set('q', query);

    const response = await requestUrl({
        url: endpoint,
        session,
        referer: `${KYERO_ORIGIN}/${locale}/`,
    });

    if (response.statusCode === 403 || response.isCloudflareChallenge) {
        const reason = response.isCloudflareChallenge ? 'Cloudflare browser challenge' : 'access denied';
        const message = `Kyero returned HTTP ${response.statusCode} from Patchright (${reason}) for location suggestions.`;
        log.warning(message, { query, locale });
        throw new Error(message);
    }

    if (response.statusCode !== 200) {
        log.warning(`Location suggestions failed with status ${response.statusCode}`, { query, locale });
        return [];
    }
    if (!response.contentType.toLowerCase().includes('json')) {
        log.warning('Location suggestions returned a non-JSON response.', { query, locale });
        return [];
    }

    try {
        const data = JSON.parse(response.body);
        if (!Array.isArray(data?.results)) {
            log.warning('Location suggestions response did not contain a results array.', { query, locale });
            return [];
        }
        return data.results;
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
    session,
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
                session,
                referer: baseUrl.toString(),
                remixData: true,
            });
        } catch (error) {
            log.warning(`Search request failed after retries: ${error.message}`, { dataUrl: dataUrl.toString() });
            break;
        }

        if (response.statusCode === 403 || response.isCloudflareChallenge) {
            const reason = response.isCloudflareChallenge ? 'Cloudflare challenge' : 'access denied';
            const error = new Error(`Kyero returned HTTP ${response.statusCode} from Patchright (${reason}) for the search endpoint.`);
            error.code = 'KYERO_ACCESS_DENIED';
            throw error;
        }
        if (response.statusCode !== 200) {
            log.warning(`Search request failed (HTTP ${response.statusCode}).`, { dataUrl: dataUrl.toString() });
            break;
        }
        const contentType = response.contentType.toLowerCase();
        if (!contentType.includes('x-script') && !contentType.includes('json')) {
            log.warning('Search request returned an unexpected content type.', { dataUrl: dataUrl.toString() });
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
                images: normalizePropertyImageUrls(item.images),
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
        proxyConfiguration = await Actor.createProxyConfiguration(normalizeProxyConfig(proxyConfigInput));
    }
    if (!proxyConfiguration && proxyConfigInput?.useApifyProxy) {
        log.info('Apify Proxy disabled for this local run (missing local credentials).');
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
    if (rawInputUrls.length && !searchUrls.length) {
        throw new Error('No valid search URLs were provided in "urls".');
    }

    const queryCandidates = [];
    if (!rawInputUrls.length) {
        if (trimmedLocation) queryCandidates.push(trimmedLocation);
        if (trimmedKeyword) queryCandidates.push(trimmedKeyword);
        if (trimmedKeyword && trimmedLocation) queryCandidates.push(`${trimmedKeyword} ${trimmedLocation}`);
    }
    const uniqueCandidates = [...new Set(queryCandidates.map((query) => query.trim()).filter(Boolean))];
    if (!rawInputUrls.length && !uniqueCandidates.length) {
        throw new Error('Provide either "urls" or at least one of "keyword"/"location".');
    }

    let bootstrapUrl = searchUrls[0]?.toString();
    if (!bootstrapUrl) {
        const suggestionsUrl = new URL('/kyero-api/location-suggestions', KYERO_ORIGIN);
        suggestionsUrl.searchParams.set('locale', locale);
        suggestionsUrl.searchParams.set('q', uniqueCandidates[0]);
        bootstrapUrl = suggestionsUrl.toString();
    }
    const session = await createKyeroBrowserSession({
        proxyConfiguration,
        proxyConfigInput,
        bootstrapUrl,
    });

    try {
        if (!rawInputUrls.length) {
            let suggestions = [];
            let matchedQuery = '';
            for (const query of uniqueCandidates) {
                suggestions = await fetchLocationSuggestions({ query, locale, session });
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
                    session,
                    seenKeys,
                    savedCount,
                });
            } catch (error) {
                if (error.code === 'KYERO_ACCESS_DENIED') throw error;
                log.warning(`Skipping failed search URL: ${error.message}`, { searchUrl: searchUrl.toString() });
            }
        }

        log.info(`Finished. Saved ${savedCount} properties.`);
    } finally {
        await closeBrowserSession(session);
    }
});
