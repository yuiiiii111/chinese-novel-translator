// ==UserScript==
// @name         小说翻译助手
// @namespace    https://github.com/novel-translator
// @version      0.1.0
// @description  在支持的小说网站中翻译章节正文
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_log
// @connect      translate.googleapis.com
// @connect      api.openai.com
// @connect      *
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const DEFAULT_SETTINGS = {
        engine: 'google',
        targetLang: 'en',
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        model: 'gpt-3.5-turbo'
    };

    const UI_IDS = {
        root: 'novel-translator-ui',
        translateButton: 'novel-translator-button',
        settingsButton: 'novel-translator-settings-button',
        modal: 'novel-translator-settings-modal'
    };

    const adapters = [
        {
            name: '起点中文网',
            match: /www\.qidian\.com\/chapter\//i,
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
                return document.querySelector('.read-content');
            }
        },
        {
            name: '晋江文学城',
            match: /www\.jjwxc\.net/i,
            getContent() {
                const container = this.getContainer();
                if (!container) {
                    return [];
                }

                const copy = container.cloneNode(true);
                copy.querySelectorAll('.novel-translation').forEach((node) => node.remove());
                const content = copy.innerText || copy.textContent;
                return content
                    .split(/\r?\n+/)
                    .map((text) => cleanText(text))
                    .filter(Boolean)
                    .map((text) => ({ element: null, text }));
            },
            getContainer() {
                return document.querySelector('.noveltext');
            }
        },
        {
            name: '番茄小说',
            match: /fanqienovel\.com/i,
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
                return document.querySelector('.page-content');
            }
        }
    ];

    function cleanText(value) {
        return String(value || '')
            .replace(/[\u00a0\u200b\ufeff]/g, ' ')
            .replace(/[ \t]+/g, ' ')
            .trim();
    }

    function getMatchedAdapter() {
        const url = window.location.href;
        return adapters.find((adapter) => adapter.match.test(url)) || null;
    }

    function getSettings() {
        try {
            const stored = GM_getValue('settings', {});
            const settings = Object.assign({}, DEFAULT_SETTINGS, stored || {});
            settings.targetLang = String(settings.targetLang || '').trim() || DEFAULT_SETTINGS.targetLang;
            settings.apiUrl = String(settings.apiUrl || '').trim() || DEFAULT_SETTINGS.apiUrl;
            settings.model = String(settings.model || '').trim() || DEFAULT_SETTINGS.model;
            settings.apiKey = String(settings.apiKey || '').trim();
            return settings;
        } catch (error) {
            logError('读取设置失败', error);
            return Object.assign({}, DEFAULT_SETTINGS);
        }
    }

    function saveSettings(settings) {
        try {
            const mergedSettings = Object.assign({}, DEFAULT_SETTINGS, settings || {});
            mergedSettings.targetLang = String(mergedSettings.targetLang || '').trim() || DEFAULT_SETTINGS.targetLang;
            mergedSettings.apiUrl = String(mergedSettings.apiUrl || '').trim() || DEFAULT_SETTINGS.apiUrl;
            mergedSettings.model = String(mergedSettings.model || '').trim() || DEFAULT_SETTINGS.model;
            mergedSettings.apiKey = String(mergedSettings.apiKey || '').trim();
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
                        content: `请将以下内容翻译成${targetLang}，只返回译文：\n${text}`
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
                const translation = await googleTranslate(text, targetLang);
                if (!translation) {
                    throw new Error('Google Translate 未返回译文');
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

    async function translateWithConcurrency(texts, targetLang, settings, batchSize = 5) {
        const translations = [];
        for (let start = 0; start < texts.length; start += batchSize) {
            const batch = texts.slice(start, start + batchSize);
            const batchTranslations = await Promise.all(
                batch.map((text) => translateText(text, targetLang, settings))
            );
            translations.push(...batchTranslations);
        }
        return translations;
    }

    function delay(milliseconds) {
        return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
    }

    async function extractContentWithRetry(adapter, maxRetries = 3, interval = 500) {
        if (document.readyState === 'loading') {
            await new Promise((resolve) => {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
            });
        }

        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
            const container = adapter.getContainer();
            const segments = container ? adapter.getContent() : [];

            if (container && segments.length > 0) {
                return { container, segments };
            }

            if (attempt < maxRetries) {
                await delay(interval);
            }
        }

        return {
            container: adapter.getContainer(),
            segments: []
        };
    }

    function getCacheKey() {
        return `cache_${window.location.pathname}`;
    }

    function readCache(sourceTexts, settings) {
        try {
            const storedCache = GM_getValue(getCacheKey(), null);
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

    function writeCache(sourceTexts, translations, settings) {
        try {
            GM_setValue(getCacheKey(), JSON.stringify({
                targetLang: settings.targetLang,
                sourceTexts,
                translations,
                savedAt: Date.now()
            }));
        } catch (error) {
            logError('保存缓存失败', error);
        }
    }

    function clearTranslation() {
        document.querySelectorAll('.novel-translation').forEach((node) => node.remove());
    }

    function createTranslationNode(text) {
        const node = document.createElement('div');
        node.className = 'novel-translation';
        node.textContent = text;
        return node;
    }

    function displayTranslation(segments, translations, container) {
        const hasElements = segments.some((segment) => segment.element && segment.element.nodeType === 1);
        if (hasElements) {
            segments.forEach((segment, index) => {
                if (!segment.element || segment.element.nodeType !== 1) {
                    return;
                }
                const node = createTranslationNode(translations[index] || '翻译失败，请重试');
                segment.element.insertAdjacentElement('afterend', node);
            });
            return;
        }

        const fragment = document.createDocumentFragment();
        translations.forEach((translation) => fragment.appendChild(createTranslationNode(translation || '翻译失败，请重试')));
        container.appendChild(fragment);
    }

    async function translateChapter(button) {
        const adapter = getMatchedAdapter();
        if (!adapter || button.disabled) {
            return;
        }

        clearTranslation();
        setButtonState(button, '翻译中...', true);

        const settings = getSettings();
        if (settings.engine === 'llm' && !settings.apiKey) {
            setButtonState(button, '翻译本章', false);
            window.alert('请先在设置中填写 API Key');
            return;
        }

        try {
            const { container, segments } = await extractContentWithRetry(adapter, 3, 500);
            if (!container || !segments.length) {
                setButtonState(button, '翻译本章', false);
                window.alert('无法提取正文内容');
                return;
            }

            const sourceTexts = segments.map((segment) => segment.text);
            let translations = readCache(sourceTexts, settings);
            if (!translations) {
                translations = await translateWithConcurrency(sourceTexts, settings.targetLang, settings, 5);
                if (translations.length > 0 && translations.every((translation) => !translation)) {
                    setButtonState(button, '翻译本章', false);
                    window.alert('翻译失败，请检查设置或网络');
                    return;
                }
                if (translations.every((translation) => typeof translation === 'string' && translation)) {
                    writeCache(sourceTexts, translations, settings);
                }
            }

            displayTranslation(segments, translations, container);
            setButtonState(button, '翻译完成', false);
        } catch (error) {
            logError('翻译章节失败', error);
            setButtonState(button, '翻译失败，重试', false);
            window.alert(`翻译失败：${error.message || '未知错误'}`);
        }
    }

    function setButtonState(button, label, disabled) {
        button.textContent = label;
        button.disabled = disabled;
        button.setAttribute('aria-busy', disabled ? 'true' : 'false');
    }

    function injectStyles() {
        if (document.getElementById('novel-translator-styles')) {
            return;
        }
        const style = document.createElement('style');
        style.id = 'novel-translator-styles';
        style.textContent = `
            #${UI_IDS.root} {
                position: fixed;
                right: 20px;
                bottom: 20px;
                z-index: 2147483646;
                display: flex;
                gap: 8px;
                align-items: center;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            #${UI_IDS.root} button {
                border: 0;
                border-radius: 6px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, .2);
                cursor: pointer;
                font-size: 14px;
                line-height: 1.4;
                transition: opacity .2s ease, transform .2s ease;
            }
            #${UI_IDS.root} button:hover:not(:disabled) {
                transform: translateY(-1px);
            }
            #${UI_IDS.translateButton} {
                padding: 10px 14px;
                color: #fff;
                background: #2e9d57;
            }
            #${UI_IDS.translateButton}:disabled {
                cursor: wait;
                opacity: .7;
            }
            #${UI_IDS.settingsButton} {
                width: 38px;
                height: 38px;
                padding: 0;
                color: #fff;
                background: #4b7f5c;
                font-size: 20px;
            }
            .novel-translation {
                box-sizing: border-box;
                margin: 8px 0 14px;
                padding-left: 10px;
                border-left: 3px solid #2e9d57;
                color: #666;
                line-height: 1.8;
            }
            #${UI_IDS.modal} {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, .45);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            #${UI_IDS.modal} .novel-translator-dialog {
                width: min(460px, calc(100vw - 32px));
                box-sizing: border-box;
                padding: 22px;
                border-radius: 8px;
                background: #fff;
                color: #222;
                box-shadow: 0 8px 30px rgba(0, 0, 0, .25);
            }
            #${UI_IDS.modal} h2 {
                margin: 0 0 18px;
                font-size: 19px;
            }
            #${UI_IDS.modal} label {
                display: block;
                margin: 12px 0 6px;
                font-size: 13px;
                font-weight: 600;
            }
            #${UI_IDS.modal} input,
            #${UI_IDS.modal} select {
                width: 100%;
                box-sizing: border-box;
                padding: 8px 10px;
                border: 1px solid #ccc;
                border-radius: 4px;
                font-size: 14px;
            }
            #${UI_IDS.modal} .novel-translator-llm-fields {
                margin-top: 4px;
            }
            #${UI_IDS.modal} .novel-translator-actions {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                margin-top: 22px;
            }
            #${UI_IDS.modal} .novel-translator-actions button {
                padding: 8px 14px;
                border: 1px solid #ccc;
                border-radius: 4px;
                cursor: pointer;
            }
            #${UI_IDS.modal} .novel-translator-save {
                border-color: #2e9d57 !important;
                color: #fff;
                background: #2e9d57;
            }
            #${UI_IDS.modal} .novel-translator-hint {
                margin: 8px 0 0;
                color: #777;
                font-size: 12px;
                line-height: 1.5;
            }
        `;
        document.head.appendChild(style);
    }

    function createSettingsPanel() {
        if (document.getElementById(UI_IDS.modal)) {
            return document.getElementById(UI_IDS.modal);
        }

        const settings = getSettings();
        const modal = document.createElement('div');
        modal.id = UI_IDS.modal;
        modal.hidden = true;
        modal.innerHTML = `
            <div class="novel-translator-dialog" role="dialog" aria-modal="true" aria-labelledby="novel-translator-settings-title">
                <h2 id="novel-translator-settings-title">小说翻译助手设置</h2>
                <label for="novel-translator-engine">翻译引擎</label>
                <select id="novel-translator-engine">
                    <option value="google">Google Translate</option>
                    <option value="llm">OpenAI 兼容 API</option>
                </select>
                <label for="novel-translator-target-lang">目标语言</label>
                <input id="novel-translator-target-lang" type="text" autocomplete="off" placeholder="例如 en、ja、ko">
                <div class="novel-translator-llm-fields">
                    <label for="novel-translator-api-url">API URL</label>
                    <input id="novel-translator-api-url" type="url" autocomplete="off">
                    <label for="novel-translator-api-key">API Key</label>
                    <input id="novel-translator-api-key" type="password" autocomplete="off">
                    <label for="novel-translator-model">模型</label>
                    <input id="novel-translator-model" type="text" autocomplete="off">
                    <p class="novel-translator-hint">仅选择 OpenAI 兼容 API 时需要填写以上三项。</p>
                </div>
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
        const llmFields = modal.querySelector('.novel-translator-llm-fields');

        engine.value = settings.engine;
        targetLang.value = settings.targetLang;
        apiUrl.value = settings.apiUrl;
        apiKey.value = settings.apiKey;
        model.value = settings.model;

        const updateVisibility = () => {
            llmFields.hidden = engine.value !== 'llm';
        };
        engine.addEventListener('change', updateVisibility);
        modal.querySelector('.novel-translator-close').addEventListener('click', () => closeSettingsModal(modal));
        modal.querySelector('.novel-translator-save').addEventListener('click', () => {
            const newSettings = {
                engine: engine.value === 'llm' ? 'llm' : 'google',
                targetLang: targetLang.value.trim() || DEFAULT_SETTINGS.targetLang,
                apiUrl: apiUrl.value.trim() || DEFAULT_SETTINGS.apiUrl,
                apiKey: apiKey.value.trim(),
                model: model.value.trim() || DEFAULT_SETTINGS.model
            };
            if (saveSettings(newSettings)) {
                closeSettingsModal(modal);
            } else {
                window.alert('设置保存失败，请稍后重试。');
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
            }
        });
        updateVisibility();
        return modal;
    }

    function openSettingsModal() {
        const modal = createSettingsPanel();
        modal.hidden = false;
        const engine = modal.querySelector('#novel-translator-engine');
        engine.focus();
    }

    function closeSettingsModal(modal) {
        modal.hidden = true;
    }

    function createFloatingButton() {
        const root = document.createElement('div');
        root.id = UI_IDS.root;

        const translateButton = document.createElement('button');
        translateButton.id = UI_IDS.translateButton;
        translateButton.type = 'button';
        translateButton.textContent = '翻译本章';
        translateButton.title = '翻译当前章节';
        translateButton.addEventListener('click', () => translateChapter(translateButton));

        const settingsButton = document.createElement('button');
        settingsButton.id = UI_IDS.settingsButton;
        settingsButton.type = 'button';
        settingsButton.textContent = '⚙';
        settingsButton.title = '打开翻译设置';
        settingsButton.setAttribute('aria-label', '打开翻译设置');
        settingsButton.addEventListener('click', openSettingsModal);

        root.append(translateButton, settingsButton);
        return root;
    }

    function injectUI() {
        if (document.getElementById(UI_IDS.root)) {
            return;
        }
        injectStyles();
        document.body.appendChild(createFloatingButton());
        createSettingsPanel();
    }

    function init() {
        if (!getMatchedAdapter()) {
            return;
        }
        injectUI();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
