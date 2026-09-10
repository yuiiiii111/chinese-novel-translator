// ==UserScript==
// @name         小说翻译助手
// @name:en      Chinese Novel Translator
// @namespace    https://github.com/yuiiiii111/Git
// @version      0.2.3
// @description  为了非母语为中文的英语用户，针对中文小说网站做的插件：在起点中文网、晋江文学城、番茄小说等中文小说网站上，一键把章节正文翻译成你熟悉的语言，支持免费翻译服务与 OpenAI 兼容 API。
// @description:en A userscript for English speakers who are not native Chinese readers: one-click translation of chapter text on Chinese novel sites (Qidian, Jinjiang, Fanqie), powered by free translation services and OpenAI-compatible APIs.
// @author       yuiiiii111
// @homepageURL  https://github.com/yuiiiii111/Git
// @supportURL   https://github.com/yuiiiii111/Git/issues
// @icon         data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%232e9d57'/%3E%3Ctext x='16' y='22.5' font-size='17' text-anchor='middle' fill='white' font-family='sans-serif'%3E%E8%AF%91%3C/text%3E%3C/svg%3E
// @match        *://*.qidian.com/*
// @match        *://*.jjwxc.net/*
// @match        *://*.fanqienovel.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_log
// @connect      translate.googleapis.com
// @connect      api.mymemory.translated.net
// @connect      api.openai.com
// @connect      *
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const SCRIPT_VERSION = '0.2.3';

    const DEFAULT_SETTINGS = {
        engine: 'free',
        targetLang: 'en',
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        model: 'gpt-3.5-turbo',
        displayMode: 'inline',
        autoNext: false
    };

    const UI_IDS = {
        root: 'novel-translator-ui',
        bar: 'novel-translator-bar',
        dragHandle: 'novel-translator-drag-handle',
        translateButton: 'novel-translator-button',
        toggleButton: 'novel-translator-toggle-button',
        settingsButton: 'novel-translator-settings-button',
        miniButton: 'novel-translator-mini-button',
        modal: 'novel-translator-settings-modal',
        toast: 'novel-translator-toast'
    };

    // 番茄正文使用自定义字体把常用字符映射到私用区。
    // 字体表来源：https://github.com/404-novel-project/fanqie_font_tables
    // 解码实现参考 MIT 许可脚本：https://greasyfork.org/scripts/587834
    const FANQIE_CODE_START = 58344;
    const FANQIE_CODE_END = 58715;
    const FANQIE_TABLES = {
        DNMrHsV173Pd4pgy: 'D在主特家军然表场4要只v和?6别还g现儿岁??此象月3出战工相'
            + 'o男直失世F都平文什VO将真T那当?会立些u是十张学气大爱两命全'
            + '后东性通被1它乐接而感车山公了常以何可话先pi叫轻M士w着变尔快'
            + 'l个说少色里安花远7难师放t报认面道S?克地度I好机U民写把万同'
            + '水新没书电吃像斯5为y白几日教看但第加候作上拉住有法r事应位利你'
            + '声身国问马女他Y比父xAHNsX边美对所金活回意到z从j知又内因'
            + '点Q三定8Rb正或夫向德听更?得告并本q过记L让打f人就者去原满'
            + '体做经K走如孩cG给使物?最笑部?员等受k行一条果动光门头见往自'
            + '解成处天能于名其发总母的死手入路进心来h时力多开已许d至由很界n'
            + '小与Z想代么分生口再妈望次西风种带J?实情才这?E我神格长觉间年'
            + '眼无不亲关结0友信下却重己老2音字m呢明之前高PB目太e9起稜她'
            + '也W用方子英每理便四数期中C外样a海们任',
        fKts9tCXDjS49UhH: '体y十现快使话却月物水的放知爱方?表风理O老也p常克平几最主她s'
            + '将法情o光a我呢J员太每望受教w利军已U人如变得要少斯门电m男没'
            + 'AK国时中走么何口小向问轻Td神下间车fG度D又大面远就写j给通'
            + '起实E?它去S到道数吃们加P是无把事西多界?发新外活解孩只作前Y'
            + '尔经?u心告父等Q民全这9果安?i母8r说任先和地C张战场g像c'
            + 'q你使?样总目x性处音头?应乐关能花I当名手4重字声力友然生代内'
            + '里本回真入师象?0点R亲V种动英命ZhX做特边高有B为期自年马认'
            + '出接至H正方感所明者棱F住学还分意更其n但比觉以由死家让失士L2'
            + 'I金叫身报听W再原山海白很见5直位第工个开岁好用都于可同3次四?'
            + '日信与女笑满并部什不从或机此?了记三e些bN夫会才几眼两美被一公'
            + '来立z长对己看k许因相色后往打结格过世气7子条在书之定v拉成进带'
            + '着东上想天他妈1文而路那别德6Mt行候难',
        _search: '?s?作口在他能并B士4U克才正们字声高全尔活者动其主报多望放h'
            + 'w次年?中3特于十入要男同G面分方K什再教本己结1等世N?说gu'
            + '期Z外美M行给9文将两许张友0英应向像此白安少何打气常定间花见孩'
            + '它直风数使道第水已女山解dP的通关性叫几L妈问回神来S?四里前国'
            + '些OvIA心平自无车光代是好却c得种就意先立z子过Yj表?么所接'
            + '了名金受J满眼没部那m每车度可R斯经现门明V如走命y6E战很上f'
            + '月西7长夫想话变海机x到W一成生信笑但父开内东马日小而后带以三几'
            + '为认X死员目位之学远入音呢我q乐象重对个被别F也书棱D写还因家发'
            + '时i或住德当oI比觉然吃去公a老亲情体太b方C电理?失力更拉物着'
            + '原她工实色感记看出相路大你候2和?与p样新只便最不进Tr做格母总'
            + '爱身师轻知往加从?天eH?听场由快边让把任8条头事至起点真手这难'
            + '都界用法n处下文Q告地5kt岁有会果利民'
    };

    const adapters = [
        {
            name: '起点中文网',
            match: /(?:www|read)\.qidian\.com\/chapter\//i,
            getContent() {
                const container = this.getContainer();
                if (!container) {
                    return [];
                }
                return Array.from(container.querySelectorAll('p'))
                    .map((element) => ({
                        element,
                        text: cleanText(element.textContent)
                    }))
                    .filter((item) => item.text);
            },
            getContainer() {
                return document.querySelector(
                    '.chapter-wrapper .print main.content, '
                    + '.chapter-wrapper main.content, main.content, '
                    + '.read-content, .main-text-wrap, .chapter-content'
                );
            },
            getNextUrl() {
                const navigationLinks = Array.from(
                    document.querySelectorAll('.nav-btn-group a[href]')
                );
                const next = navigationLinks.find((link) => /下一章/.test(cleanText(link.textContent)))
                    || navigationLinks[navigationLinks.length - 1]
                    || document.querySelector('a#j_chapterNext, a.j_chapterNext, a.next[href]');
                if (!next || !next.href) {
                    return null;
                }
                try {
                    const url = new URL(next.href, window.location.href);
                    return /(?:^|\.)qidian\.com$/i.test(url.hostname)
                        && /\/chapter\/[^/]+\/[^/]+\/?$/i.test(url.pathname)
                        ? url.href
                        : null;
                } catch (error) {
                    return null;
                }
            }
        },
        {
            name: '晋江文学城',
            match: /(?:www|m)\.jjwxc\.net/i,
            getContent() {
                const container = this.getContainer();
                if (!container) {
                    return [];
                }

                const paragraphNodes = Array.from(
                    container.querySelectorAll('.onebook_paragraph_comment_text')
                );
                if (paragraphNodes.length > 0) {
                    return paragraphNodes
                        .map((element) => ({ element, text: cleanText(element.textContent) }))
                        .filter((item) => item.text);
                }

                const copy = container.cloneNode(true);
                copy.querySelectorAll('.novel-translation, .novel-translation-block')
                    .forEach((node) => node.remove());
                copy.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
                const content = copy.textContent || '';
                return content
                    .split(/\r?\n+/)
                    .map((text) => cleanText(text))
                    .filter(Boolean)
                    .map((text) => ({ element: null, text }));
            },
            getContainer() {
                return document.querySelector(
                    '#paragraph_comment_content, ul.content_ul > li, .noveltext'
                );
            },
            getNextUrl: null
        },
        {
            name: '番茄小说',
            match: /fanqienovel\.com\/reader\//i,
            getContent() {
                const container = this.getContainer();
                if (!container) {
                    return [];
                }
                return Array.from(container.querySelectorAll('p'))
                    .map((element) => ({
                        element,
                        text: cleanText(decodeFanqieText(element.textContent, element))
                    }))
                    .filter((item) => item.text);
            },
            getContainer() {
                return document.querySelector('.muye-reader-content, .page-content');
            },
            getNextUrl: null
        }
    ];

    const LANGUAGE_LABELS = {
        en: '英语 English',
        ja: '日语 日本語',
        ko: '韩语 한국어',
        ru: '俄语 Русский',
        fr: '法语 Français',
        de: '德语 Deutsch',
        es: '西班牙语 Español',
        zh: '简体中文',
        'zh-CN': '简体中文',
        'zh-TW': '繁体中文',
        ar: '阿拉伯语',
        pt: '葡萄牙语',
        vi: '越南语',
        th: '泰语'
    };

    let session = null;
    let autoNextTimer = null;

    // ---------------- 基础工具 ----------------

    function cleanText(value) {
        return String(value || '')
            .replace(/[\u00a0\u200b\ufeff]/g, ' ')
            .replace(/[ \t]+/g, ' ')
            .trim();
    }

    function countFanqiePrivateCharacters(text) {
        return Array.from(String(text || '')).filter((character) => {
            const code = character.codePointAt(0);
            return code >= FANQIE_CODE_START && code <= FANQIE_CODE_END;
        }).length;
    }

    function findFanqieFontId(element) {
        let current = element;
        while (current && current.nodeType === 1) {
            const className = typeof current.className === 'string' ? current.className : '';
            const matchedId = Object.keys(FANQIE_TABLES)
                .find((fontId) => className.split(/\s+/).includes(`font-${fontId}`));
            if (matchedId) {
                return matchedId;
            }
            current = current.parentElement;
        }

        try {
            const family = element && typeof window.getComputedStyle === 'function'
                ? window.getComputedStyle(element).fontFamily
                : '';
            return Object.keys(FANQIE_TABLES).find((fontId) => family.includes(fontId)) || null;
        } catch (error) {
            return null;
        }
    }

    function decodeFanqieWithTable(text, fontId) {
        const table = Array.from(FANQIE_TABLES[fontId] || '');
        if (table.length !== FANQIE_CODE_END - FANQIE_CODE_START + 1) {
            return null;
        }
        return Array.from(text).map((character) => {
            const code = character.codePointAt(0);
            if (code < FANQIE_CODE_START || code > FANQIE_CODE_END) {
                return character;
            }
            const decoded = table[code - FANQIE_CODE_START];
            return decoded && decoded !== '?' ? decoded : character;
        }).join('');
    }

    function decodeFanqieText(value, element) {
        const text = String(value || '');
        const privateCount = countFanqiePrivateCharacters(text);
        if (privateCount === 0) {
            return text;
        }

        const detectedId = findFanqieFontId(element);
        const candidateIds = detectedId
            ? [detectedId]
            : Object.keys(FANQIE_TABLES);
        let best = text;
        let bestPrivateCount = privateCount;
        candidateIds.forEach((fontId) => {
            const decoded = decodeFanqieWithTable(text, fontId);
            if (decoded === null) {
                return;
            }
            const remaining = countFanqiePrivateCharacters(decoded);
            if (remaining < bestPrivateCount) {
                best = decoded;
                bestPrivateCount = remaining;
            }
        });
        return best;
    }

    function delay(milliseconds) {
        return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
    }

    function getMatchedAdapter() {
        const url = window.location.href;
        return adapters.find((adapter) => adapter.match.test(url)) || null;
    }

    function languageName(code) {
        const key = String(code || '').trim();
        return LANGUAGE_LABELS[key] || key;
    }

    function getSettings() {
        try {
            const stored = GM_getValue('settings', {});
            const settings = Object.assign({}, DEFAULT_SETTINGS, stored || {});
            // 0.2.2 及更早版本只有 google/llm；旧的免费引擎设置自动迁移。
            settings.engine = settings.engine === 'llm' ? 'llm' : 'free';
            settings.targetLang = String(settings.targetLang || '').trim() || DEFAULT_SETTINGS.targetLang;
            settings.apiUrl = String(settings.apiUrl || '').trim() || DEFAULT_SETTINGS.apiUrl;
            settings.model = String(settings.model || '').trim() || DEFAULT_SETTINGS.model;
            settings.apiKey = String(settings.apiKey || '').trim();
            settings.displayMode = settings.displayMode === 'translations-only' ? 'translations-only' : 'inline';
            settings.autoNext = Boolean(settings.autoNext);
            return settings;
        } catch (error) {
            logError('读取设置失败', error);
            return Object.assign({}, DEFAULT_SETTINGS);
        }
    }

    function saveSettings(settings) {
        try {
            const mergedSettings = Object.assign({}, DEFAULT_SETTINGS, settings || {});
            mergedSettings.engine = mergedSettings.engine === 'llm' ? 'llm' : 'free';
            mergedSettings.targetLang = String(mergedSettings.targetLang || '').trim() || DEFAULT_SETTINGS.targetLang;
            mergedSettings.apiUrl = String(mergedSettings.apiUrl || '').trim() || DEFAULT_SETTINGS.apiUrl;
            mergedSettings.model = String(mergedSettings.model || '').trim() || DEFAULT_SETTINGS.model;
            mergedSettings.apiKey = String(mergedSettings.apiKey || '').trim();
            mergedSettings.displayMode = settings && settings.displayMode === 'translations-only'
                ? 'translations-only'
                : 'inline';
            mergedSettings.autoNext = Boolean(settings && settings.autoNext);
            GM_setValue('settings', mergedSettings);
            return true;
        } catch (error) {
            logError('保存设置失败', error);
            return false;
        }
    }

    function logError(message, error) {
        const detail = error && error.message ? `: ${error.message}` : '';
        try {
            GM_log(`[小说翻译助手] ${message}${detail}`);
        } catch (logFailure) {
            console.error(`[小说翻译助手] ${message}${detail}`, error);
        }
    }

    // ---------------- Toast（替代 window.alert） ----------------

    let toastTimer = null;

    function showToast(message, type, duration) {
        const kind = ['success', 'error', 'info'].includes(type) ? type : 'info';
        const wait = typeof duration === 'number' ? duration : (kind === 'error' ? 5000 : 3200);
        let toast = document.getElementById(UI_IDS.toast);
        if (!toast) {
            toast = document.createElement('div');
            toast.id = UI_IDS.toast;
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.className = `novel-translator-toast novel-translator-toast-${kind}`;
        toast.classList.add('novel-translator-toast-show');
        if (toastTimer) {
            window.clearTimeout(toastTimer);
        }
        toastTimer = window.setTimeout(() => {
            toast.classList.remove('novel-translator-toast-show');
        }, wait);
    }

    // ---------------- 网络请求与翻译引擎 ----------------

    function gmRequest(details) {
        return new Promise((resolve, reject) => {
            let settled = false;
            const finish = (callback, value) => {
                if (settled) {
                    return;
                }
                settled = true;
                callback(value);
            };

            const requestDetails = Object.assign({}, details, {
                timeout: details.timeout || 10000,
                onload: (response) => finish(resolve, response),
                onerror: (error) => finish(reject, new Error(`网络请求失败 (${responseStatus(error)})`)),
                ontimeout: () => finish(reject, new Error('网络请求超时')),
                onabort: () => finish(reject, new Error('网络请求被中止'))
            });

            try {
                GM_xmlhttpRequest(requestDetails);
            } catch (error) {
                finish(reject, error);
            }
        });
    }

    function responseStatus(response) {
        return response && response.status ? response.status : '未知错误';
    }

    function splitByUtf8Bytes(text, maxBytes) {
        const encoder = new TextEncoder();
        const chunks = [];
        let current = '';
        Array.from(text).forEach((character) => {
            const candidate = current + character;
            if (current && encoder.encode(candidate).length > maxBytes) {
                chunks.push(current);
                current = character;
            } else {
                current = candidate;
            }
            if (encoder.encode(current).length >= 300 && /[。！？!?；;]$/.test(current)) {
                chunks.push(current);
                current = '';
            }
        });
        if (current) {
            chunks.push(current);
        }
        return chunks;
    }

    function decodeTranslationEntities(value) {
        return String(value || '')
            .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
            .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
            .replace(/&quot;/g, '"')
            .replace(/&#39;|&apos;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
    }

    async function myMemoryTranslate(text, targetLang) {
        try {
            const translatedChunks = [];
            const chunks = splitByUtf8Bytes(text, 450);
            for (const chunk of chunks) {
                const params = new URLSearchParams({
                    q: chunk,
                    langpair: `zh-CN|${targetLang}`,
                    mt: '1'
                });
                const response = await gmRequest({
                    method: 'GET',
                    url: `https://api.mymemory.translated.net/get?${params.toString()}`,
                    timeout: 15000
                });
                if (!response || response.status < 200 || response.status >= 300) {
                    throw new Error(`MyMemory 返回状态 ${responseStatus(response)}`);
                }
                const data = JSON.parse(response.responseText);
                const translation = data && data.responseData
                    ? data.responseData.translatedText
                    : null;
                if (typeof translation !== 'string' || !translation.trim()) {
                    throw new Error(data && data.responseDetails
                        ? `MyMemory：${data.responseDetails}`
                        : 'MyMemory 返回格式无效或译文为空');
                }
                translatedChunks.push(decodeTranslationEntities(translation));
            }
            return translatedChunks.join('').trim();
        } catch (error) {
            logError('MyMemory 请求失败', error);
            return null;
        }
    }

    async function googleTranslate(text, targetLang) {
        try {
            const params = new URLSearchParams({
                client: 'gtx',
                sl: 'auto',
                tl: targetLang,
                dt: 't',
                q: text
            });
            const response = await gmRequest({
                method: 'GET',
                url: `https://translate.googleapis.com/translate_a/single?${params.toString()}`,
                timeout: 10000
            });

            if (!response || response.status < 200 || response.status >= 300) {
                throw new Error(`Google Translate 返回状态 ${responseStatus(response)}`);
            }

            const data = JSON.parse(response.responseText);
            if (!Array.isArray(data) || !Array.isArray(data[0])) {
                throw new Error('Google Translate 返回格式无效');
            }

            const translation = data[0]
                .filter((item) => Array.isArray(item) && typeof item[0] === 'string')
                .map((item) => item[0])
                .join('')
                .trim();

            if (!translation) {
                throw new Error('Google Translate 返回空译文');
            }
            return translation;
        } catch (error) {
            logError('Google Translate 请求失败', error);
            return null;
        }
    }

    async function freeTranslate(text, targetLang) {
        const myMemoryResult = await myMemoryTranslate(text, targetLang);
        if (myMemoryResult) {
            return myMemoryResult;
        }
        return googleTranslate(text, targetLang);
    }

    async function llmTranslate(text, targetLang, apiUrl, apiKey, model) {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (apiKey) {
            headers.Authorization = `Bearer ${apiKey}`;
        }

        const response = await gmRequest({
            method: 'POST',
            url: apiUrl,
            headers,
            data: JSON.stringify({
                model,
                messages: [
                    {
                        role: 'user',
                        content: `请将以下内容翻译成${languageName(targetLang)}，只返回译文：\n${text}`
                    }
                ]
            }),
            timeout: 10000
        });

        if (!response || response.status < 200 || response.status >= 300) {
            throw new Error(`大模型 API 返回状态 ${responseStatus(response)}`);
        }

        const data = JSON.parse(response.responseText);
        const translation = data && data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content
            : null;
        if (typeof translation !== 'string' || !translation.trim()) {
            throw new Error('大模型 API 返回格式无效或译文为空');
        }
        return translation.trim();
    }

    async function translateText(text, targetLang, settings) {
        let lastError = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                if (settings.engine === 'llm') {
                    return await llmTranslate(
                        text,
                        targetLang,
                        settings.apiUrl,
                        settings.apiKey,
                        settings.model
                    );
                }
                const translation = await freeTranslate(text, targetLang);
                if (!translation) {
                    throw new Error('免费翻译服务未返回译文');
                }
                return translation;
            } catch (error) {
                lastError = error;
                if (attempt === 0) {
                    await delay(1000);
                }
            }
        }

        logError(`翻译失败：${text.slice(0, 40)}`, lastError);
        return null;
    }

    async function translateWithConcurrency(texts, targetLang, settings, batchSize, onProgress) {
        const translations = [];
        let doneCount = 0;
        for (let start = 0; start < texts.length; start += batchSize) {
            const batch = texts.slice(start, start + batchSize);
            const batchTranslations = await Promise.all(
                batch.map((text) => translateText(text, targetLang, settings))
            );
            translations.push(...batchTranslations);
            doneCount += batchTranslations.length;
            if (typeof onProgress === 'function') {
                onProgress(doneCount, texts.length);
            }
        }
        return translations;
    }

    // ---------------- 章节内容提取与缓存 ----------------

    async function extractContentWithRetry(adapter, maxRetries, interval) {
        const retries = maxRetries === undefined ? 3 : maxRetries;
        const waitMs = interval === undefined ? 500 : interval;

        if (document.readyState === 'loading') {
            await new Promise((resolve) => {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
            });
        }

        for (let attempt = 0; attempt <= retries; attempt += 1) {
            const container = adapter.getContainer();
            const segments = container ? adapter.getContent() : [];

            if (container && segments.length > 0) {
                return { container, segments };
            }

            if (attempt < retries) {
                await delay(waitMs);
            }
        }

        return {
            container: adapter.getContainer(),
            segments: []
        };
    }

    function getCacheKey(settings, chapterUrl = window.location.href) {
        const url = new URL(chapterUrl);
        const engine = settings.engine === 'llm' ? 'llm' : 'free';
        return `cache_v2_${JSON.stringify([
            url.origin, url.pathname, url.search, settings.targetLang, engine,
            engine === 'llm' ? settings.apiUrl : '',
            engine === 'llm' ? settings.model : ''
        ])}`;
    }

    function readCache(sourceTexts, settings, cacheKey = getCacheKey(settings)) {
        try {
            const storedCache = GM_getValue(cacheKey, null);
            const cache = typeof storedCache === 'string'
                ? JSON.parse(storedCache)
                : storedCache;
            if (!cache || cache.targetLang !== settings.targetLang || !Array.isArray(cache.sourceTexts)
                || !Array.isArray(cache.translations) || cache.sourceTexts.length !== sourceTexts.length
                || cache.translations.length !== sourceTexts.length) {
                return null;
            }

            const sameSource = cache.sourceTexts.every((source, index) => source === sourceTexts[index]);
            if (
                !sameSource ||
                cache.translations.some(
                    (translation) => typeof translation !== 'string' || !translation.trim()
                )
            ) {
                return null;
            }
            return cache.translations;
        } catch (error) {
            logError('读取缓存失败', error);
            return null;
        }
    }

    function writeCache(sourceTexts, translations, settings, cacheKey = getCacheKey(settings)) {
        try {
            GM_setValue(cacheKey, JSON.stringify({
                targetLang: settings.targetLang,
                sourceTexts,
                translations,
                savedAt: Date.now()
            }));
        } catch (error) {
            logError('保存缓存失败', error);
        }
    }

    // ---------------- 译文渲染 ----------------

    function clearTranslation() {
        window.clearTimeout(autoNextTimer);
        autoNextTimer = null;
        document.querySelectorAll('.novel-translation, .novel-translation-block').forEach((node) => node.remove());
        document.querySelectorAll('.nt-hidden-source').forEach((node) => node.classList.remove('nt-hidden-source'));
        session = null;
        const root = document.getElementById(UI_IDS.root);
        if (root) {
            root.dataset.tlVisible = '1';
            const toggleButton = document.getElementById(UI_IDS.toggleButton);
            if (toggleButton) {
                toggleButton.disabled = true;
                toggleButton.textContent = '🙈';
                toggleButton.title = '暂无译文可切换';
            }
        }
    }

    function createTranslationNode(text, failed) {
        const node = document.createElement('div');
        node.className = failed
            ? 'novel-translation novel-translation-failed'
            : 'novel-translation';
        if (failed) {
            node.textContent = '翻译失败，点击此处重试';
            node.title = '点击重新翻译这一段';
        } else {
            node.textContent = text;
        }
        return node;
    }

    function renderTranslations(sessionData, translations) {
        const { segments, container } = sessionData;
        const mode = sessionData.settings.displayMode === 'translations-only' ? 'translations-only' : 'inline';
        const hasElements = segments.some((segment) => segment.element && segment.element.nodeType === 1);

        if (hasElements) {
            segments.forEach((segment, index) => {
                if (!segment.element || segment.element.nodeType !== 1) {
                    return;
                }
                const success = typeof translations[index] === 'string' && translations[index];
                const node = createTranslationNode(translations[index], !success);
                if (!success) {
                    node.addEventListener('click', () => retrySegment(sessionData, index, node));
                }
                if (mode === 'translations-only') {
                    segment.element.classList.add('nt-hidden-source');
                }
                segment.element.insertAdjacentElement('afterend', node);
            });
            return;
        }

        // 无独立段落元素的站点（晋江等）
        if (mode === 'translations-only') {
            container.classList.add('nt-hidden-source');
            const block = document.createElement('div');
            block.className = 'novel-translation-block';
            translations.forEach((translation, index) => {
                const success = typeof translation === 'string' && translation;
                const node = createTranslationNode(translation, !success);
                if (!success) {
                    node.addEventListener('click', () => retrySegment(sessionData, index, node));
                }
                block.appendChild(node);
            });
            container.parentNode.insertBefore(block, container);
            return;
        }

        const fragment = document.createDocumentFragment();
        translations.forEach((translation, index) => {
            const success = typeof translation === 'string' && translation;
            const node = createTranslationNode(translation, !success);
            if (!success) {
                node.addEventListener('click', () => retrySegment(sessionData, index, node));
            }
            fragment.appendChild(node);
        });
        container.appendChild(fragment);
    }

    async function retrySegment(sessionData, index, node) {
        if (!sessionData || session !== sessionData || !node || !node.isConnected
            || node.dataset.retrying === '1' || !node.classList.contains('novel-translation-failed')
            || window.location.href !== sessionData.chapterUrl) {
            return;
        }
        const source = sessionData.sourceTexts[index];
        if (typeof source !== 'string' || !source) {
            return;
        }
        node.dataset.retrying = '1';
        node.classList.remove('novel-translation-failed');
        node.textContent = '⟳ 重试中…';
        try {
            const translation = await translateText(source, sessionData.settings.targetLang, sessionData.settings);
            if (session !== sessionData || !node.isConnected || window.location.href !== sessionData.chapterUrl) {
                return;
            }
            if (typeof translation === 'string' && translation) {
                node.textContent = translation;
                node.removeAttribute('title');
                sessionData.translations[index] = translation;
                writeCache(sessionData.sourceTexts, sessionData.translations, sessionData.settings, sessionData.cacheKey);
                showToast('该段已重新翻译', 'success', 2000);
            } else {
                node.textContent = '翻译失败，点击此处重试';
                node.classList.add('novel-translation-failed');
                showToast('重试失败，请检查网络或设置', 'error', 3000);
            }
        } catch (error) {
            node.textContent = '翻译失败，点击此处重试';
            node.classList.add('novel-translation-failed');
            showToast(`重试出错：${error.message || '未知错误'}`, 'error', 4000);
        } finally {
            delete node.dataset.retrying;
        }
    }

    // ---------------- 悬浮按钮状态 ----------------

    const DEFAULT_BUTTON_LABEL = '🌐 翻译本章';

    function setButtonState(button, label, disabled) {
        button.textContent = label;
        button.disabled = disabled;
        button.setAttribute('aria-busy', disabled ? 'true' : 'false');
    }

    function resetButtonAfter(button, doneLabel, delayMs) {
        window.setTimeout(() => {
            if (button.textContent === doneLabel) {
                setButtonState(button, DEFAULT_BUTTON_LABEL, false);
            }
        }, delayMs);
    }

    function applyTranslationVisibility() {
        const root = document.getElementById(UI_IDS.root);
        const toggleButton = document.getElementById(UI_IDS.toggleButton);
        if (!root || !toggleButton) {
            return;
        }
        const visible = root.dataset.tlVisible !== '0';
        const nodes = document.querySelectorAll('.novel-translation, .novel-translation-block');
        nodes.forEach((node) => {
            node.style.display = visible ? '' : 'none';
        });
        if (session && session.settings.displayMode === 'translations-only') {
            const sources = session.segments.map((segment) => segment.element).filter(Boolean);
            (sources.length ? sources : [session.container]).forEach((node) => {
                node.classList.toggle('nt-hidden-source', visible);
            });
        }
        toggleButton.textContent = visible ? '🙈' : '👁';
        toggleButton.title = visible ? '隐藏译文（Alt+H）' : '显示译文（Alt+H）';
        toggleButton.setAttribute('aria-pressed', visible ? 'true' : 'false');
    }

    function syncToggleState() {
        const toggleButton = document.getElementById(UI_IDS.toggleButton);
        if (!toggleButton) {
            return;
        }
        const anyTranslation = document.querySelectorAll('.novel-translation, .novel-translation-block').length > 0;
        toggleButton.disabled = !anyTranslation;
        if (anyTranslation) {
            applyTranslationVisibility();
        }
    }

    function toggleTranslationVisibility() {
        const root = document.getElementById(UI_IDS.root);
        if (!root) {
            return;
        }
        root.dataset.tlVisible = root.dataset.tlVisible === '1' ? '0' : '1';
        applyTranslationVisibility();
    }

    // ---------------- 章节翻译主流程 ----------------

    async function translateChapter(button) {
        const adapter = getMatchedAdapter();
        if (!adapter || button.disabled) {
            return;
        }

        clearTranslation();
        setButtonState(button, '⏳ 准备中…', true);

        const settings = getSettings();
        const chapterUrl = window.location.href;
        const cacheKey = getCacheKey(settings, chapterUrl);
        if (settings.engine === 'llm' && !settings.apiKey) {
            setButtonState(button, DEFAULT_BUTTON_LABEL, false);
            showToast('请先在设置中填写 API Key', 'error');
            return;
        }

        const startedAt = Date.now();
        try {
            const { container, segments } = await extractContentWithRetry(adapter, 10, 500);
            if (!container || !segments.length) {
                setButtonState(button, DEFAULT_BUTTON_LABEL, false);
                showToast('无法提取正文内容，页面结构可能已改版', 'error');
                return;
            }

            const sourceTexts = segments.map((segment) => segment.text);
            const total = sourceTexts.length;
            let translations = readCache(sourceTexts, settings, cacheKey);
            const usedCache = Boolean(translations);

            if (!translations) {
                setButtonState(button, `⏳ 翻译中 (0/${total})`, true);
                translations = await translateWithConcurrency(
                    sourceTexts,
                    settings.targetLang,
                    settings,
                    5,
                    (done, all) => {
                        setButtonState(button, `⏳ 翻译中 (${done}/${all})`, true);
                    }
                );
                if (translations.length > 0 && translations.every((translation) => !translation)) {
                    setButtonState(button, DEFAULT_BUTTON_LABEL, false);
                    showToast('翻译失败，请检查设置或网络', 'error');
                    return;
                }
            }

            if (window.location.href !== chapterUrl || !container.isConnected) {
                setButtonState(button, DEFAULT_BUTTON_LABEL, false);
                showToast('章节已变化，请重新翻译当前章节', 'info');
                return;
            }
            if (!usedCache && translations.every((translation) => typeof translation === 'string' && translation)) {
                writeCache(sourceTexts, translations, settings, cacheKey);
            }
            session = {
                chapterUrl,
                cacheKey,
                container,
                segments,
                sourceTexts,
                translations,
                settings
            };
            renderTranslations(session, translations);

            const successCount = translations.filter((translation) => typeof translation === 'string' && translation).length;
            const failedCount = total - successCount;
            const elapsed = Math.round((Date.now() - startedAt) / 1000);
            const doneLabel = failedCount > 0
                ? `✓ ${successCount}/${total} 段（${failedCount} 段失败）`
                : `✓ 已翻译 ${total} 段`;

            setButtonState(button, doneLabel, false);
            resetButtonAfter(button, doneLabel, 2600);
            syncToggleState();

            if (failedCount > 0) {
                showToast(`${failedCount} 段翻译失败，点击红色译文可单独重试`, 'error', 4000);
            } else if (usedCache) {
                showToast(`已从缓存加载译文（共 ${total} 段，${elapsed} 秒内显示）`, 'info', 2400);
            } else {
                showToast(`翻译完成：${total} 段，用时 ${elapsed} 秒`, 'success', 2600);
            }

            if (failedCount === 0) {
                scheduleAutoNext(adapter, settings);
            }
        } catch (error) {
            logError('翻译章节失败', error);
            setButtonState(button, '翻译失败，重试', false);
            resetButtonAfter(button, '翻译失败，重试', 3000);
            showToast(`翻译失败：${error.message || '未知错误'}`, 'error', 5000);
        }
    }

    // ---------------- 自动翻译下一章（可选，默认关闭） ----------------

    function scheduleAutoNext(adapter, settings) {
        window.clearTimeout(autoNextTimer);
        autoNextTimer = null;
        if (!settings.autoNext || !adapter || typeof adapter.getNextUrl !== 'function') {
            return;
        }
        let nextUrl = null;
        try {
            nextUrl = adapter.getNextUrl();
        } catch (error) {
            logError('查找下一章链接失败', error);
        }
        if (!nextUrl) {
            showToast('已开启自动翻译，但本章没有找到下一章链接', 'info', 3000);
            return;
        }
        showToast('即将自动跳转到下一章并继续翻译…', 'info', 1600);
        const scheduledSession = session;
        const chapterUrl = window.location.href;
        autoNextTimer = window.setTimeout(() => {
            autoNextTimer = null;
            if (session !== scheduledSession || window.location.href !== chapterUrl) {
                return;
            }
            // 跳转前复查：用户可能在这 2 秒内关闭了自动翻译
            let latestSettings;
            try {
                latestSettings = getSettings();
            } catch (error) {
                latestSettings = settings;
            }
            if (!latestSettings.autoNext) {
                return;
            }
            try {
                GM_setValue('autoTarget', nextUrl);
            } catch (error) {
                logError('保存自动翻译目标失败', error);
            }
            window.location.href = nextUrl;
        }, 2000);
    }

    function handleAutoContinue() {
        let target = null;
        try {
            target = GM_getValue('autoTarget', null);
        } catch (error) {
            logError('读取自动翻译目标失败', error);
        }
        if (!target) {
            return;
        }
        try {
            GM_setValue('autoTarget', null);
        } catch (error) {
            logError('清除自动翻译目标失败', error);
        }
        if (target !== window.location.href) {
            return;
        }
        window.setTimeout(() => {
            const button = document.getElementById(UI_IDS.translateButton);
            if (button) {
                translateChapter(button);
            }
        }, 800);
    }

    function clearStaleAutoTarget() {
        let target = null;
        try {
            target = GM_getValue('autoTarget', null);
        } catch (error) {
            logError('读取自动翻译目标失败', error);
        }
        if (!target) {
            return;
        }
        try {
            GM_setValue('autoTarget', null);
        } catch (error) {
            logError('清除自动翻译目标失败', error);
        }
    }

    // ---------------- 样式 ----------------

    function injectStyles() {
        if (document.getElementById('novel-translator-styles')) {
            return;
        }
        const style = document.createElement('style');
        style.id = 'novel-translator-styles';
        style.textContent = `
            /* ===== 悬浮工具栏 ===== */
            #${UI_IDS.root} {
                position: fixed;
                right: 20px;
                bottom: 20px;
                z-index: 2147483644;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
                user-select: none;
            }
            #${UI_IDS.root} .nt-bar {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 5px 8px 5px 4px;
                border-radius: 999px;
                background: rgba(255, 255, 255, .9);
                -webkit-backdrop-filter: blur(10px);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(0, 0, 0, .08);
                box-shadow: 0 6px 22px rgba(0, 0, 0, .18);
                transition: opacity .18s ease;
            }
            #${UI_IDS.root} button {
                border: 0;
                cursor: pointer;
                font-family: inherit;
                transition: background .15s ease, transform .15s ease, opacity .2s ease;
            }
            #${UI_IDS.root} button:focus-visible {
                outline: 2px solid #2e9d57;
                outline-offset: 1px;
            }
            #${UI_IDS.root} .nt-btn {
                height: 36px;
                padding: 0 13px;
                border-radius: 999px;
                background: transparent;
                color: #333;
                font-size: 14px;
                line-height: 1;
                display: inline-flex;
                align-items: center;
                gap: 5px;
                white-space: nowrap;
            }
            #${UI_IDS.root} .nt-btn:hover:not(:disabled) {
                background: rgba(0, 0, 0, .06);
            }
            #${UI_IDS.root} .nt-btn:disabled {
                cursor: wait;
                opacity: .55;
            }
            #${UI_IDS.root} .nt-icon-btn {
                width: 36px;
                height: 36px;
                padding: 0;
                border-radius: 50%;
                background: transparent;
                color: #333;
                font-size: 17px;
                line-height: 1;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex: 0 0 auto;
            }
            #${UI_IDS.root} .nt-icon-btn:hover:not(:disabled) {
                background: rgba(0, 0, 0, .06);
            }
            #${UI_IDS.root} .nt-icon-btn:disabled {
                cursor: default;
                opacity: .4;
            }
            #${UI_IDS.dragHandle} {
                cursor: grab;
                color: #9aa0a6;
                font-size: 14px;
                touch-action: none;
            }
            #${UI_IDS.dragHandle}:active {
                cursor: grabbing;
            }
            #${UI_IDS.translateButton} {
                background: #2e9d57;
                color: #fff;
                font-weight: 600;
            }
            #${UI_IDS.translateButton}:hover:not(:disabled) {
                background: #278a4c;
                transform: translateY(-1px);
            }
            #${UI_IDS.translateButton}:disabled {
                background: #2e9d57;
            }
            #${UI_IDS.settingsButton} {
                color: #555;
            }
            #${UI_IDS.miniButton} {
                display: none;
                width: 46px;
                height: 46px;
                border-radius: 50%;
                background: #2e9d57;
                color: #fff;
                font-size: 17px;
                font-weight: 700;
                box-shadow: 0 6px 22px rgba(46, 157, 87, .45);
            }
            #${UI_IDS.root}.nt-collapsed .nt-bar {
                display: none;
            }
            #${UI_IDS.root}.nt-collapsed #${UI_IDS.miniButton} {
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }

            /* ===== 译文 ===== */
            .novel-translation {
                box-sizing: border-box;
                margin: 8px 0 14px;
                padding-left: 10px;
                border-left: 3px solid #2e9d57;
                color: #666;
                line-height: 1.8;
                animation: novel-translation-in .22s ease;
                word-break: break-word;
            }
            .novel-translation-block {
                margin: 12px 0;
                animation: novel-translation-in .22s ease;
            }
            .novel-translation-failed {
                border-left-color: #d9534f;
                color: #d9534f !important;
                cursor: pointer;
                font-style: italic;
            }
            .novel-translation-failed:hover {
                opacity: .75;
            }
            .nt-hidden-source {
                display: none !important;
            }
            @keyframes novel-translation-in {
                from { opacity: 0; transform: translateY(3px); }
                to { opacity: 1; transform: translateY(0); }
            }

            /* ===== 设置弹窗 ===== */
            #${UI_IDS.modal} {
                position: fixed;
                inset: 0;
                z-index: 2147483645;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, .45);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
            }
            #${UI_IDS.modal}[hidden] {
                display: none;
            }
            #${UI_IDS.modal} .novel-translator-dialog {
                width: min(470px, calc(100vw - 32px));
                box-sizing: border-box;
                padding: 24px;
                border-radius: 12px;
                background: #fff;
                color: #222;
                box-shadow: 0 12px 40px rgba(0, 0, 0, .28);
                max-height: calc(100vh - 48px);
                overflow-y: auto;
            }
            #${UI_IDS.modal} h2 {
                margin: 0 0 4px;
                font-size: 19px;
            }
            #${UI_IDS.modal} .novel-translator-subtitle {
                margin: 0 0 14px;
                color: #888;
                font-size: 12px;
                font-weight: 400;
            }
            #${UI_IDS.modal} label.novel-translator-label {
                display: block;
                margin: 14px 0 6px;
                font-size: 13px;
                font-weight: 600;
            }
            #${UI_IDS.modal} input[type="text"],
            #${UI_IDS.modal} input[type="url"],
            #${UI_IDS.modal} input[type="password"],
            #${UI_IDS.modal} select {
                width: 100%;
                box-sizing: border-box;
                padding: 9px 11px;
                border: 1px solid #d4d7dc;
                border-radius: 8px;
                font-size: 14px;
                background: #fff;
                color: inherit;
                outline: none;
                transition: border-color .15s ease, box-shadow .15s ease;
            }
            #${UI_IDS.modal} input:focus,
            #${UI_IDS.modal} select:focus {
                border-color: #2e9d57;
                box-shadow: 0 0 0 3px rgba(46, 157, 87, .14);
            }
            #${UI_IDS.modal} .novel-translator-row {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            #${UI_IDS.modal} .novel-translator-row input {
                flex: 1;
            }
            #${UI_IDS.modal} .novel-translator-password-wrap {
                position: relative;
            }
            #${UI_IDS.modal} .novel-translator-password-wrap input {
                padding-right: 42px;
            }
            #${UI_IDS.modal} .novel-translator-key-toggle {
                position: absolute;
                top: 50%;
                right: 6px;
                transform: translateY(-50%);
                width: 30px;
                height: 30px;
                border: 0;
                border-radius: 6px;
                background: transparent;
                cursor: pointer;
                font-size: 14px;
                line-height: 1;
            }
            #${UI_IDS.modal} .novel-translator-key-toggle:hover {
                background: rgba(0, 0, 0, .06);
            }
            #${UI_IDS.modal} .novel-translator-check {
                display: flex;
                align-items: center;
                gap: 8px;
                margin: 14px 0 2px;
                font-size: 14px;
                cursor: pointer;
            }
            #${UI_IDS.modal} .novel-translator-check input {
                width: auto;
                accent-color: #2e9d57;
            }
            #${UI_IDS.modal} .novel-translator-llm-fields {
                margin-top: 2px;
            }
            #${UI_IDS.modal} .novel-translator-actions {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                margin-top: 24px;
            }
            #${UI_IDS.modal} .novel-translator-actions button {
                padding: 9px 18px;
                border: 1px solid #d4d7dc;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                background: #fff;
                color: #333;
                transition: background .15s ease;
            }
            #${UI_IDS.modal} .novel-translator-actions button:hover {
                background: rgba(0, 0, 0, .05);
            }
            #${UI_IDS.modal} .novel-translator-save {
                border-color: #2e9d57 !important;
                color: #fff !important;
                background: #2e9d57 !important;
            }
            #${UI_IDS.modal} .novel-translator-save:hover {
                background: #278a4c !important;
            }
            #${UI_IDS.modal} .novel-translator-hint {
                margin: 7px 0 0;
                color: #8a8f98;
                font-size: 12px;
                line-height: 1.55;
            }

            /* ===== Toast ===== */
            #${UI_IDS.toast} {
                position: fixed;
                top: 26px;
                left: 50%;
                transform: translateX(-50%) translateY(-14px);
                z-index: 2147483646;
                max-width: min(560px, calc(100vw - 32px));
                box-sizing: border-box;
                padding: 11px 18px;
                border-radius: 10px;
                color: #fff;
                font-size: 14px;
                line-height: 1.5;
                box-shadow: 0 8px 26px rgba(0, 0, 0, .24);
                opacity: 0;
                pointer-events: none;
                transition: opacity .25s ease, transform .25s ease;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
            }
            #${UI_IDS.toast}.novel-translator-toast-show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            #${UI_IDS.toast}.novel-translator-toast-success {
                background: #2e9d57;
            }
            #${UI_IDS.toast}.novel-translator-toast-error {
                background: #d9534f;
            }
            #${UI_IDS.toast}.novel-translator-toast-info {
                background: #3c4148;
            }

            /* ===== 深色模式 ===== */
            @media (prefers-color-scheme: dark) {
                #${UI_IDS.root} .nt-bar {
                    background: rgba(30, 32, 36, .92);
                    border-color: rgba(255, 255, 255, .1);
                    box-shadow: 0 6px 22px rgba(0, 0, 0, .55);
                }
                #${UI_IDS.root} .nt-btn,
                #${UI_IDS.root} .nt-icon-btn {
                    color: #e8e8ea;
                }
                #${UI_IDS.root} .nt-btn:hover:not(:disabled),
                #${UI_IDS.root} .nt-icon-btn:hover:not(:disabled) {
                    background: rgba(255, 255, 255, .09);
                }
                #${UI_IDS.root} #${UI_IDS.settingsButton} {
                    color: #c6c9cd;
                }
                #${UI_IDS.dragHandle} {
                    color: #6d7075;
                }
                .novel-translation {
                    color: #b4b7bd;
                    border-left-color: #46b878;
                }
                #${UI_IDS.modal} {
                    background: rgba(0, 0, 0, .62);
                }
                #${UI_IDS.modal} .novel-translator-dialog {
                    background: #222428;
                    color: #e8e8ea;
                    box-shadow: 0 12px 40px rgba(0, 0, 0, .6);
                }
                #${UI_IDS.modal} .novel-translator-subtitle {
                    color: #9a9ea5;
                }
                #${UI_IDS.modal} input[type="text"],
                #${UI_IDS.modal} input[type="url"],
                #${UI_IDS.modal} input[type="password"],
                #${UI_IDS.modal} select {
                    background: #191a1d;
                    border-color: #3d4046;
                    color: #e8e8ea;
                }
                #${UI_IDS.modal} .novel-translator-key-toggle:hover {
                    background: rgba(255, 255, 255, .08);
                }
                #${UI_IDS.modal} .novel-translator-actions button {
                    background: #2a2c31;
                    border-color: #3d4046;
                    color: #e8e8ea;
                }
                #${UI_IDS.modal} .novel-translator-actions button:hover {
                    background: #35383e;
                }
                #${UI_IDS.modal} .novel-translator-hint {
                    color: #8f939a;
                }
                #${UI_IDS.toast}.novel-translator-toast-info {
                    background: #3d434c;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ---------------- 设置面板 ----------------

    function getFocusableElements(container) {
        return Array.from(container.querySelectorAll(
            'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
        )).filter((el) => !el.disabled && el.offsetParent !== null);
    }

    function createSettingsPanel() {
        if (document.getElementById(UI_IDS.modal)) {
            return document.getElementById(UI_IDS.modal);
        }

        const settings = getSettings();
        const modal = document.createElement('div');
        modal.id = UI_IDS.modal;
        modal.hidden = true;
        const langOptions = Object.entries(LANGUAGE_LABELS)
            .map(([code, label]) => `<option value="${code}">${label}</option>`)
            .join('');
        modal.innerHTML = `
            <div class="novel-translator-dialog" role="dialog" aria-modal="true" aria-labelledby="novel-translator-settings-title">
                <h2 id="novel-translator-settings-title">小说翻译助手设置</h2>
                <p class="novel-translator-subtitle" id="novel-translator-settings-subtitle"></p>
                <label class="novel-translator-label" for="novel-translator-engine">翻译引擎</label>
                <select id="novel-translator-engine">
                    <option value="free">免费翻译（MyMemory，Google 备用）</option>
                    <option value="llm">OpenAI 兼容 API（更自然，需密钥）</option>
                </select>
                <label class="novel-translator-label" for="novel-translator-target-lang">目标语言</label>
                <input id="novel-translator-target-lang" type="text" list="novel-translator-lang-list"
                       autocomplete="off" spellcheck="false" placeholder="选择或输入语言代码，如 en">
                <datalist id="novel-translator-lang-list">${langOptions}</datalist>
                <div class="novel-translator-llm-fields" hidden>
                    <label class="novel-translator-label" for="novel-translator-api-url">API URL</label>
                    <input id="novel-translator-api-url" type="url" autocomplete="off" spellcheck="false"
                           placeholder="https://api.openai.com/v1/chat/completions">
                    <label class="novel-translator-label" for="novel-translator-api-key">API Key</label>
                    <div class="novel-translator-password-wrap">
                        <input id="novel-translator-api-key" type="password" autocomplete="off" spellcheck="false">
                        <button type="button" class="novel-translator-key-toggle"
                                id="novel-translator-key-toggle" aria-label="显示或隐藏密钥">👁</button>
                    </div>
                    <label class="novel-translator-label" for="novel-translator-model">模型</label>
                    <input id="novel-translator-model" type="text" autocomplete="off" spellcheck="false"
                           placeholder="gpt-3.5-turbo">
                </div>
                <label class="novel-translator-label" for="novel-translator-display-mode">译文显示方式</label>
                <select id="novel-translator-display-mode">
                    <option value="inline">逐段对照（译文在每段原文下方）</option>
                    <option value="translations-only">仅显示译文（隐藏原文）</option>
                </select>
                <label class="novel-translator-check" for="novel-translator-auto-next">
                    <input type="checkbox" id="novel-translator-auto-next">
                    翻译完成后自动跳转到下一章并继续翻译
                </label>
                <p class="novel-translator-hint" id="novel-translator-auto-next-hint"></p>
                <div class="novel-translator-actions">
                    <button type="button" class="novel-translator-close">关闭</button>
                    <button type="button" class="novel-translator-save">保存</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const engine = modal.querySelector('#novel-translator-engine');
        const targetLang = modal.querySelector('#novel-translator-target-lang');
        const apiUrl = modal.querySelector('#novel-translator-api-url');
        const apiKey = modal.querySelector('#novel-translator-api-key');
        const model = modal.querySelector('#novel-translator-model');
        const displayMode = modal.querySelector('#novel-translator-display-mode');
        const autoNext = modal.querySelector('#novel-translator-auto-next');
        const autoNextHint = modal.querySelector('#novel-translator-auto-next-hint');
        const llmFields = modal.querySelector('.novel-translator-llm-fields');
        const keyToggle = modal.querySelector('#novel-translator-key-toggle');
        const subtitle = modal.querySelector('#novel-translator-settings-subtitle');

        engine.value = settings.engine;
        targetLang.value = settings.targetLang;
        apiUrl.value = settings.apiUrl;
        apiKey.value = settings.apiKey;
        model.value = settings.model;
        displayMode.value = settings.displayMode;
        autoNext.checked = Boolean(settings.autoNext);

        const updateVisibility = () => {
            const isLlm = engine.value === 'llm';
            llmFields.hidden = !isLlm;
            subtitle.textContent = `v${SCRIPT_VERSION} · ${isLlm ? 'OpenAI 兼容 API' : '免费翻译'}`;
        };
        engine.addEventListener('change', updateVisibility);
        autoNext.addEventListener('change', () => {
            const adapter = getMatchedAdapter();
            if (autoNext.checked && (!adapter || typeof adapter.getNextUrl !== 'function')) {
                autoNextHint.textContent = '当前站点暂不支持自动翻页，保存后仍会关闭该选项。';
            }
        });
        keyToggle.addEventListener('click', () => {
            const showing = apiKey.type === 'text';
            apiKey.type = showing ? 'password' : 'text';
            keyToggle.textContent = showing ? '👁' : '🙈';
            keyToggle.setAttribute('aria-label', showing ? '显示密钥' : '隐藏密钥');
        });

        modal.querySelector('.novel-translator-close').addEventListener('click', () => closeSettingsModal(modal));
        modal.querySelector('.novel-translator-save').addEventListener('click', () => {
            const adapter = getMatchedAdapter();
            const wantAutoNext = autoNext.checked && adapter && typeof adapter.getNextUrl === 'function';
            const newSettings = {
                engine: engine.value === 'llm' ? 'llm' : 'free',
                targetLang: targetLang.value.trim() || DEFAULT_SETTINGS.targetLang,
                apiUrl: apiUrl.value.trim() || DEFAULT_SETTINGS.apiUrl,
                apiKey: apiKey.value.trim(),
                model: model.value.trim() || DEFAULT_SETTINGS.model,
                displayMode: displayMode.value === 'translations-only' ? 'translations-only' : 'inline',
                autoNext: wantAutoNext
            };
            if (autoNext.checked && !wantAutoNext) {
                autoNext.checked = false;
                autoNextHint.textContent = '当前站点不支持自动翻页，已自动关闭该选项。';
                return;
            }
            if (saveSettings(newSettings)) {
                closeSettingsModal(modal);
                showToast('设置已保存', 'success', 1800);
            } else {
                showToast('设置保存失败，请稍后重试', 'error');
            }
        });
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeSettingsModal(modal);
            }
        });
        modal.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeSettingsModal(modal);
                return;
            }
            if (event.key === 'Tab') {
                const focusables = getFocusableElements(modal);
                if (focusables.length === 0) {
                    event.preventDefault();
                    return;
                }
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        });
        const loadForm = () => {
            const current = getSettings();
            engine.value = current.engine;
            targetLang.value = current.targetLang;
            apiUrl.value = current.apiUrl;
            apiKey.value = current.apiKey;
            model.value = current.model;
            displayMode.value = current.displayMode;
            autoNext.checked = Boolean(current.autoNext);
            const adapter = getMatchedAdapter();
            if (!adapter || typeof adapter.getNextUrl !== 'function') {
                autoNext.disabled = true;
                autoNextHint.textContent = '当前站点暂不支持自动翻页功能。';
            } else {
                autoNext.disabled = false;
                autoNextHint.textContent = current.autoNext
                    ? '已开启：翻译完成后将自动跳转下一章并继续翻译。'
                    : '开启后，翻译完成将自动跳转下一章并继续，直到章节末尾或你关闭此选项。';
            }
            updateVisibility();
        };
        modal._loadForm = loadForm;
        loadForm();
        return modal;
    }

    function openSettingsModal() {
        const modal = createSettingsPanel();
        modal._previousFocus = document.activeElement;
        if (typeof modal._loadForm === 'function') {
            modal._loadForm();
        }
        modal.hidden = false;
        const engine = modal.querySelector('#novel-translator-engine');
        engine.focus();
    }

    function closeSettingsModal(modal) {
        modal.hidden = true;
        const previous = modal._previousFocus;
        delete modal._previousFocus;
        if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
            try {
                previous.focus();
            } catch (error) {
                // 忽略焦点恢复失败
            }
        }
    }

    // ---------------- 悬浮工具栏（拖拽 / 收起 / 快捷键） ----------------

    function applyUiPosition(root, position) {
        if (position && typeof position.x === 'number' && typeof position.y === 'number') {
            root.style.right = 'auto';
            root.style.bottom = 'auto';
            root.style.left = `${Math.max(0, Math.min(position.x, window.innerWidth - 60))}px`;
            root.style.top = `${Math.max(0, Math.min(position.y, window.innerHeight - 60))}px`;
        }
    }

    function saveUiPosition(root) {
        const rect = root.getBoundingClientRect();
        try {
            GM_setValue('uiPos', { x: Math.round(rect.left), y: Math.round(rect.top) });
        } catch (error) {
            logError('保存按钮位置失败', error);
        }
    }

    function setCollapsed(root, collapsed) {
        root.classList.toggle('nt-collapsed', collapsed);
        try {
            GM_setValue('uiCollapsed', collapsed ? 1 : 0);
        } catch (error) {
            logError('保存收起状态失败', error);
        }
    }

    function createFloatingToolbar() {
        const root = document.createElement('div');
        root.id = UI_IDS.root;

        const bar = document.createElement('div');
        bar.id = UI_IDS.bar;
        bar.className = 'nt-bar';
        bar.setAttribute('role', 'toolbar');
        bar.setAttribute('aria-label', '小说翻译助手工具栏');

        const dragHandle = document.createElement('button');
        dragHandle.id = UI_IDS.dragHandle;
        dragHandle.type = 'button';
        dragHandle.className = 'nt-icon-btn';
        dragHandle.textContent = '≡';
        dragHandle.title = '拖动移动工具栏，双击收起';
        dragHandle.setAttribute('aria-label', '拖动工具栏，双击收起');

        const translateButton = document.createElement('button');
        translateButton.id = UI_IDS.translateButton;
        translateButton.type = 'button';
        translateButton.className = 'nt-btn';
        translateButton.textContent = DEFAULT_BUTTON_LABEL;
        translateButton.title = '翻译本章（Alt+T）';
        translateButton.addEventListener('click', () => translateChapter(translateButton));

        const toggleButton = document.createElement('button');
        toggleButton.id = UI_IDS.toggleButton;
        toggleButton.type = 'button';
        toggleButton.className = 'nt-icon-btn';
        toggleButton.textContent = '👁';
        toggleButton.title = '暂无译文可切换';
        toggleButton.disabled = true;
        toggleButton.addEventListener('click', toggleTranslationVisibility);

        const settingsButton = document.createElement('button');
        settingsButton.id = UI_IDS.settingsButton;
        settingsButton.type = 'button';
        settingsButton.className = 'nt-icon-btn';
        settingsButton.textContent = '⚙';
        settingsButton.title = '设置（Alt+S）';
        settingsButton.setAttribute('aria-label', '打开设置');
        settingsButton.addEventListener('click', openSettingsModal);

        const miniButton = document.createElement('button');
        miniButton.id = UI_IDS.miniButton;
        miniButton.type = 'button';
        miniButton.textContent = '译';
        miniButton.title = '展开工具栏';
        miniButton.setAttribute('aria-label', '展开工具栏');
        miniButton.addEventListener('click', () => setCollapsed(root, false));

        bar.append(dragHandle, translateButton, toggleButton, settingsButton);
        root.append(bar, miniButton);
        document.body.appendChild(root);

        // 拖拽
        let dragState = null;
        dragHandle.addEventListener('pointerdown', (event) => {
            if (event.button !== 0 || root.classList.contains('nt-collapsed')) {
                return;
            }
            const rect = root.getBoundingClientRect();
            dragState = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                baseLeft: rect.left,
                baseTop: rect.top
            };
            root.style.right = 'auto';
            root.style.bottom = 'auto';
            try {
                dragHandle.setPointerCapture(event.pointerId);
            } catch (error) {
                // 指针捕获失败时退回普通监听
            }
        });
        dragHandle.addEventListener('pointermove', (event) => {
            if (!dragState || event.pointerId !== dragState.pointerId) {
                return;
            }
            const left = dragState.baseLeft + (event.clientX - dragState.startX);
            const top = dragState.baseTop + (event.clientY - dragState.startY);
            root.style.left = `${Math.max(0, Math.min(left, window.innerWidth - 60))}px`;
            root.style.top = `${Math.max(0, Math.min(top, window.innerHeight - 60))}px`;
            root.style.right = 'auto';
            root.style.bottom = 'auto';
        });
        const endDrag = (event) => {
            if (!dragState || event.pointerId !== dragState.pointerId) {
                return;
            }
            saveUiPosition(root);
            dragState = null;
        };
        dragHandle.addEventListener('pointerup', endDrag);
        dragHandle.addEventListener('pointercancel', endDrag);

        // 双击收起
        dragHandle.addEventListener('dblclick', (event) => {
            event.preventDefault();
            setCollapsed(root, !root.classList.contains('nt-collapsed'));
        });

        // 恢复持久化状态
        let uiPosition = null;
        try {
            uiPosition = GM_getValue('uiPos', null);
        } catch (error) {
            logError('读取按钮位置失败', error);
        }
        applyUiPosition(root, uiPosition);
        let collapsed = false;
        try {
            collapsed = GM_getValue('uiCollapsed', 0) === 1;
        } catch (error) {
            logError('读取收起状态失败', error);
        }
        if (collapsed) {
            setCollapsed(root, true);
        }
        return root;
    }

    function registerKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            if (!event.altKey || event.ctrlKey || event.metaKey || event.repeat) {
                return;
            }
            const key = event.key.toLowerCase();
            const button = document.getElementById(UI_IDS.translateButton);
            if (key === 't' && button) {
                event.preventDefault();
                translateChapter(button);
            } else if (key === 'h') {
                const anyTranslation = document.querySelectorAll('.novel-translation, .novel-translation-block').length > 0;
                if (anyTranslation) {
                    event.preventDefault();
                    toggleTranslationVisibility();
                }
            } else if (key === 's') {
                event.preventDefault();
                openSettingsModal();
            }
        });
    }

    // ---------------- 初始化 ----------------

    function injectUI() {
        if (document.getElementById(UI_IDS.root)) {
            return;
        }
        injectStyles();
        const root = createFloatingToolbar();
        createSettingsPanel();
        registerKeyboardShortcuts();
        root.dataset.tlVisible = '1';
    }

    function init() {
        const adapter = getMatchedAdapter();
        if (!adapter) {
            clearStaleAutoTarget();
            return;
        }
        injectUI();
        handleAutoContinue();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
