const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const source = readFileSync(path.join(__dirname, '../novel-translator.user.js'), 'utf8');

function memoryResponse(translation) {
    return {
        status: 200,
        responseText: JSON.stringify({
            responseStatus: 200,
            responseData: { translatedText: translation }
        })
    };
}

function element(failed = false) {
    const classes = new Set(failed ? ['novel-translation-failed'] : []);
    return {
        nodeType: 1, isConnected: true, dataset: {}, style: {}, textContent: '',
        classList: {
            add: (name) => classes.add(name),
            remove: (name) => classes.delete(name),
            contains: (name) => classes.has(name),
            toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); }
        },
        setAttribute() {}, removeAttribute() {}, addEventListener() {}, remove() {},
        insertAdjacentElement() {}
    };
}

function harness() {
    const storage = new Map();
    const timers = new Map();
    const root = element();
    root.dataset.tlVisible = '1';
    const toggle = element();
    const nodes = [element()];
    const toast = element();
    const requests = [];
    let nextTimer = 0;
    const context = vm.createContext({
        URL, URLSearchParams, TextEncoder, console,
        GM_getValue: (key, fallback) => storage.has(key) ? storage.get(key) : fallback,
        GM_setValue: (key, value) => storage.set(key, value),
        GM_log() {},
        GM_xmlhttpRequest: (details) => requests.push(details),
        window: {
            location: { href: 'https://www.qidian.com/chapter/1/2/' },
            setTimeout: (callback) => { timers.set(++nextTimer, callback); return nextTimer; },
            clearTimeout: (id) => timers.delete(id)
        },
        document: {
            readyState: 'loading', addEventListener() {},
            getElementById: (id) => ({
                'novel-translator-ui': root,
                'novel-translator-toggle-button': toggle,
                'novel-translator-toast': toast
            })[id] || null,
            querySelectorAll: () => nodes,
            createElement: () => element()
        }
    });
    // Expose lexical functions only inside this test VM; the distributed script stays standalone.
    vm.runInContext(source.replace(/\}\)\(\);\s*$/, `
        globalThis.api = { DEFAULT_SETTINGS, getCacheKey, readCache, writeCache,
            retrySegment, applyTranslationVisibility, clearTranslation, scheduleAutoNext,
            translateChapter, decodeFanqieText, splitByUtf8Bytes, decodeTranslationEntities,
            setSession(value) { session = value; },
            setAdapter(value) { adapters.unshift(value); }
        };
    })();`), context);
    const api = context.api;
    const settings = { ...api.DEFAULT_SETTINGS };
    const session = {
        settings, chapterUrl: context.window.location.href,
        cacheKey: api.getCacheKey(settings),
        sourceTexts: ['原文'], translations: [null],
        segments: [{ element: element(), text: '原文' }], container: element()
    };
    api.setSession(session);
    return { api, settings, session, context, storage, timers, root, nodes, requests };
}

test('Fanqie private-use characters decode before translation', () => {
    const { api } = harness();
    const paragraph = element();
    paragraph.parentElement = {
        nodeType: 1,
        className: 'muye-reader-box font-DNMrHsV173Pd4pgy',
        parentElement: null
    };
    assert.equal(
        api.decodeFanqieText('番茄读朋：', paragraph),
        '番茄小说的读者朋友们：'
    );
    assert.equal(api.decodeFanqieText('普通中文无需解码', paragraph), '普通中文无需解码');
});

test('free translation chunks stay within the MyMemory byte limit', () => {
    const { api } = harness();
    const sourceText = '这是一段用于测试长文本拆分的中文小说内容。'.repeat(50);
    const chunks = Array.from(api.splitByUtf8Bytes(sourceText, 450));
    assert.equal(chunks.join(''), sourceText);
    assert.ok(chunks.length > 1);
    chunks.forEach((chunk) => assert.ok(new TextEncoder().encode(chunk).length <= 450));
    assert.equal(
        api.decodeTranslationEntities('&quot;Hi&#39;s&#x20;&amp;&lt;&gt;'),
        '"Hi\'s &<>'
    );
});

test('cache separates chapter query, host, language, engine, model and endpoint', () => {
    const { api, settings, context } = harness();
    const base = 'https://www.jjwxc.net/onebook.php?novelid=1&chapterid=1';
    context.window.location.href = base;
    api.writeCache(['原文'], ['translation'], settings);
    assert.deepEqual(Array.from(api.readCache(['原文'], settings)), ['translation']);
    assert.equal(api.readCache(['修改的原文'], settings), null);
    const llm = { ...settings, engine: 'llm' };
    const keys = [
        api.getCacheKey(settings, base),
        api.getCacheKey(settings, base.replace('chapterid=1', 'chapterid=2')),
        api.getCacheKey(settings, base.replace('www.jjwxc.net', 'fanqienovel.com')),
        api.getCacheKey({ ...settings, targetLang: 'ja' }, base),
        api.getCacheKey(llm, base),
        api.getCacheKey({ ...llm, model: 'another-model' }, base),
        api.getCacheKey({ ...llm, apiUrl: 'https://example.com/v1/chat/completions' }, base)
    ];
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(api.readCache(['原文'], llm), null);
    assert.equal(api.getCacheKey({ ...llm, apiKey: 'secret' }, base), api.getCacheKey(llm, base));
    assert.equal(api.getCacheKey(settings, base + '#anchor'), keys[0]);
});

test('old, corrupt and incomplete caches are ignored', () => {
    const { api, settings, storage } = harness();
    storage.set('cache_/chapter/1/2/', JSON.stringify({ targetLang: 'en', sourceTexts: ['原文'], translations: ['old'] }));
    assert.equal(api.readCache(['原文'], settings), null);
    storage.set(api.getCacheKey(settings), '{invalid');
    assert.equal(api.readCache(['原文'], settings), null);
    api.writeCache(['原文'], [null], settings);
    assert.equal(api.readCache(['原文'], settings), null);
});

test('captured cache key keeps writes on the original chapter', () => {
    const { api, settings, context } = harness();
    const key = api.getCacheKey(settings);
    context.window.location.href = 'https://www.qidian.com/chapter/1/3/';
    api.writeCache(['原文'], ['translated'], settings, key);
    assert.equal(api.readCache(['原文'], settings), null);
    assert.equal(api.readCache(['原文'], settings, key)[0], 'translated');
});

for (const paragraphElements of [true, false]) {
    test(`translations-only toggle restores originals (${paragraphElements ? 'paragraphs' : 'container'})`, () => {
        const { api, session, root, nodes } = harness();
        session.settings.displayMode = 'translations-only';
        if (!paragraphElements) session.segments[0].element = null;
        const original = paragraphElements ? session.segments[0].element : session.container;
        api.applyTranslationVisibility();
        assert.equal(original.classList.contains('nt-hidden-source'), true);
        root.dataset.tlVisible = '0';
        api.applyTranslationVisibility();
        assert.equal(original.classList.contains('nt-hidden-source'), false);
        assert.equal(nodes[0].style.display, 'none');
        root.dataset.tlVisible = '1';
        api.applyTranslationVisibility();
        assert.equal(original.classList.contains('nt-hidden-source'), true);
        assert.equal(nodes[0].style.display, '');
    });
}

test('successful retry updates cache and cannot submit again on click', async () => {
    const { api, session, requests, settings, context } = harness();
    const node = element(true);
    const pending = api.retrySegment(session, 0, node);
    await api.retrySegment(session, 0, node);
    assert.equal(requests.length, 1);
    requests[0].onload(memoryResponse('Translated'));
    await pending;
    assert.equal(node.textContent, 'Translated');
    assert.equal(node.classList.contains('novel-translation-failed'), false);
    assert.equal(api.readCache(['原文'], settings)[0], 'Translated');
    await api.retrySegment(session, 0, node);
    assert.equal(requests.length, 1);
});

for (const staleReason of ['session', 'navigation', 'detached']) {
    test(`late retry cannot update stale ${staleReason}`, async () => {
        const { api, session, context, requests, storage } = harness();
        const node = element(true);
        const pending = api.retrySegment(session, 0, node);
        if (staleReason === 'session') api.setSession(null);
        if (staleReason === 'navigation') context.window.location.href += '?other=1';
        if (staleReason === 'detached') node.isConnected = false;
        requests[0].onload(memoryResponse('Late result'));
        await pending;
        assert.equal(session.translations[0], null);
        assert.equal(storage.size, 0);
        assert.notEqual(node.textContent, 'Late result');
    });
}

test('starting another translation cancels pending auto-next navigation', () => {
    const { api, settings, timers } = harness();
    settings.autoNext = true;
    api.scheduleAutoNext({ getNextUrl: () => 'https://www.qidian.com/chapter/1/3/' }, settings);
    const scheduled = [...timers.keys()].at(-1);
    api.clearTranslation();
    assert.equal(timers.has(scheduled), false);
});

test('auto-next ignores a callback belonging to a previous chapter', () => {
    const { api, settings, timers, context, storage } = harness();
    settings.autoNext = true;
    storage.set('settings', settings);
    api.scheduleAutoNext({ getNextUrl: () => 'https://www.qidian.com/chapter/1/3/' }, settings);
    const callback = [...timers.values()].at(-1);
    context.window.location.href = 'https://www.qidian.com/chapter/1/9/';
    callback();
    assert.equal(context.window.location.href, 'https://www.qidian.com/chapter/1/9/');
    assert.equal(storage.has('autoTarget'), false);
});

test('a complete chapter uses its cache on the next translation', async () => {
    const { api, session, requests, settings, context } = harness();
    api.setAdapter({
        match: /qidian/, getContainer: () => session.container,
        getContent: () => session.segments
    });
    context.document.readyState = 'complete';
    const button = element();
    const pending = api.translateChapter(button);
    await new Promise(setImmediate);
    requests[0].onload(memoryResponse('Chapter translation'));
    await pending;
    assert.equal(api.readCache(session.sourceTexts, settings)[0], 'Chapter translation');
    await api.translateChapter(button);
    assert.equal(requests.length, 1);
    assert.equal(button.disabled, false);
});

test('chapter navigation during a request discards the result', async () => {
    const { api, session, requests, context, storage } = harness();
    api.setAdapter({
        match: /qidian/, getContainer: () => session.container,
        getContent: () => session.segments
    });
    context.document.readyState = 'complete';
    const button = element();
    const pending = api.translateChapter(button);
    await new Promise(setImmediate);
    context.window.location.href = 'https://www.qidian.com/chapter/1/3/';
    requests[0].onload(memoryResponse('Stale chapter'));
    await pending;
    assert.equal(storage.size, 0);
    assert.equal(button.disabled, false);
});

test('a partly failed chapter pauses automatic navigation', async () => {
    const { api, session, requests, context, storage, settings, timers } = harness();
    settings.autoNext = true;
    settings.engine = 'llm';
    settings.apiKey = 'test-key';
    storage.set('settings', settings);
    session.segments.push({ element: element(), text: '失败段落' });
    let nextUrlLookups = 0;
    api.setAdapter({
        match: /qidian/, getContainer: () => session.container,
        getContent: () => session.segments,
        getNextUrl() { nextUrlLookups++; return 'https://www.qidian.com/chapter/1/3/'; }
    });
    context.document.readyState = 'complete';
    const button = element();
    const pending = api.translateChapter(button);
    await new Promise(setImmediate);
    requests[0].onload({
        status: 200,
        responseText: JSON.stringify({ choices: [{ message: { content: 'Good paragraph' } }] })
    });
    requests[1].onerror({ status: 503 });
    await new Promise(setImmediate);
    // Release the automatic retry delay without waiting a second in the test.
    const callbacks = [...timers.values()];
    timers.clear();
    callbacks.forEach((callback) => callback());
    await new Promise(setImmediate);
    assert.equal(requests.length, 3);
    requests[2].onerror({ status: 503 });
    await pending;
    assert.equal(nextUrlLookups, 0);
    assert.match(button.textContent, /1\/2/);
    assert.equal(button.disabled, false);
});
