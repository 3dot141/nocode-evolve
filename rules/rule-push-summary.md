# git push 后总结的输出格式

> 单源: 本文件是「标题+描述」内容契约的唯一定义处. `dev-finish-branch` 的 PR title/body 生成 (`references/prflow.md` Step 1) 只引用本文件, 不重复字段细节——改契约只改本文件.

## 触发

用户 push 后说「总结 push 内容 / 给标题描述 / PR description / 沉淀这个 / 这次 push 包含什么」类指令时, 或 dev-finish-branch Option 2 (PR) 生成 title/body 时. 中英文同义说法等价适用.

**不触发**: 单纯问"push 完了吗 / push 成功没"等状态查询.

## 输出结构

**标题**: 一行 ≤ 50 字, 概括最大变更轴 (含版本号 if any). 不要逐条罗列 commit, 提炼共同主题.

**描述**: 面向 reviewer / 后续读者, 总长控制在 300 字内 (中文按字计), 两个板块:

```markdown
## 背景
<背景是什么: 这个改动发生在什么上下文里, 1-2 句>
<解决什么问题: 现状哪里不行, 不改会怎样, 1-2 句>

## 方案
<怎么解决的: 关键思路和取舍, 落到具体文件/模块, 不空泛>
<重点评审哪些内容: reviewer 该把时间花在哪——风险决策点 / 强约束 / 未验证项>
```

确认 push range (核对描述是否遗漏实质变更, 二选一):

- push 前确认: `git log origin/<branch>..HEAD --oneline`
- push 后回看: `git log <old-sha>..<new-sha> --oneline` (`<old-sha>..<new-sha>` 即 `git push` output 给出的那段 range)

commit 列表不逐条搬进描述——GitHub/Bitbucket PR 页面已展示全部 commit; 描述只提炼有实质意义的变更, 琐碎/机械 commit (typo / 格式) 不单独出现.

## 不要

- 描述超 300 字——超了就压, 不留余地
- 「背景」写成「怎么解决的」——背景讲现状和问题, 不讲方案
- 「重点评审」写成变更复述——「这个文件改了 X」是方案描述, 不是评审提示; 要落到"这里有风险 / 这里没验证过"
- 强行编风险 / 未验证项——真没有就写"无特别风险, 常规改动", 不硬凑
- 把标题写成 commit 列表——标题是主题提炼, 不是 commit 拼接
