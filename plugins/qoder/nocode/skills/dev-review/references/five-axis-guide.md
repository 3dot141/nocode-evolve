# 五轴评审详细指南

每轴的具体检查点 + 好/坏代码对比。评审时逐轴过 diff，不跳轴。

可读性轴涉及源码注释时 Read `{QODER_PLUGIN_ROOT}/skills/references/source-comment-contract.md`；以“代码外知识是否会丢失”为判据，不以注释数量判好坏。

---

## 轴 1：正确性（Correctness）

逻辑对吗？边界处理了吗？错误路径走通了吗？

**检查点**：
- **逻辑**：条件分支是否覆盖所有情况？布尔逻辑（`&&` / `||` / `!`）有没有反？
- **边界**：空数组 / 空字符串 / null / undefined / 0 / 负数 / 最大值？
- **off-by-one**：`<` vs `<=`、`length` vs `length - 1`、循环起止？
- **race condition**：共享状态并发读写？await 之间状态被改？缺锁 / 缺幂等？
- **错误处理**：异常被吞了？错误路径有没有清理资源？失败是否静默？
- **spec 匹配**：实现和需求 / 验收标准一致吗？有没有偷偷改了语义？
- **被删行为**：diff 删掉的分支 / 兜底 / 错误处理 / 字段，有没有 caller 或调用链还依赖？是有意删除（对照需求 / plan）还是重构顺手误删？拿不准先 `git blame` 查来历 + `rg` 查引用

```python
# BAD: off-by-one + 未处理空
def last_n(items, n):
    return items[len(items) - n:]   # n > len 时返回整个列表（静默错误）

# GOOD: 边界显式
def last_n(items, n):
    if n <= 0:
        return []
    return items[max(0, len(items) - n):]
```

```js
// BAD: await 之间 race，balance 可能被另一请求改掉
const acct = await getAccount(id);
if (acct.balance >= amount) {
  await setBalance(id, acct.balance - amount);  // 读到的 balance 已过期
}

// GOOD: 原子操作 / 乐观锁
await db.account.update({
  where: { id, balance: { gte: amount } },
  data: { balance: { decrement: amount } },
});  // 条件更新，失败即余额不足
```

---

## 轴 2：可读性（Readability）

不看作者解释，下一个人能看懂吗？

**检查点**：
- **命名**：变量 / 函数名说清了"是什么 / 做什么"吗？`data` / `tmp` / `handle` 等空名？
- **结构**：嵌套 > 3 层？早返回能不能拍平？长函数能不能拆？
- **复杂度**：一个函数同时做了几件事？圈复杂度爆炸？
- **dead code**：注释掉的代码块、永远走不到的分支、没人调的函数？
- **魔法值**：散落的数字 / 字符串字面量该不该提成常量？非显然取值是否保留了来源和变更条件？
- **why-comment 覆盖**：顺序不变量、外部契约、失败语义、兼容或删除条件、workaround 根因是否只存在于作者脑中？
- **注释可信度**：既有注释是否仍与代码、版本和失效条件一致？过期注释按实际风险报 finding。
- **注释噪音**：是否用注释掩盖含糊命名或复杂结构，或逐行复述代码？零注释本身不是 finding。

```ts
// BAD: 嵌套深 + 命名空泛
function p(d) {
  if (d) {
    if (d.u) {
      if (d.u.active) {
        return d.u.name;
      }
    }
  }
  return null;
}

// GOOD: 早返回 + 命名达意
function getActiveUserName(record: Record | null): string | null {
  if (!record?.user?.active) return null;
  return record.user.name;
}
```

```ts
// BAD: 只翻译语法，真正的顺序约束仍然丢失
// 发布失效事件
await publishInvalidation(key);
localCache.delete(key);

// GOOD: 保存代码无法表达的失败原因
// 先通知远端再删本地；反序会让远端 worker 在窗口期回填旧值。
await publishInvalidation(key);
localCache.delete(key);
```

---

## 轴 3：架构（Architecture）

职责分对了吗？依赖方向对吗？和现有 pattern 一致吗？

**检查点**：
- **职责划分**：单一职责？一个模块 / 类是不是承担了不相关的多件事（上帝对象）？
- **依赖方向**：高层依赖低层，不反向？业务逻辑泄进了表现层 / 数据层？
- **循环依赖**：A → B → A？import 成环？
- **抽象层级**：同一函数里混了高层意图和低层细节（抽象层级跳变）？
- **pattern 一致性**：本次新增的写法和仓库现有 pattern 一致吗？还是另起炉灶？
- **契约一致性**：接口两端同步改了吗——producer 改了响应 shape，consumer / mock / fixture / 类型定义跟上没有？序列化边界（API 响应 / view 对象）有没有把内部字段泄露给不该看的消费方？跨模块隐含约定（缓存 key / queryKey 拼法等两处各写一份）有没有单源化？

```ts
// BAD: 业务逻辑泄进 React 组件，且直接 fetch（耦合数据层）
function OrderList() {
  const [orders, setOrders] = useState([]);
  useEffect(() => {
    fetch('/api/orders').then(r => r.json()).then(data => {
      setOrders(data.filter(o => o.total > 100 && o.status !== 'cancelled'));  // 业务规则散落
    });
  }, []);
}

// GOOD: 数据获取 + 业务规则下沉，组件只管渲染
function OrderList() {
  const orders = useHighValueOrders();  // 封装 fetch + 过滤规则
  return <List items={orders} />;
}
```

---

## 轴 4：安全（Security）

信任边界守住了吗？详见 `security-checklist.md`。

**速查（评审时至少扫这几条）**：
- 用户输入是否经校验 / 转义就进了 SQL / shell / HTML / 文件路径？
- 鉴权 / 越权：能不能拿别人的 id 访问别人的资源（IDOR）？
- 密钥 / token 硬编码进代码？日志里打了敏感信息？
- AI/LLM：用户输入直接拼进 prompt（prompt 注入）？LLM 输出直接当代码 / 命令执行？
- 新依赖有 CVE 吗？

```python
# BAD: SQL 注入 + 路径遍历
db.execute(f"SELECT * FROM users WHERE name = '{name}'")
open(f"/data/{filename}")   # filename = "../../etc/passwd"

# GOOD: 参数化 + 路径规范化校验
db.execute("SELECT * FROM users WHERE name = %s", (name,))
safe = os.path.realpath(os.path.join("/data", filename))
if not safe.startswith("/data/"):
    raise ValueError("invalid path")
```

---

## 轴 5：性能（Performance）

有不必要的开销吗？详见 `performance-checklist.md`。

**检查点**：
- **N+1 查询**：循环里逐条查 DB / 调 API？
- **unbounded fetch**：查全表 / 拉全量无上限？缺 LIMIT / 分页？
- **不必要同步**：本可并行的异步操作串行 await 了？
- **重渲染**：React 里每次渲染新建对象 / 函数导致子组件白重渲？缺 memo / key？
- **重复计算**：循环里反复算同一个不变值？

```js
// BAD: N+1
const orders = await db.order.findMany();
for (const o of orders) {
  o.user = await db.user.findUnique({ where: { id: o.userId } });  // 每单一查
}

// GOOD: 一次 join / batch
const orders = await db.order.findMany({ include: { user: true } });
```

```js
// BAD: 本可并行，却串行
const a = await fetchA();
const b = await fetchB();   // 不依赖 a，却等 a 完成

// GOOD: 并行
const [a, b] = await Promise.all([fetchA(), fetchB()]);
```
