# 知识图谱数据规范

## 节点 KnowledgeNode

```json
{
  "id": "stack",
  "name": "栈",
  "category": "linear",
  "description": "只允许在一端进行插入和删除的线性表。",
  "difficulty": 2,
  "tags": ["LIFO", "递归"]
}
```

字段说明：

- `id`：稳定唯一标识，使用英文 kebab-case
- `name`：中文展示名
- `category`：分类，用于目录和图谱布局
- `description`：一句话简介
- `difficulty`：1-5
- `tags`：搜索和推荐标签

## 边 KnowledgeEdge

```json
{
  "source": "linear-list",
  "target": "stack",
  "type": "contains",
  "label": "细分"
}
```

关系类型：

- `contains`：层级包含
- `prerequisite`：前置知识
- `related`：相关知识
- `used_in`：被用于某算法/场景
- `error_caused_by`：错误来源，可由代码分析模块生成

## 本体兼容关系 OntologyRelation

前端会把 `KnowledgeEdge` 兼容映射为统一的本体关系，便于后续接入图数据库、错因诊断或 AI 检索增强。

```json
{
  "subjectId": "stack",
  "predicate": "used_in",
  "objectId": "graph-traversal",
  "label": "用于 DFS",
  "source": "knowledge-graph",
  "evidence": "curated"
}
```

兼容策略：

- 课程人工建设的层级、前置、相关、应用关系继续维护在 `edges.json`
- OJ 错题、AI 代码分析生成的关系使用同一组 `predicate`
- `source` 标记关系来源，`evidence` 标记证据类型，不破坏现有图谱数据
- 所有 OJ 题目、学习记录和 AI 结果都通过稳定 `nodeId` 绑定知识本体

## 讲解 KnowledgeContent

位置：`data/learning-content/knowledge-content.json`

```json
{
  "nodeId": "stack",
  "definition": "栈是限定仅在表尾进行插入和删除操作的线性表。",
  "properties": ["后进先出"],
  "operationSteps": ["入栈前判断空间是否可用。"],
  "complexity": {
    "time": "入栈、出栈、取栈顶通常为 O(1)。",
    "space": "顺序栈空间为 O(n)。"
  },
  "commonMistakes": ["空栈时直接 pop/top"],
  "resourceLinks": []
}
```

## 代码示例 CodeExample

位置：`data/learning-content/code-examples.json`

```json
{
  "nodeId": "stack",
  "language": "cpp",
  "title": "标准库栈的安全访问",
  "code": "#include <stack>..."
}
```

## 学习追踪 ProgressRecord

位置：`data/learning-content/initial-progress.json`

```json
{
  "stack": {
    "status": "learning",
    "score": 58,
    "metrics": {
      "mastery": 0.58,
      "confidence": 0.48,
      "studyMinutes": 42,
      "attemptCount": 5,
      "correctRate": 0.6,
      "errorCount": 2,
      "streakDays": 2,
      "lastActivityAt": "2026-05-18T09:15:00+08:00",
      "reviewDueAt": "2026-05-19T09:00:00+08:00"
    }
  }
}
```

`status` 仍负责“是否学习/学习阶段”的快速判断；`metrics` 记录更专业的学习状态，供推荐、复习提醒、OJ 错因分析和教师端统计使用。

## 修改数据后的校验

```bash
python scripts/validate_data.py
```

提交前至少确认没有引用不存在的 `nodeId`。
