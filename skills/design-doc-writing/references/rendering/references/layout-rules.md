# Layout：宽屏适配 + 双重 cap 分离（强制规则）

> 从 `SKILL.md` 抽出来作为独立 reference，进入「Layout / 段落 cap」决策时按需 Read。


### 宽屏 (Wide-screen) 跟随 viewport

旧规则 page container 一刀切 `max-width: 1280px`——超宽屏（1920+ / 4K）下整页贴左、右侧大片留白。新规则：**shell 随 viewport 撑开**，只在小屏 / 超宽屏设软上限。

```css
.shell {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  width: min(96vw, 1920px);    /* 默认占 96% viewport，超宽屏 cap 1920 */
  margin: 0 auto;
}

/* 笔记本及窄屏：边距收紧，shell 用满 */
@media (max-width: 1280px) {
  .shell { width: 100%; grid-template-columns: 240px minmax(0, 1fr); }
}

/* 大屏：TOC 适度放宽 */
@media (min-width: 1600px) {
  .shell { grid-template-columns: 300px minmax(0, 1fr); }
}

/* mobile：TOC 折叠 */
@media (max-width: 900px) {
  .shell { grid-template-columns: 1fr; width: 100%; }
}
```

| 屏宽 | shell 实际宽 | TOC | 留给 main |
|---|---|---|---|
| < 900 (mobile) | 100% | 折叠 | viewport - 48 |
| 900-1280 (laptop) | 100% | 240 | viewport - 240 - padding |
| 1280-1600 (desktop) | 96vw | 260 | ~ 96vw - 260 |
| 1600-1920 (wide) | 96vw | 300 | ~ 96vw - 300 |
| ≥ 1920 (4K) | 1920 | 300 | ~ 1620 |

**关键差异**：不再死 cap 1680，而是 `96vw` 跟着屏走——4K 屏（3840）能用到 1920 上限，2560 屏能用 ~2460，1440 屏能用 ~1380。**屏宽得到充分利用**。

### 段落 cap：90ch 不是 72ch

72ch 是 typographic 黄金行宽（"single sentence per line"），但 design doc 大量技术 inline code / 嵌入路径——单 token 占字符多，**实际可读行宽可以放宽到 90ch**（学术界可读性上限 100ch）。

```css
main {
  padding: 56px 64px 120px;
  /* NO max-width here */
}

/* 段落级元素：90ch（约 950-1080px @ 16px Inter） */
p, ul, ol, blockquote, dl { max-width: 90ch; }

/* 宽元素：100% 撑满 main，宽屏 break-out */
pre, table, figure, .hero, .mermaid, details, .problem-block, .logic-block {
  max-width: 100%;
}
```

效果对比（main 可用宽 1500px）：
- 旧 72ch ≈ 720px：右侧空 ~780px（**视觉浪费**，用户反馈"屏幕效果不对"）
- 新 90ch ≈ 1000px：右侧空 ~500px（仍有空白但显著减少，配合多图能填满）

> **typography 取舍声明**：72ch 是单段连续阅读最舒服的；90ch 在技术文档场景"屏宽利用率 + 可读性"的甜点。如果文档是长篇散文（如 PRD 用户场景叙事），可以局部 override 回 72ch。
