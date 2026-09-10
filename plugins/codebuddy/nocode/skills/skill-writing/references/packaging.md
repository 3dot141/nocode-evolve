# Packaging — 打包分发

需要把 skill 分发到本插件仓库之外时打包（仅本仓库内使用则无需——仓库本身就是分发物）。

```
Python 3 可用?
     │
     ├─ 可用 ──→ ../skill-creator/scripts/package_skill.py 生成 .skill 文件
     │
     └─ 不可用 ──→ 告知用户手动 zip skill 目录
```

打包前跑一遍 `../skill-creator/scripts/quick_validate.py` 做结构校验。

## 通过判据

- [ ] .skill 文件生成（或用户手动 zip）
- [ ] 产物可分发
