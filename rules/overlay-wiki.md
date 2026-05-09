# 项目级 wiki 的按需 search

本项目可能在 `.agents-personal/wiki/` 下沉淀了项目级记忆（设计决策、术语、架构边界等），由用户跑 `/wiki-update` 维护。

## 何时主动 search wiki

满足任一即考虑 search：

- 你对这个项目的某个设计 / 约定 / 术语**不确定**
- 用户的问题暗示「这个之前讨论过」
- 你即将做的判断和项目过往决策**可能冲突**
- 用户问「这个项目里 X 怎么处理的」之类历史性问题

## 流程

```
ls <project>/.agents-personal/wiki/  →
  ├─ 不存在  → 跳过，按通常方式工作
  └─ 存在    → Read INDEX.md
                ├─ 看每条 description 判断相关性
                ├─ 相关 → Read 具体页 (./pages/<filename>)
                └─ 不相关 → 跳过
```

## 不要

- 在用户没暗示项目背景时强行 search（污染 context、浪费 token）
- Read 了 wiki 后却不引用——既然查了就要在回答里反映出引用关系
- 把 wiki 内容当作绝对真理——它是历史记录，可能被新决策 superseded
- 试图自己写 wiki——沉淀走 `/wiki-update`，AI 主动写 wiki 容易过度

## 关于沉淀

如果你发现本会话产生了**值得沉淀**的项目级知识（新设计决策、新约定、新踩过的坑），主动建议用户跑 `/wiki-update`，但不要替用户决定。
