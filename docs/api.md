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

后端会将问题、当前知识点、相关知识图谱节点、讲解内容、复杂度、常见错误和示例代码拼成课程上下文，再调用兼容 OpenAI Chat Completions 的大模型接口。需要配置环境变量：

```bash
AI_API_KEY=你的 API Key
AI_MODEL=你的模型名
AI_BASE_URL=https://api.openai.com/v1
```

如果供应商直接提供完整 Chat Completions 地址，也可设置 `AI_CHAT_COMPLETIONS_URL`。未配置 API 时接口返回本地知识库兜底回答。
后端会自动读取仓库根目录 `.env` 或 `backend/.env`，也支持系统环境变量。

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

