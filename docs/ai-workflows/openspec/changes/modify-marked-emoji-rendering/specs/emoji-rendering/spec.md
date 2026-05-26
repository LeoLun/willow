# Marked Emoji 渲染规范

## 需求

### R1: Emoji 自动检测与包裹

- Markdown 解析器在渲染非代码块（CodeBlock/inline code）的文本时，MUST 将所有的标准 Unicode Emoji 识别出来。
- 每一个识别出来的 Emoji MUST 被渲染为一个具有指定样式的 HTML `<span>` 标签，内容为该 Emoji 字符原样，不使用任何外部图片。
- 渲染出的 Emoji 标签形式如：`<span class="willow-emoji">[EMOJI]</span>`。

### R2: 本地 OpenMoji 字体与对齐要求

- 项目中内置 `OpenMoji-Color.woff2` 本地字体文件。
- `willow-emoji` 的 CSS 样式中，其 `font-family` 必须优先指定为 `'OpenMoji Color'`，并以下列字体作为回退：`'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji', sans-serif`。
- 该 `<span>` 标签的 CSS 样式 MUST 满足：
  - `display: inline-block`
  - `font-size: 1.25em` (微调 Emoji 大小使其醒目)
  - `line-height: 1`
  - `vertical-align: -0.15em` (与周围文本基线对齐)

### R3: 加载容错与降级

- 当由于不可控原因（例如字体加载慢）未渲染完成时，浏览器会自动根据字体回退链，降级显示系统自带的原生 Unicode Emoji 文本字符，绝对不允许出现裂图或空白。

## 验收标准

- [ ] 输入 `Hello 😀 World`，在页面上 `😀` 被渲染为 `<span class="willow-emoji">😀</span>`，且视觉上表现为 OpenMoji 彩色风格。
- [ ] 离线状态下运行，Emoji 正常渲染，不产生任何网络请求，不会出现裂图。
- [ ] 代码块（如 ` ```😀``` ` 或 `` `😀` ``）内的 emoji **绝不能** 被解析或包裹。
