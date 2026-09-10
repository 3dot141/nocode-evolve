# 简化指南（Simplification Pass）

简化只针对**本次变更涉及的代码**，**preserve behavior exactly**——简化不改行为。简化多为 Suggestion 级，除非它消除一个真 bug。

---

## Chesterton's Fence：先理解，再删除

> "在你知道一道篱笆为什么立在这之前，不要拆它。"

删代码 / 改结构前，先回答**它为什么存在**：

1. `git blame <file>` 看这行 / 这块谁加的、哪个 commit。
2. `git log -p -L <start>,<end>:<file>` 看这段代码的演化历史。
3. 找 commit message / PR / issue 链接，理解当初的动机。
4. **看不懂为什么有它 → 不删**。很多"多余"代码是在修某个隐蔽 bug，删了 bug 复活。

```ts
// 看似多余的判断
if (items.length === 0) return [];   // 后面 .map 对空数组本来就安全？
// git blame 显示：这是为了避免下游 reduce 在空数组上抛 "no initial value"
// → 不能删
```

---

## Rule of 500：拆分阈值

- **函数 > 50 行** → 考虑拆。拆的是**职责**，不是机械按行切。一个函数做了"校验 + 转换 + 持久化"三件事，按这三件事拆。
- **文件 > 500 行** → 考虑拆。按内聚的关注点拆模块，不是按字母 / 长度切。
- 阈值是信号不是铁律——50 行的纯数据映射不必拆，30 行但塞了 4 个职责的该拆。

---

## Dead code hygiene：识别 → 列出 → 问用户 → 再删

死代码不擅自删——可能有外部引用 / 反射调用 / 动态 import：

1. **识别**：注释掉的代码块、永远 false 的分支、没有调用方的导出函数。
2. **列出**：把候选死代码列给用户，标注"未发现引用"。
3. **问用户**：grep 全仓找引用（含字符串形式的反射调用 / 动态 import / 配置引用）。确认无引用再删。
4. 公共 API / 导出符号尤其谨慎——你的仓库搜不到引用 ≠ 没有外部消费者。

---

## 各语言简化示例

**TypeScript**：合并冗余条件 / 用可选链替代嵌套判断
```ts
// BEFORE
if (user && user.profile && user.profile.email) { send(user.profile.email); }
// AFTER（行为完全一致）
if (user?.profile?.email) send(user.profile.email);
```

**Python**：用推导式 / 内置替代手写循环（仅当更易读时）
```python
# BEFORE
result = []
for x in items:
    if x.active:
        result.append(x.name)
# AFTER
result = [x.name for x in items if x.active]
```

**React**：提取重复 JSX / 删多余 state（可由 props 派生的别存 state）
```tsx
// BEFORE: fullName 冗余存 state，会和 first/last 失同步
const [fullName, setFullName] = useState(`${first} ${last}`);
// AFTER: 派生值直接算，无失同步风险
const fullName = `${first} ${last}`;
```

---

## 边界

- **不为简化而简化**：把 5 行直白代码压成 1 行"聪明"代码、可读性下降 = 反向。
- **不扩大范围**：只动本次变更涉及的代码，不顺手重构无关模块。
- **不改行为**：任何"简化"如果改变了输出 / 副作用 / 错误行为，它就不是简化，是变更——走正常评审。
