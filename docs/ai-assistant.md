# AI 辅助问答功能说明

## 1. 功能概述

AI 辅助问答是 AlgoMotion 里的智能学习入口，位于前端侧边栏的 `AI 辅助问答` 页面。
它的目标是让学生围绕当前知识点提问，并得到结合课程知识图谱、讲解内容和示例代码的回答。

当前页面同时保留了两类能力：

- 多轮问答
- C++ 代码分析

其中问答能力是主功能，代码分析是同一面板里的辅助能力。

## 2. 页面入口

前端组件：

- `frontend/src/components/AiPanel.tsx`

页面交互：

- 输入问题后点击 `发送问题`
- 输入代码后点击 `分析代码`
- 点击返回的知识点按钮可跳转到对应知识点页面

## 3. 问答流程

当前实现的处理流程如下：

1. 前端把问题和当前选中的知识点 `nodeId` 发送到后端 `POST /api/ai/chat`
2. 后端根据问题内容和知识图谱关系筛选相关知识点
3. 后端从以下数据源拼装课程上下文：
   - `data/knowledge-graph/nodes.json`
   - `data/knowledge-graph/edges.json`
   - `data/learning-content/knowledge-content.json`
   - `data/learning-content/code-examples.json`
4. 若已配置大模型接口，后端调用兼容 OpenAI Chat Completions 的 API
5. 若未配置或调用失败，后端自动回退到本地知识库回答
6. 前端展示回答文本，并根据 `linkedNodes` 提供知识点跳转

## 4. 后端接口

### 4.1 问答接口

`POST /api/ai/chat`

请求体：

```json
{
  "message": "为什么栈可以用于递归？",
  "nodeId": "stack"
}
```

返回值：

```json
{
  "answer": "......",
  "linkedNodes": ["stack", "recursion"]
}
```

字段说明：

- `answer`：可直接展示给学生的回答
- `linkedNodes`：与问题相关的知识点 ID 列表，用于页面跳转

### 4.2 代码分析接口

`POST /api/ai/code-analysis`

请求体：

```json
{
  "code": "stack<int> s; s.pop();",
  "problem": "判断括号序列是否合法"
}
```

返回值：

```json
{
  "summary": "......",
  "linkedNodes": ["stack"],
  "suggestions": ["......"]
}
```

## 5. 大模型配置

后端支持通过环境变量接入外部模型服务，支持仓库根目录 `.env` 或 `backend/.env`。

推荐配置：

```bash
AI_API_KEY=你的 API Key
AI_MODEL=你的模型名
AI_BASE_URL=https://api.openai.com/v1
```

可选配置：

```bash
AI_CHAT_COMPLETIONS_URL=完整 chat/completions 地址
AI_TEMPERATURE=0.2
AI_MAX_TOKENS=900
AI_TIMEOUT_SECONDS=30
```

说明：

- `AI_CHAT_COMPLETIONS_URL` 优先级高于 `AI_BASE_URL`
- 也兼容 `OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_BASE_URL`
- 若未配置 API，问答会自动使用本地知识库兜底

## 6. 兜底策略

当前实现不会因为没有 API Key 而让页面失效。

兜底逻辑：

- 问答接口返回基于课程知识的本地解释
- 代码分析接口返回规则匹配结果
- 页面交互和知识点跳转保持可用

## 7. 数据依赖

问答质量依赖以下数据：

- 知识点节点和关系边
- 知识点讲解内容
- C++ 示例代码

这些数据共同组成课程上下文，决定模型回答时能否准确贴合数据结构课程。

## 8. 验收要点

功能可视为可用时，应满足：

- 能在 AI 页面输入问题并得到回答
- 回答中能返回相关知识点并跳转
- 没有 API Key 时仍能正常使用本地兜底回答
- 配置 API 后可真正转发到模型接口
- 前端构建和后端接口都能正常启动

