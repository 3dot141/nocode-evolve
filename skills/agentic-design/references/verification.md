# verification — 验收

设计的最后一步不是"看起来对"，是"经得起逐元素检查"。肉眼在十几万像素的长图上漏掉裁切的概率，远高于脚本。

## 三类必检问题

这三类都真实发生过，不是假想：

| 问题 | 成因 | 症状 |
|---|---|---|
| 标签被裁 | 父容器 `overflow:hidden` + 子元素负 `top` | 板标题整条消失 |
| 轨道塌陷 | grid 用 `repeat(n,1fr)` 而非 `minmax(0,1fr)` | 某列被内容挤窄，相邻元素溢出到隔壁屏 |
| 元素越界 | absolute 元素超出父容器 | 菜单/对话框压到手机外 |

## 检测脚本

在文档目录的上一级跑，`DIR` 指向设计稿目录：

```bash
node -e "
const {chromium}=require('<playwright 路径>');
const fs=require('fs'),path=require('path');
const DIR='<design-demos 绝对路径>';
(async()=>{
 const b=await chromium.launch();
 const c=await b.newContext({viewport:{width:1440,height:900}});
 const p=await c.newPage();
 let bad=0;
 for(const f of fs.readdirSync(DIR).filter(f=>f.endsWith('.html'))){
   await p.goto('file://'+path.join(DIR,f));
   await p.waitForTimeout(120);
   const r=await p.evaluate(()=>{
     const clip=[],box=[];
     // 1) 标签是否被最近的 overflow 祖先裁掉
     document.querySelectorAll('.lb,.tag').forEach(el=>{
       const b=el.getBoundingClientRect();
       let c=el.parentElement;
       while(c && getComputedStyle(c).overflow==='visible') c=c.parentElement;
       if(c && b.top < c.getBoundingClientRect().top-2) clip.push('label被裁');
     });
     // 2) 主屏宽度是否一致（缩略原型除外）
     document.querySelectorAll('.phone').forEach(ph=>{
       if(ph.closest('.uxshot')) return;
       const w=ph.getBoundingClientRect().width;
       if(Math.abs(w-350)>8) box.push('屏宽'+Math.round(w));
     });
     return {clip:[...new Set(clip)],box:[...new Set(box)]};
   });
   if(r.clip.length||r.box.length){bad++;console.log(f,'|',r.clip.join(','),'|',r.box.join(','));}
 }
 console.log('有问题的文档:',bad);
 await b.close();
})();
"
```

结果必须为 `有问题的文档: 0`，否则先修再重渲染。

## 越界检测（单独跑，需区分刻意滚动）

```bash
node -e "
const {chromium}=require('<playwright 路径>');
(async()=>{
 const b=await chromium.launch();
 const c=await b.newContext({viewport:{width:1440,height:900}});
 const p=await c.newPage();
 await p.goto('file://<文档绝对路径>');
 await p.waitForTimeout(150);
 console.log(JSON.stringify(await p.evaluate(()=>{
   const out=[];
   document.querySelectorAll('.phone').forEach((ph,i)=>{
     const pr=ph.getBoundingClientRect();
     ph.querySelectorAll('*').forEach(el=>{
       const r=el.getBoundingClientRect();
       if(r.width===0||r.height===0) return;
       if(r.left<pr.left-2||r.right>pr.right+2||r.bottom>pr.bottom+2)
         out.push({i, cls:el.className.toString().slice(0,20)});
     });
   });
   return [...new Map(out.map(o=>[o.i+o.cls,o])).values()];
 }),null,1));
 await b.close();
})();
"
```

**白名单**：横向滚动容器内的元素越界是刻意的（如来源胶囊、图片组），不修。判断方法：该元素在 `overflow-x:auto` 的祖先内。

## 截图口径

- 视口 `1440×900`，`fullPage: true`，`deviceScaleFactor: 2`
- 输出与 HTML 同目录同名 `.png`
- 截图是**自查工具与最终交付物**，不是逐张汇报素材。改完一处就重渲染一次，但只在用户要求时逐张展示。

批量重渲染：

```bash
for f in <design-demos>/*.html; do
  n=$(basename "$f" .html); [ "$n" = "index" ] && continue
  node <shot-one.cjs> "$n" 1440 900 >/dev/null 2>&1
done
```

## 审核清单

用户复核前，主 agent 自己过一遍：

- [ ] 结构检测：`有问题的文档: 0`
- [ ] 越界检测：除白名单外无越界
- [ ] 抽查：每份至少看第一屏与最后一屏，确认无遮挡
- [ ] 一致性：HTML 改过之后 PNG 已重渲染
- [ ] 对齐清单：设计与现有实现的差异已逐条列出（不是笼统"有差异"）

## 通过线

由主 agent 判断，三条同时满足才算通过：

1. 检测脚本零问题，或有明确白名单（刻意的滚动裁切）
2. 抽查的屏幕在视觉上完整：状态栏、顶栏、内容、底部指示条都在位
3. 没有"我知道有问题但先放着"的条目——有就记进对齐清单，不默默通过
