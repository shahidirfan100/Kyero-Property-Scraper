export const DEFAULT_PROXY_CONFIGURATION = {
    useApifyProxy: true,
    apifyProxyGroups: ['RESIDENTIAL'],
};

export function resolveProxyConfig(value) {
    return value === undefined ? structuredClone(DEFAULT_PROXY_CONFIGURATION) : value;
}

export function assertLocalProxyCredentials(proxyConfig, env = process.env) {
    if (!proxyConfig?.useApifyProxy || env.APIFY_IS_AT_HOME === '1') return;
    if (env.APIFY_PROXY_PASSWORD || env.APIFY_TOKEN) return;
    throw new Error('Apify Proxy is enabled but local credentials are missing. Set APIFY_TOKEN or APIFY_PROXY_PASSWORD, or explicitly set proxyConfiguration.useApifyProxy to false for a direct-connection test. Kyero may block direct connections; the Actor will not silently disable your proxy.');
}
