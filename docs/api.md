# API 设计

后端默认地址：`http://localhost:8000`

## 健康检查

`GET /api/health`

## 知识图谱

`GET /api/knowledge/nodes`

返回全部知识点节点。

`GET /api/knowledge/edges`

返回全部知识点关系边。

`GET /api/knowledge/graph`

返回：

```json
{
  "nodes": [],
  "edges": []
}
```

`GET /api/knowledge/{node_id}`

返回单个知识点、关联边、练习题。

## 学习进度

`GET /api/progress/me`

返回当前用户学习进度。MVP 阶段使用内存存储。

`POST /api/progress/update`

请求体：

```json
{
  "nodeId": "stack",
  "status": "mastered",
  "score": 90
}
```

## 推荐

`GET /api/recommendations/me`

基于已掌握节点、薄弱节点和前置关系返回推荐路径。

## AI

`POST /api/ai/chat`

请求体：

```json
{
  "message": "为什么栈可以用于递归？",
  "nodeId": "stack"
}
```

`POST /api/ai/code-analysis`

请求体：

```json
{
  "code": "stack<int> s; s.pop();",
  "problem": "判断括号序列是否合法"
}
```

返回关联知识点与建议。MVP 阶段使用规则识别，后续接入大模型。

## OJ 判题

`POST /api/judge`

提交 OJ 时触发，请求体：

```json
{
  "submission_id": "sub-1710000000000-abc123",
  "problem_id": "ex-stack-001",
  "code": "栈顶",
  "time_limit": 2,
  "mem_limit": 256
}
```

返回：

```json
{
  "status": "Accepted",
  "total_cases": 1,
  "passed_cases": 1,
  "details": [
    {
      "status": "Accepted",
      "time": 0.001
    }
  ]
}
```

`status` 常见取值：`Accepted`、`Wrong Answer`、`Compile Error`。

`GET /api/exercises`

返回全部 OJ 练习题（与 `/api/bootstrap` 中的 `exercises` 字段一致）。

