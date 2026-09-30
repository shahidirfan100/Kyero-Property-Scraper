import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { assertLocalProxyCredentials, DEFAULT_PROXY_CONFIGURATION, resolveProxyConfig } from '../src/proxy.js';

const actor = JSON.parse(readFileSync(new URL('../.actor/actor.json', import.meta.url), 'utf8'));
const schema = JSON.parse(readFileSync(new URL(`../.actor/${actor.input}`, import.meta.url), 'utf8'));

test('Store input has one search prefill paired with its runtime default', () => {
    const prefills = Object.entries(schema.properties).filter(([, property]) => Object.hasOwn(property, 'prefill'));
    assert.equal(prefills.length, 1);
    const [key, property] = prefills[0];
    assert.equal(key, 'keyword');
    assert.deepEqual(property.prefill, property.default);
    assert.ok(!schema.required.includes(key));
    assert.equal(schema.properties.results_wanted.default, 20);
    assert.equal(schema.properties.max_pages.default, 3);
});

test('omitted proxy uses the documented Residential default, including Store input', () => {
    assert.deepEqual(resolveProxyConfig(undefined), DEFAULT_PROXY_CONFIGURATION);
    assert.deepEqual(schema.properties.proxyConfiguration.default, DEFAULT_PROXY_CONFIGURATION);
    const storeInput = Object.fromEntries(Object.entries(schema.properties)
        .filter(([, property]) => Object.hasOwn(property, 'prefill'))
        .map(([key, property]) => [key, property.prefill]));
    assert.equal(storeInput.keyword, 'italy');
    assert.deepEqual(resolveProxyConfig(storeInput.proxyConfiguration), DEFAULT_PROXY_CONFIGURATION);
});

test('explicit disabled, custom and group-selected proxies are not replaced', () => {
    for (const input of [null, {}, { useApifyProxy: false }, { proxyUrls: ['http://localhost:8000'] },
        { useApifyProxy: true, apifyProxyGroups: ['CUSTOM_GROUP'] }]) {
        assert.equal(resolveProxyConfig(input), input);
    }
});

test('defaults are not shared mutable objects between runs', () => {
    const config = resolveProxyConfig(undefined);
    config.apifyProxyGroups.push('OTHER');
    assert.deepEqual(resolveProxyConfig(undefined), DEFAULT_PROXY_CONFIGURATION);
});

test('a configured local Apify Proxy is never silently disabled', () => {
    assert.throws(() => assertLocalProxyCredentials(DEFAULT_PROXY_CONFIGURATION, {}), /local credentials are missing/);
    for (const env of [{ APIFY_TOKEN: 'test-token' }, { APIFY_PROXY_PASSWORD: 'test-password' }, { APIFY_IS_AT_HOME: '1' }]) {
        assert.doesNotThrow(() => assertLocalProxyCredentials(DEFAULT_PROXY_CONFIGURATION, env));
    }
    assert.doesNotThrow(() => assertLocalProxyCredentials({ useApifyProxy: false }, {}));
    assert.doesNotThrow(() => assertLocalProxyCredentials({ proxyUrls: ['http://localhost:8000'] }, {}));
});
