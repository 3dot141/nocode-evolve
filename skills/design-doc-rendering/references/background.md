# 背景 / 纹理 Recipe（atmosphere & depth）

> 配合 `aesthetics.md`。Solid color 是 AI slop 默认；本文档提供"被看见 + 不抢戏"的差异化背景。

## Iron Law

- 背景**永远是配角**——它的作用是给文字一个**氛围**，不是**展示自己**
- 永远可关——CDN / data URI 失败时降级到 solid color 也要可读
- 暗黑底色 + 亮文字时，背景纹理 opacity 应 ≤ 4%；亮底相反更克制

## Recipe 1：极轻噪点（最通用，几乎所有 flavor 都能用）

base64 PNG noise texture，CSS `background-image` 直接贴。文件极小（~1KB），不依赖外网。

```css
body {
  background-color: var(--bg);
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
  background-blend-mode: overlay;  /* dark theme */
  /* 或 multiply for light theme */
}
```

**调节**：
- 通过 `opacity` 在 wrapper 上整体淡化
- 通过 SVG `baseFrequency` 控制颗粒粗细（0.5 = 粗、0.85 = 中、1.2 = 细）

**适合**：所有 flavor，特别是 brutally minimal / editorial / industrial。

## Recipe 2：dot grid（蓝图 / 工程感）

精细圆点网格，给 industrial / blueprint 类 doc 一个底层结构感。

```css
body {
  background-color: var(--bg);
  background-image: radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px);
  background-size: 24px 24px;
}
```

**亮底版**：
```css
background-image: radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px);
```

**适合**：industrial / linear-precision / 工程类 design doc。

## Recipe 3：grid lines（图纸网格）

细网格，蓝图 / 测量风。

```css
body {
  background-color: var(--bg);
  background-image:
    linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 32px 32px;
}
```

**适合**：industrial / brutalist / 系统级架构 doc。

## Recipe 4：gradient mesh（hero 区柔光）

仅 hero / metadata 卡片局部用——不要全屏。营造温暖或高级感。

```css
.hero {
  background:
    radial-gradient(at 20% 30%, rgba(94,106,210,0.15) 0%, transparent 50%),
    radial-gradient(at 80% 70%, rgba(16,185,129,0.10) 0%, transparent 50%),
    var(--bg-panel);
}
```

**变体**（按 flavor）：
- editorial luxury：`rgba(122,47,55,0.08)` + `rgba(245,228,194,0.05)` warm tones
- industrial：`rgba(6,182,212,0.08)` blueprint cyan
- vintage computing：`rgba(16,185,129,0.10)` emerald glow
- brutally minimal：**不用**——和气质冲突

**禁用**：紫色 → 粉色 / 蓝色全屏 gradient（最常见 AI slop 配方）。

## Recipe 5：dashed border / ASCII frame（vintage computing）

terminal 美学的边框。可用作 metadata 卡片、code block、blockquote。

```css
.terminal-frame {
  border: 1px dashed rgba(255,255,255,0.25);
  padding: 16px;
  position: relative;
}
.terminal-frame::before {
  content: "┌─── BEGIN ───────────────────────┐";
  position: absolute;
  top: -10px;
  left: 8px;
  background: var(--bg);
  padding: 0 6px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-quat);
  letter-spacing: 0.05em;
}
```

**适合**：terminal-mono / vintage computing flavor。

## Recipe 6：section ruler（测量标尺替代 `<hr>`）

H2 章节分隔不用默认 `<hr>` 横线。改成测量风。

```css
hr, .section-divider {
  border: none;
  height: 8px;
  background-image:
    linear-gradient(to right, var(--border-std) 1px, transparent 1px);
  background-size: 8px 8px;
  background-position: 0 50%;
  background-repeat: repeat-x;
  margin: 40px 0;
  position: relative;
}
hr::after {
  content: "§";
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg);
  padding: 0 12px;
  font-family: var(--font-serif, var(--font-sans));
  font-size: 16px;
  color: var(--text-tertiary);
}
```

**适合**：editorial / brutally minimal。

## Recipe 7：CRT scanline overlay（vintage computing 招牌）

整页叠一层细横线，CRT 显示器质感。**不要让眼花**——用 `pointer-events: none` 别拦交互。

```css
body::after {
  content: "";
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent 0px,
    transparent 2px,
    rgba(255,255,255,0.012) 2px,
    rgba(255,255,255,0.012) 3px
  );
  pointer-events: none;
  z-index: 999;
  mix-blend-mode: overlay;
}
```

**适合**：terminal-mono / vintage computing **only**——其它 flavor 用会显得 cosplay。

## Recipe 8：drop cap（editorial 启动段）

H1 后第一段首字符放大成大写衬线——magazine 风。

```css
article > p:first-of-type::first-letter {
  font-family: var(--font-serif);
  font-size: 4.5em;
  float: left;
  line-height: 0.85;
  margin: 0.1em 0.12em 0 0;
  font-weight: 500;
  color: var(--accent);
}
```

**适合**：editorial / tufte-essay。
**禁用**：technical doc（ADR / RFC）——drop cap 在工程语境违和。

## Recipe 9：margin tick marks（Tufte 风测量刻度）

正文左 margin 加细刻度，每 100vh 一格。Gwern.net 风。

```css
main {
  background-image: linear-gradient(
    to bottom,
    transparent 0,
    transparent 99px,
    var(--border-subtle) 99px,
    var(--border-subtle) 100px,
    transparent 100px
  );
  background-size: 16px 100px;
  background-position: 0 0;
  background-repeat: repeat-y;
}
```

**适合**：tufte-essay / editorial luxury。

## Recipe 10：subtle vignette（hero / heavy doc）

页面四角微微变暗，把眼睛拉回中心。

```css
body::before {
  content: "";
  position: fixed;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.15) 100%);
  pointer-events: none;
  z-index: 998;
}
```

**适合**：dark mode 的 brutally minimal / vintage computing。
**禁用**：light mode（会显得发黑）。

## NEVER

- ❌ 全屏 video 背景
- ❌ 动态流光 / 自动旋转 gradient
- ❌ 大面积 gradient（占整屏）
- ❌ 多个 recipe 叠加（≥ 3 个 = 视觉灾难）
- ❌ 高 opacity 噪点（> 5% 让文字发糊）

## 组合建议（按 flavor）

| flavor | 推荐组合 |
|---|---|
| brutally minimal | 1（极轻噪点 1%）|
| editorial / editorial luxury | 1 + 6（noise + section ruler）+ 8（drop cap）|
| industrial / linear-precision | 2 或 3（dot grid 或 grid lines） + 1 极轻 |
| vintage computing / terminal-mono | 5 + 7（ASCII frame + CRT scanline）|
| brutalist | 6（section ruler）+ 1（noise）|
| tufte-essay | 9（margin ticks）+ 8（drop cap）|
| posthog-playful | 4（gradient mesh，hero 局部）|

## Performance 检查

- SVG noise data URI < 2KB
- 避免 `background-attachment: fixed`（scroll 卡顿）
- `body::before / ::after` 用 `pointer-events: none` 避免拦截交互
- 多层背景在低端设备测试——加 `will-change` 须节制（不必要时不加）
