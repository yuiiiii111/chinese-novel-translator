# 小说翻译助手

一个面向 Tampermonkey 的浏览器用户脚本，用于在支持的中文小说章节页面中，将正文翻译成指定语言并直接显示在原文下方。

## 项目简介

小说翻译助手通过站点适配器读取章节正文，调用 Google Translate 非官方接口或 OpenAI 兼容的大语言模型接口完成翻译。翻译结果会按章节路径缓存在 Tampermonkey 存储中，重复打开同一章节时可以直接使用缓存。

本项目是一个纯前端用户脚本，不需要构建工具、后端服务或额外依赖。

## 功能特性

- 支持起点中文网、晋江文学城和番茄小说。
- 支持 Google Translate 和 OpenAI 兼容 API 两种翻译引擎。
- 按每批 5 段并发翻译，减少等待时间并避免一次请求过大。
- 翻译失败时自动重试一次，单次请求超时为 10 秒。
- 以章节路径为键缓存翻译结果。
- 悬浮式“翻译本章”和设置按钮，不改变原页面正文。
- 翻译结果采用独立样式显示，重复翻译前会自动清理旧译文。
- 设置通过 Tampermonkey 持久化保存。

## 安装方法（Tampermonkey）

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展。
2. 打开 Tampermonkey 管理面板，选择“添加新脚本”。
3. 将 `novel-translator.user.js` 的完整内容复制到编辑器中，覆盖默认模板。
4. 保存脚本，并确认脚本开关处于启用状态。
5. 打开支持的小说章节页面，页面右下角会出现绿色的“翻译本章”按钮。

如果浏览器或 Tampermonkey 提示跨域请求权限，请允许脚本访问翻译服务域名。使用大模型引擎时，还需要允许访问所配置的 API 域名。

## 支持站点表

| 站点 | URL 匹配 | 正文选择器 | 处理方式 |
| --- | --- | --- | --- |
| 起点中文网 | `www.qidian.com/chapter/` | `.read-content` 内的 `p` | 按段落翻译 |
| 晋江文学城 | `www.jjwxc.net` | `.noveltext` | 按换行拆分 |
| 番茄小说 | `fanqienovel.com` | `.page-content` 内的 `p` | 按段落翻译 |

站点页面结构可能随网站改版而变化。如果按钮没有出现，通常是当前页面不符合适配器 URL 或正文选择器规则。

## 翻译引擎配置说明

点击右下角齿轮按钮即可打开设置面板。

### Google Translate

- 引擎选择：`Google Translate`
- 目标语言：填写语言代码，例如 `en`（英语）、`ja`（日语）、`ko`（韩语）或 `zh-CN`（简体中文）。
- 不需要填写 API URL、API Key 和模型。

脚本使用 `translate.googleapis.com/translate_a/single` 非官方接口。该接口可能受服务端策略、访问频率或地区网络影响。

### OpenAI 兼容 API

- 引擎选择：`OpenAI 兼容 API`
- 目标语言：填写目标语言代码或名称。
- API URL：填写完整的聊天补全接口地址，例如 `https://api.openai.com/v1/chat/completions`。
- API Key：填写服务商提供的密钥。密钥只保存在当前浏览器的 Tampermonkey 存储中。
- 模型：填写服务商支持的模型名称，例如 `gpt-3.5-turbo`。

脚本发送的提示词格式为：

```text
请将以下内容翻译成[目标语言]，只返回译文：
[文本]
```

API 服务必须返回 OpenAI 兼容的 `choices[0].message.content` 字段。

## 使用流程

1. 打开支持的章节页面。
2. 点击“翻译本章”。
3. 脚本识别正文并检查章节缓存。
4. 未命中缓存时，按每批 5 段并发请求翻译服务。
5. 译文显示在对应原文下方；重新翻译前会清除旧译文。

## 截图占位

> 截图占位：此处可放置支持站点页面中悬浮按钮、设置面板和译文效果的截图。

![小说翻译助手界面截图占位](docs/screenshot.png)

## 免责声明

本项目仅供学习、研究和个人辅助阅读使用。请遵守目标网站的服务条款、所在地区法律法规以及版权相关规定，不要绕过访问限制、批量抓取或传播受版权保护的内容。翻译结果由第三方服务生成，可能存在错误，不应视为专业翻译、出版内容或事实依据。

API Key 属于敏感信息。虽然脚本使用 Tampermonkey 存储保存设置，但浏览器扩展环境和第三方接口仍可能存在安全风险，请使用额度受限、权限适当的密钥，并自行承担使用第三方服务产生的费用与风险。

## 贡献指南

欢迎提交问题反馈和适配器改进。

### 添加新适配器

在 `novel-translator.user.js` 的 `adapters` 数组中添加一个对象，至少包含：

```javascript
{
    name: '示例站点',
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

`match` 用于判断当前 URL 是否由适配器处理；`getContent()` 返回包含 `element` 和 `text` 的正文片段；`getContainer()` 返回正文容器。对于没有独立段落元素的站点，可以让 `element` 为 `null`，脚本会把译文追加到正文容器末尾。

提交前请至少检查：

- URL 匹配不会误伤其他站点。
- 正文选择器只读取小说正文。
- 空段落、广告和导航内容不会被翻译。
- 重复点击翻译按钮不会产生重复译文。
- Google Translate 和 OpenAI 兼容 API 两种引擎都能正常工作。

## MIT 许可证说明

本项目使用 MIT 许可证。你可以自由使用、复制、修改和分发，但需要保留原许可证和版权声明。完整条款请参见 [LICENSE](LICENSE)。

