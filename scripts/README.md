# Scripts

这里用于放置数据导入、数据库初始化、批量校验等脚本。

第一周 MVP 阶段建议先保持 JSON 数据源，等主流程稳定后再迁移到数据库。

## 数据校验

```bash
python scripts/validate_data.py
```

用于检查知识图谱边和练习题是否引用了不存在的知识点。
