# profile 清理与环境重置的完整方案

**只在用户明确要求清理时读这个文件。** 任务正常结束时不要碰 profile——它装着登录态，下次还要用。

**读完回到主文件继续流程。** 关空间相关问题走 [closing-task-space.md](closing-task-space.md)；报错速查走 [troubleshooting.md](troubleshooting.md)。

## 先确认三件事

```js
const profiles = await profiles();           // 现存哪些
const native = await ego.listTaskSpaces();   // 谁在占用
```

1. **要删哪个** —— 按 `id` 确认（`Profile N`），名字可能重复
2. **谁在占用** —— 有 space 用着它就先关空间，否则删不干净
3. **是不是唯一** —— 删到 0 个 profile 前先问用户

## 1. 关掉占用它的 task space

见 [closing-task-space.md](closing-task-space.md)。用原生 `ego.listTaskSpaces()` 列全量。

## 2. 退出 ego

```bash
osascript -e 'quit app "ego lite"'
```

实测 `osascript` 会被拒（两次都失败），兜底：

```bash
kill -TERM $(pgrep -f "ego lite.app/Contents/MacOS/ego lite")
```

**这一步不能省。** ego 运行时会用内存副本周期性把 `info_cache` 写回 `Local State` —— 只删目录或只改索引都会被覆盖回去，表现为「删了还在」。

## 3. 删目录 + 删索引

两处都要删：只删目录 → 索引残留；只删索引 → 磁盘不回收。

```bash
P=~/Library/Application\ Support/Citro\ Labs/ego\ lite
rm -rf "$P/Profile N"
```

```python
import json, os

p = os.path.expanduser("~/Library/Application Support/Citro Labs/ego lite/Local State")
TARGET = "Profile N"        # 要删的 id
KEEP = "Profile K"          # 要保留的 id

d = json.load(open(p))
prof = d["profile"]

prof["info_cache"].pop(TARGET, None)                       # 条目本身
for key in ("profiles_order", "last_active_profiles"):     # 顺序与活跃列表
    if prof.get(key):
        prof[key] = [x for x in prof[key] if x != TARGET]
if prof.get("last_used") == TARGET:                        # 默认指向
    prof["last_used"] = KEEP

json.dump(d, open(p, "w"), ensure_ascii=False, indent=2)
```

`info_cache` 条目里带 `ego_import_source_browser` / `ego_import_source_profile_dir` / `ego_import_source_profile_identity`，条目删掉标记一并消失——这是重启后不再重新导入的关键。

## 4. 重启前先想清楚

```bash
open -a "ego lite"
```

**重启可能把你刚删的东西造回来。** ego 启动时若发现来源浏览器还可导入，会按 `ego_import_source_*` 标记重新导入一个。

实测证据：`--clear-existing-profiles` 导入返回 `{"new_profile_dirs": [], "restarting": true}`，重启后仍生成了新 profile——新 profile 是应用自己导的，不在 CLI 流程里。

| 情况 | 做法 |
|---|---|
| 用户还要继续用 ego | 重启，复查 `profiles()`，出现新 profile 属于预期 |
| 用户暂时不用 | **跳过重启**，下次手动打开时再处理 |
| 想彻底不再导入 | 只能从源头断：在源浏览器里退出该 profile，或删掉它 |

## 5. 验证

```js
console.log(await profiles());
console.log(await ego.listTaskSpaces());
```

确认目标 profile 已消失、剩下的那个仍是用户要的。若冒出新 profile，向用户说明这是重新导入的结果，问是否要再清一次——**不要默默反复删**。

## 绝不主动做的事

- 任务结束时顺手清 profile
- 因为「看起来是一次性导入」就自行删除
- 用 `--clear-existing-profiles` 批量删——它清掉**所有** profile，包括用户要留的
- 未经确认就重启 ego（会打断其他会话的任务空间）

## 能力边界（查证过，不必再探索）

| 操作 | 是否可行 | 说明 |
|---|---|---|
| 创建 profile | **无 API** | 仅 UI：`chrome://profile-picker` 的 Add 按钮 |
| 删除 profile | **无 API** | 仅 UI：More actions → Delete，或上面的磁盘 + 索引路径 |
| 设 `isDefault` | **无参数** | `--no-default` 指系统默认浏览器，不是 profile |
| 导入时排除扩展 | **不可行** | `browserDataImport(selections, clearExistingProfiles)` 的 `selections` 只有 `browserSource` + `selectedProfileDirNames`，无类别字段；导入走整目录复制 |

`isDefault` 语义（`docs/native-bindings-api.md:209`）：建 task space 时未传 `profileId` 则用该 profile。**该值的计算逻辑在闭源应用内**，开源仓库只有类型校验与测试，无计算代码。

## 导入编号规则

新 profile 编号 = `profiles_created` 的当前值（单调递增计数器），不是「扫磁盘取最大 +1」。

实测：磁盘只有 Profile 9 时导入，编号直接是 `Profile 14`（当时的计数器值）。
