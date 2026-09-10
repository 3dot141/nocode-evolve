# /projecthub search：子目录文档搜索

搜索项目所有子目录的 AGENTS.md 和 README.md，返回匹配结果。

## 入参

`/projecthub search <search-query>`

无参数时提示用法。

## 执行流程

### Step 1: 收集文件

```bash
rg --files -g '**/AGENTS.md' -g '**/README.md' -g '!node_modules/**' -g '!.git/**' -g '!.agents-personal/**' | rg '/' | sort
```

排除：
- `.agents-personal/AGENTS.md`（走 `/personalhub search`）
- 项目根的 `AGENTS.md` / `README.md`（不属于子目录文档）
- node_modules / .git 内的文件

### Step 2: 搜索

两层搜索：

1. **关键词匹配**：`rg -n -C 2 --fixed-strings '<query>' <files...>`，收集命中行 + 上下文
2. **语义匹配**：对非精确匹配的文件，AI 判断内容是否与查询语义相关

### Step 3: 输出

按相关度排序：

```
搜索 "<query>" 在子目录文档中的结果：

1. module-a/AGENTS.md:5
   "本目录下的文件是生成物，禁手改"
   上下文: generate.mjs 从 manifest.json 生成 catalog 分片...

2. vendor/AGENTS.md:12
   "vendor 目录的文件是上游原版参考，不要直接修改"
   上下文: 改了下次 rsync 会被覆盖...

共 2 处匹配 / 扫描 6 个文件
```

无匹配时：

```
搜索 "<query>" — 无匹配

已扫描 N 个文件，未找到相关内容。
建议：
  - 换个关键词试试
  - /projecthub status 看看哪些目录有文档
```
