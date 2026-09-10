# Novel Translator (小说翻译助手)

[**简体中文**](README.md) | **English**

---

> **A userscript built for English speakers who are not native Chinese readers — a translation plugin for Chinese novel websites.**
>
> One click translates chapter text on Chinese web-novel sites (Qidian, Jinjiang, Fanqie and more) into a language you know (English, Japanese, Korean…), displayed right below the original text for side-by-side reading.

A Tampermonkey userscript that reads chapter content through per-site adapters and translates it with free translation services or any OpenAI-compatible LLM API. Translations are cached by site, chapter path and query parameters, target language, and engine configuration in Tampermonkey storage, so translating the same chapter again can reuse its cache.

Pure front-end userscript — no build tools, backend services, or extra dependencies required.

## Features

- Supports Qidian (起点中文网), Jinjiang Literature City (晋江文学城), and Fanqie Novel (番茄小说).
- Two translation engines: free translation and OpenAI-compatible APIs.
- Recognizes current Qidian, Jinjiang, and Fanqie layouts and decodes Fanqie's obfuscated font text before translation.
- Batches 5 paragraphs concurrently with a live progress indicator (e.g. "Translating 12/45"); 10 s request timeout.
- Automatic one-time retry on failure; paragraphs that still fail turn into red clickable nodes — click one to retry that single paragraph.
- Cache separated by site, chapter parameters, target language, engine, and LLM endpoint/model; a successful segment retry updates it automatically.
- Frosted-glass floating toolbar: draggable (position remembered across pages), double-click the handle to collapse it into a small dot.
- Toggle translations on/off anytime (button or `Alt+H`); hiding translations in translations-only mode restores the original text.
- Two display modes: inline side-by-side, or translations-only (original hidden).
- Translation styling follows dark mode, with a subtle fade-in animation; old translations are cleaned up before re-translating.
- All feedback uses in-page toasts instead of browser dialogs.
- Shortcuts: `Alt+T` translate chapter, `Alt+H` toggle translations, `Alt+S` open settings.
- Settings persist via Tampermonkey storage.

## Installation (Tampermonkey)

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension.
2. Open the Tampermonkey dashboard and choose **Create a new script** (添加新脚本).
3. Copy the full content of `novel-translator.user.js` into the editor, replacing the default template.
4. Save (Ctrl+S) and make sure the script switch is enabled.
5. Open a supported chapter page — a green **🌐 Translate chapter** button appears at the bottom-right corner.

If the browser or Tampermonkey asks for cross-origin permission, allow the script to access the translation service domains. When using the LLM engine, also allow the API domain you configured.

> 💡 中文用户请阅读[简体中文 README](README.md)。

## Supported Sites

| Site | URL pattern | Content selector | Handling |
| --- | --- | --- | --- |
| Qidian (起点中文网) | `www.qidian.com/chapter/*`, `read.qidian.com/chapter/*` | `.chapter-wrapper main.content`, with legacy fallbacks | Per-paragraph (auto-next supported) |
| Jinjiang (晋江文学城) | `www.jjwxc.net`, `m.jjwxc.net` | `#paragraph_comment_content` or mobile body | Paragraphs or line breaks |
| Fanqie (番茄小说) | `fanqienovel.com/reader/*` | `.muye-reader-content`, with legacy fallback | Decode font obfuscation, then translate paragraphs |

Site markup may change over time. If the button does not appear, the page usually no longer matches the adapter URL or content selector.

## Toolbar Guide

The floating toolbar at the bottom-right contains, from left to right:

- `≡` handle — drag to move the toolbar (position is remembered); double-click to collapse/expand.
- `🌐 Translate chapter` — translates the whole chapter; shows progress while working and a short summary when done.
- `👁 / 🙈` — show or hide translations (disabled until something is translated).
- `⚙` — open settings.

Shortcuts: `Alt+T` translate, `Alt+H` show/hide translations, `Alt+S` settings.

## Engine Configuration

Open the settings panel with the gear button (or `Alt+S`).

### Free Translation

- Engine: `免费翻译（MyMemory，Google 备用）` (free, no key required)
- Target language: pick from the suggestion list or type a language code, e.g. `en` (English), `ja` (Japanese), `ko` (Korean), `de` (German).
- No API URL, key, or model needed.

The script uses MyMemory first and falls back to Google Translate when needed. Long paragraphs are split by UTF-8 byte length before sending. Availability can still be affected by rate limits or regional network conditions.

### OpenAI-Compatible API

- Engine: `OpenAI 兼容 API（更自然，需密钥）` (more natural results, requires a key)
- Target language: pick or type a language code/name.
- API URL: full chat-completions endpoint, e.g. `https://api.openai.com/v1/chat/completions`.
- API Key: your provider key (click the eye icon to reveal it temporarily). The key is stored only in your browser's Tampermonkey storage.
- Model: a model supported by your provider, e.g. `gpt-3.5-turbo`.

The prompt sent is:

```text
请将以下内容翻译成[目标语言]，只返回译文：
[文本]
```

(That is: "Please translate the following content into [target language] and return only the translation.") The API must return OpenAI-compatible `choices[0].message.content`.

### Display Mode

- Inline side-by-side (default): translation below each original paragraph.
- Translations only: hides the original text and keeps just the translation — handy when you read mostly the translated version.

### Auto-Translate Next Chapter

When enabled, the script jumps to the next chapter only after every paragraph translates successfully, and continues until the last chapter or until you turn the option off. Failed paragraphs pause navigation so you can retry them. After fixing them, click **Translate chapter** again to resume auto-next. Starting another translation cancels the previous pending jump. Currently supported on Qidian chapter pages only; the checkbox is greyed out on Fanqie and Jinjiang pages.

### Upgrading from 0.2.2

Replace the script in Tampermonkey, save, and refresh the chapter page. Existing settings are preserved, and the previous Google free-engine setting is migrated automatically.

## Usage Flow

1. Open a supported chapter page.
2. Click **Translate chapter** or press `Alt+T`.
3. The script detects the content and checks the chapter cache.
4. On a cache miss, it requests translations in batches of 5 concurrent paragraphs while the button shows live progress.
5. Translations appear under each paragraph; failed paragraphs show as red “翻译失败，点击此处重试” (failed — click to retry) nodes.
6. Old translations are removed before re-translating or switching display modes.

## Disclaimer

This project is for learning, research, and personal reading assistance only. Please respect the terms of service of the target websites, your local laws, and copyright regulations — do not bypass access restrictions, scrape in bulk, or redistribute copyrighted content. Translations are generated by third-party services and may contain errors; they should not be treated as professional translation, published content, or factual sources.

API keys are sensitive. Although settings are stored via Tampermonkey storage, browser-extension environments and third-party endpoints still carry security risks. Use a key with limited quota and minimal permissions, and bear any fees or risks of third-party services yourself.

## Contributing

Issues and adapter improvements are welcome.

### Local Checks

With Node.js 20 or newer installed, run (no dependencies required):

```sh
node --check novel-translator.user.js
node --test tests/translator.test.cjs
```

Regression tests use simulated pages and translation responses without calling paid APIs. Live site markup, Tampermonkey cross-origin permissions, and online services still require browser verification.

### Adding a New Adapter

Add an object to the `adapters` array in `novel-translator.user.js`, minimally containing:

```javascript
{
    name: 'Example site',
    match: /example\.com\/chapter\//i,
    getContent() {
        return Array.from(document.querySelectorAll('.chapter-content p'))
            .map((element) => ({ element, text: element.textContent.trim() }))
            .filter((item) => item.text);
    },
    getContainer() {
        return document.querySelector('.chapter-content');
    }
}
```

`match` decides whether the current URL belongs to this adapter; `getContent()` returns content segments with `element` and `text`; `getContainer()` returns the content container. For sites without per-paragraph elements, let `element` be `null` and the script will append translations to the end of the container.

Before submitting, please verify at least:

- The URL match does not accidentally catch other sites.
- The content selector reads only the novel body.
- Empty paragraphs, ads, and navigation content are not translated.
- Repeated clicks on the translate button do not duplicate translations.
- Both the free translation and OpenAI-compatible engines work.

## MIT License

This project is licensed under the MIT License. You are free to use, copy, modify, and distribute it as long as the original license and copyright notice are retained. See [LICENSE](LICENSE) for the full terms.
