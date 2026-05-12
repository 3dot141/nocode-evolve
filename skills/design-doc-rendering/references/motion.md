# 动效 Recipe（design-doc 场景）

> 配合 `aesthetics.md`。一个高质量 page-load staggered reveal **胜过** 5 个散落 micro-interaction。

## Iron Law

- design-doc 是技术文档，动效**克制 > 抢眼**
- 一份文档**最多 3 处** motion；超过 = 视觉噪音
- 永远 respect `prefers-reduced-motion`

## Recipe 1：page-load staggered reveal（强烈推荐）

首屏元素淡入 + 微微上推，每个元素错开 80-120ms。让 doc 第一眼"有呼吸感"，不是甩在屏上。

```css
@keyframes rise-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

main > * {
  opacity: 0;
  animation: rise-in 480ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* 错开：每个延迟一档 */
main > *:nth-child(1) { animation-delay: 0ms; }
main > *:nth-child(2) { animation-delay: 80ms; }
main > *:nth-child(3) { animation-delay: 160ms; }
main > *:nth-child(4) { animation-delay: 240ms; }
main > *:nth-child(5) { animation-delay: 320ms; }
main > *:nth-child(n+6) { animation-delay: 400ms; }

@media (prefers-reduced-motion: reduce) {
  main > * { animation: none; opacity: 1; }
}
```

**何时用**：所有 design doc 默认推荐。延迟控制：首 5 个元素错开，后面统一 400ms 避免太慢。

## Recipe 2：scroll-trigger fade（章节进入视口时）

章节滚到视口时淡入。让长 doc 滚起来有节奏，不是"瞬间出现一坨"。

```css
.reveal {
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 600ms ease-out, transform 600ms cubic-bezier(0.16, 1, 0.3, 1);
}
.reveal.in-view {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1; transform: none; transition: none; }
}
```

```js
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in-view');
      io.unobserve(e.target);
    }
  });
}, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });

document.querySelectorAll('article > h2, article > h3, article > pre, article > table').forEach(el => {
  el.classList.add('reveal');
  io.observe(el);
});
```

**何时用**：长 doc（> 5 个 H2 章节）。短 doc 不需要——page-load reveal 已经够。

## Recipe 3：details / 折叠平滑展开

HTML 原生 `<details>` 展开瞬间 = 突兀。加渐进 + 旋转箭头。

```css
details > summary {
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 8px;
}
details > summary::-webkit-details-marker { display: none; }
details > summary::before {
  content: "▸";
  display: inline-block;
  transition: transform 180ms ease, color 150ms ease;
}
details[open] > summary::before {
  transform: rotate(90deg);
  color: var(--accent);
}

/* 内容渐进 */
details[open] > :not(summary) {
  animation: detail-open 220ms ease-out;
}
@keyframes detail-open {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

**何时用**：Review Log / Alternatives Considered / 长备选清单。

## Recipe 4：hover surprise（克制版）

链接 / 表格行 / 折叠头的 hover——**色变 + 微位移**，不要弹跳。

```css
a {
  position: relative;
  transition: color 150ms ease;
}
a::after {
  content: "";
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 100%;
  height: 1px;
  background: currentColor;
  transform: scaleX(0);
  transform-origin: right;
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}
a:hover::after {
  transform: scaleX(1);
  transform-origin: left;
}

/* 表格行 */
tbody tr {
  transition: background 150ms ease, transform 150ms ease;
}
tbody tr:hover {
  background: var(--hover-bg);
  /* 不要 transform: translateX(N)——行内有 text 会重排 */
}
```

**何时用**：链接和表格——这是 doc 的两个主要 hover 区。

## Recipe 5：TOC active 切换（连贯感）

TOC active 切换默认是"瞬间换 class"——感觉跳。加 transition 让眼睛能跟。

```css
.toc a {
  position: relative;
  transition: color 200ms ease, background 200ms ease;
}
.toc a::before {
  content: "";
  position: absolute;
  left: -2px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: var(--accent);
  transform: scaleY(0);
  transform-origin: center;
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}
.toc a.active::before {
  transform: scaleY(1);
}
```

## Recipe 6：reading progress bar（顶部细线）

scroll 进度可视化。极简、不干扰。

```css
.progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 2px;
  width: 0%;
  background: linear-gradient(90deg, var(--brand), var(--accent));
  z-index: 1000;
  transition: width 80ms linear;
}
```

```js
const bar = document.querySelector('.progress');
window.addEventListener('scroll', () => {
  const h = document.documentElement.scrollHeight - window.innerHeight;
  bar.style.width = h > 0 ? (window.scrollY / h * 100) + '%' : '0';
}, { passive: true });
```

**何时用**：长 doc（> 2 屏）。短 doc 不需要——加了反而显冗余。

## NEVER

- ❌ 弹跳 (cubic-bezier overshoot)——design doc 不是 toy
- ❌ 旋转 360° / 翻转——分散注意力
- ❌ autoplay video 背景——文档不是 marketing
- ❌ 抢眼 cursor 跟随效果——抢戏
- ❌ 同时启用 5+ recipe——选 2-3 个就好
- ❌ 忘记 `prefers-reduced-motion`——accessibility 失分

## 推荐组合（按 flavor）

| flavor | 推荐 recipe |
|---|---|
| brutally minimal / editorial luxury | 1 + 5（极克制）|
| industrial / linear-precision | 1 + 2 + 5（标准）|
| editorial / mintlify | 1 + 2 + 6（含 progress）|
| vintage computing / terminal-mono | 5 + scanline 静态背景（动效降到最低）|
| brutalist | 1（仅 page-load）|
| playful / posthog | 1 + 2 + 4（最多 motion）|
| tufte-essay | 不加 motion——静止是 Tufte 的灵魂 |

## Performance 检查

- 所有 animation 用 `transform` + `opacity`——避免 `width / height / top / left` 触发 layout
- `IntersectionObserver` 用 `unobserve` 让一次性触发后回收
- 避免在 scroll handler 里做 layout query（用 `requestAnimationFrame` 节流）
