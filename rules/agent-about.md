# 全局环境与占位符

本文件声明 nocode-toolkit 内其他 rule / resource 中可能引用的占位符与全局变量。
其他 rule 看到这些占位符（如 `{username}`），按本文件解析。

## 占位符

| 占位符 | 当前值 | 说明 |
|---|---|---|
| `{username}` | `3dot141` | 用户标识，默认 GitHub username。用于路径分目录、归属标记等。 |

## 全局约定

- 默认主分支：`main`
- 设计文档根目录：`docs/plans/{username}/`
- 时间格式：`yymmdd`（6 位无分隔符，如 `260509`）

> 新增全局约定/占位符时追加到本文件，避免散落各 rule。
