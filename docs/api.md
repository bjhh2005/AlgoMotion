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
  "nodeId": "stack",
  "history": [
    { "role": "user", "content": "我正在学习栈" }
  ]
}
```

返回多轮回答、知识点跳转卡片、图谱关系、Quiz、知识卡片和练习推荐。后端会将问题、历史对话、当前知识点、相关知识图谱节点、讲解内容、复杂度、常见错误和示例代码拼成课程上下文，再调用兼容 OpenAI Chat Completions 的大模型接口。

DeepSeek V4 Pro 推荐配置在 `backend/.env`：

```bash
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=你的 DeepSeek API Key
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_THINKING=disabled
DEEPSEEK_REASONING_EFFORT=
```

通用配置：

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

返回关联知识点、图谱关系、错误建议和练习推荐。

`POST /api/ai/study-artifacts`

请求体：

```json
{
  "sourceText": "栈后进先出，递归依赖调用栈。",
  "title": "栈学习资料",
  "nodeId": "stack"
}
```

根据粘贴资料生成 Quiz、知识卡片、知识点跳转卡片和推荐练习。

`POST /api/ai/code-generation`

请求体：

```json
{
  "prompt": "生成括号匹配的栈代码",
  "nodeId": "stack",
  "history": []
}
```

生成规范 C++ 代码，并返回关联知识图谱节点和推荐练习。

