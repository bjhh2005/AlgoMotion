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

`GET /api/recommendations`

基于学习进度、图谱关系与 `data/learning-content/recommendation-seeds.json` 中的主线路径，返回推荐节点列表。

### 查询参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | string | `next` | 推荐类型，见下表 |
| `limit` | int | `5` | 返回数量，范围 1–20 |
| `node_id` | string | — | 当前选中的知识点 ID；传入后 `next` / `path` 会围绕该节点生成 |
| `full` | bool | `false` | 仅 `type=path` 时有效；为 `true` 时返回完整路径而非截断窗口 |

**`type` 取值**

| 值 | 说明 |
|----|------|
| `next` | 推荐下一步：优先返回当前节点的一跳未掌握邻居；无结果时按全局「已掌握 → 未掌握」规则或主线路径兜底 |
| `path` | 路径指导：按当前节点生成学习路径段 |
| `weak` | 薄弱优先：返回状态为 `weak` 的知识点 |
| `review` | 复习提醒：返回 `reviewDueAt` 已到期的知识点 |

### `type=path` 生成规则

- **节点在主线路径上**（`defaultPath`）：按主线顺序返回路径节点，并标注 `reason`（如「前置主线」「当前知识点」「主线路径后续」）。
- **节点不在主线上**：前置回溯（`prerequisite` / `contains`，最多 2–5 层）→ 当前节点 → 出边邻居（`contains` / `prerequisite` / `used_in` / `related`）→ 回归主线。
- **`full=true`**：返回完整路径；`full=false` 时按 `limit` 截断。

### 响应

```json
{
  "success": true,
  "data": [
    {
      "id": "stack",
      "name": "栈",
      "difficulty": 3,
      "estimated_minutes": 30,
      "reason": "当前知识点",
      "priority": 1
    }
  ]
}
```

### 示例

推荐下一步（围绕当前选中节点）：

```
GET /api/recommendations?type=next&node_id=stack&limit=5
```

路径指导（完整主线路径）：

```
GET /api/recommendations?type=path&node_id=stack&full=true&limit=10
```

### 兼容接口（旧版）

`GET /api/recommendations/me`

返回 `{ recommended, weak, reason }` 格式的规则推荐，供旧版前端使用。新功能请使用 `GET /api/recommendations`。

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

