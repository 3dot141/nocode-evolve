# Example: 一个完整的 slice 循环

演示 dev-build 的 5a→5d 闭环——以"给用户 API 加一个邮箱格式校验"为例，完整走一遍 red-green。

## 5a. Scope Lock

- 取 task：`POST /api/users` 创建用户时校验 email 格式，非法返回 400
- 确认 ≤5 文件：`api/users/create.ts` + `api/users/create.test.ts` = 2 文件 ✅
- 标记：**AFK**（无需人决策）
- **Source check** `[Read api/users/create.ts:20]`：现有 handler 只校验 `name` 非空，email 未校验
- 只碰这两个文件。`[NOTICED BUT NOT TOUCHING]` 同文件 `phone` 字段也没校验——记录，不顺手改

## 5b. Test First (Red)

```ts
// api/users/create.test.ts
it('rejects invalid email format', async () => {
  const res = await request(app).post('/api/users')
    .send({ name: 'Bob', email: 'not-an-email' });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/email/i);
});
```

跑测试，确认失败：

```
$ npm test -- create.test.ts
✗ rejects invalid email format
  Expected: 400, Received: 201   ← 失败原因是"功能没实现"，不是测试写错
```

## 5c. Implement (Green)

```ts
// api/users/create.ts:20
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/users', (req, res) => {
  if (!req.body.name) return res.status(400).json({ error: 'name required' });
  if (!EMAIL_RE.test(req.body.email)) {                    // 新增
    return res.status(400).json({ error: 'invalid email' }); // 新增
  }
  // ... 原有创建逻辑不动
});
```

跑测试，确认变绿：

```
$ npm test -- create.test.ts
✓ rejects invalid email format
✓ creates user with valid input   ← 原有测试无回归
```

## 5d. Verify & Commit

```
$ npm test       # 全套件
  Tests: 47 passed
$ npm run build
  Build succeeded
```

三项全绿 → commit：

```
$ git commit -m "feat(users): validate email format on create

Reject malformed emails with 400 before persisting.
Covers DES-004, the confirmed invalid-input behavior."
```

---

**这个示例的关键点**：先写测试并**亲眼看它失败**（失败原因对）；实现只写刚好够过绿的代码，原有逻辑不动；计划外发现（phone 未校验）用 NOTICED BUT NOT TOUCHING 记录不顺手改；commit message 说清 what + why，关联验收标准。
