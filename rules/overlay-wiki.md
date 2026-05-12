# 项目级 wiki 检查

本项目可能在 `.agents-personal/wiki/` 下沉淀了项目级记忆（设计决策、术语、架构边界等），由用户跑 `/wiki-update` 维护。

## 强制基线：每个新会话至少扫一眼 INDEX

新会话开始、**首次响应用户实质性问题前**，强制执行：

```
ls <project>/.agents-personal/wiki/
  ├─ 目录不存在 / 没有 INDEX.md → 跳过，按通常方式工作
  └─ 存在 INDEX.md             → Read INDEX.md（仅 INDEX，不进 pages）
```

要点：

- 这是**兜底动作**，不再依赖「用户问题是否暗示项目背景」之类的触发判断
- INDEX 在同一会话内只需读一次；后续轮次命中 cache 不要重复 `ls` / `Read`
- 读完 INDEX 不必在回答里逐条复述——但若 INDEX 里的某条 description 显著和当前任务相关，**必须**在回答里点名引用，避免「读了等于没读」

## 进一步深读 pages（按需）

读完 INDEX 是基线，**深入 pages 仍然按需**。满足任一信号才 Read 具体页：

- 你对这个项目的某个设计 / 约定 / 术语**不确定**
- 用户的问题暗示「这个之前讨论过」
- 你即将做的判断和项目过往决策**可能冲突**
- 用户问「这个项目里 X 怎么处理的」之类历史性问题
- INDEX 里某条 description 明显覆盖了当前任务的关键决策点

命中 → `Read ./pages/<filename>`，并在回答里反映引用关系。

## 不要

- 读了 INDEX / pages 后却不引用——既然查了就要在回答里反映出引用关系
- 无脑把所有 pages 都拉进 context——基线只到 INDEX，pages 仍按需
- 把 wiki 内容当作绝对真理——它是历史记录，可能被新决策 superseded
- 试图自己写 wiki——沉淀走 `/wiki-update`，AI 主动写 wiki 容易过度

## 关于沉淀

如果你发现本会话产生了**值得沉淀**的项目级知识（新设计决策、新约定、新踩过的坑），主动建议用户跑 `/wiki-update`，但不要替用户决定。
