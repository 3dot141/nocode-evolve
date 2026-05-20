# git push 后总结的输出格式

## 触发

用户 push 后说「总结 push 内容 / 给标题描述 / PR description / 沉淀这个 / 这次 push 包含什么」类指令时. 中英文同义说法等价适用.

**不触发**: 单纯问"push 完了吗 / push 成功没"等状态查询.

## 输出结构

两段: **标题** + **描述**.

- **标题**: 一行 ≤ 50 字, 概括最大变更轴 (含版本号 if any). 不要逐条罗列 commit, 提炼共同主题.
- **描述**: ≤ 200 字 (中文按字计), 含「基础内容」+「重点评测」两小节.

### 基础内容

逐 commit 一行: `<short-sha> <type>: <一句话变更>`. **必须覆盖 push range 内全部 commit**, 不漏不并.

确认 range (二选一):

- push 前确认: `git log origin/<branch>..HEAD --oneline`
- push 后回看: `git log <old-sha>..<new-sha> --oneline` (`<old-sha>..<new-sha>` 即 `git push` output 给出的那段 range)

range 内有 N 个 sha, 基础内容就要有 N 行. 用「commit 太少」/「漏了 XXX」自查.

### 重点评测

不是变更复述, 是判断. 每个 commit 至少给**亮点 / 风险 / 未验证项**三类中的一类:

- **亮点**: 解决了什么真问题, 或带来什么结构性收益
- **风险**: 引入了什么后续会咬人的强约束, 维护负担, 或不留退路的删除
- **未验证项**: 关键假设还没跑过实例验证, 等实跑才能确认是否成立

实在没什么可评 (typo / format-only / staging 补丁) → 写 `无评测 (机械修订)`, 不硬凑.

## 不要

- 描述超 200 字——超了就压, 不留余地
- 漏 commit——push range 内每个 sha 都要出现在基础内容
- 评测写成变更复述——「这个 commit 改了 X, 影响 Y」是基础内容, 不是评测
- 强行编评测——没亮点没风险没问号就老实说"无评测", 不硬凑
- 把标题写成 commit 列表——标题是主题提炼, 不是 commit 拼接
