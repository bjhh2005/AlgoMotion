# AI 多轮学习助手功能说明

## 1. 功能定位

AI 多轮学习助手用于把知识图谱、问答讲解、代码分析、资料学习包和 OJ 练习串成一个学习闭环。

目标闭环：

```txt
发现问题 -> AI 讲解 -> 图谱跳转 -> Quiz/知识卡片 -> 练习推荐 -> 错误再分析
```

前端入口位于侧边栏 `AI 辅助问答`。

## 2. 当前能力

### 2.1 多轮对话

用户可以连续提问，前端会把最近的历史对话发送给后端。

后端会结合：

- 当前选中的 `nodeId`
- 最近对话上下文
- 知识图谱节点和边
- 知识点讲解内容
- C++ 示例代码

生成面向课程学习的回答。

### 2.2 图谱跳转卡片

AI 返回结果中包含 `nodeCards`，每张卡片都绑定一个知识图谱节点。

卡片包含：

- 知识点名称
- 简介
- 分类
- 难度
- 标签
- 推荐原因

点击卡片后可以跳转到知识库对应知识点，继续查看定义、复杂度、常见错误、示例代码和学习状态。

### 2.3 错误-知识点跳转

代码分析接口会把错误线索绑定到知识点。

例如：

```cpp
stack<int> s;
s.pop();
```

会关联到 `stack`，并提示空栈 `pop/top` 的风险。返回结果还会包含图谱关系和推荐练习。

### 2.4 资料学习包

用户可以粘贴资料文本，系统会自动生成：

- 资料摘要
- Quiz
- 知识卡片
- 图谱跳转卡片
- 推荐练习

该功能参考 NotebookLM 类工作流，但当前实现以文本粘贴为主，适合作为上传文件解析功能的前置版本。

### 2.5 Quiz 自动生成

Quiz 会根据识别出的知识点生成，包括：

- 选择题
- 填空题
- 简答题

题目会绑定 `linkedNodeIds`，用于把练习结果和知识图谱节点关联。

### 2.6 知识卡片

知识卡片用于快速复习，包含：

- 正面：知识点名称
- 背面：定义或核心解释
- 要点：性质和复杂度
- 常见错误

### 2.7 C++ 代码生成

用户可以要求 AI 按需生成规范 C++ 代码。

生成结果包括：

- `code`
- `language`
- `explanation`
- `linkedNodes`
- 图谱跳转卡片
- 推荐练习

当没有配置大模型 API 时，后端会使用本地模板生成基础 C++ 代码。

## 3. 前端实现

核心组件：

```txt
frontend/src/components/AiPanel.tsx
```

页面分为三个模式：

- `对话`：多轮提问，生成讲解和学习闭环
- `资料学习包`：根据粘贴资料生成 Quiz 和知识卡片
- `代码闭环`：代码错误分析、C++ 代码生成和知识点绑定

主要展示区域：

- 对话流
- 知识点跳转卡片
- 图谱关系
- Quiz
- 知识卡片
- 推荐练习和学习动作
- 生成的 C++ 代码

## 3.1 后端模块边界

为减少和其他功能开发的冲突，AI 功能后端代码已经从 `backend/app/main.py` 中拆出。

AI 专属文件：

```txt
backend/app/ai_assistant.py   # AI 路由、上下文构建、Quiz/卡片/代码生成逻辑
backend/app/ai_models.py      # AI 请求模型
```

共享数据访问：

```txt
backend/app/data_access.py    # JSON 数据源读取和基础索引函数
```

`backend/app/main.py` 只保留基础 API 和 `app.include_router(ai_router)`，后续开发 AI 功能时优先修改 AI 专属文件。

## 4. 后端接口

### 4.1 多轮问答

`POST /api/ai/chat`

请求：

```json
{
  "message": "为什么栈可以用于递归？",
  "nodeId": "stack",
  "history": [
    { "role": "user", "content": "我在学栈" },
    { "role": "assistant", "content": "栈具有后进先出特性。" }
  ]
}
```

返回包含：

- `answer`
- `message`
- `linkedNodes`
- `nodeCards`
- `graphRelations`
- `quiz`
- `knowledgeCards`
- `recommendedExercises`
- `learningActions`
- `loop`

### 4.2 代码分析

`POST /api/ai/code-analysis`

请求：

```json
{
  "code": "stack<int> s; s.pop();",
  "problem": "判断括号序列是否合法"
}
```

返回包含：

- `summary`
- `linkedNodes`
- `suggestions`
- `nodeCards`
- `graphRelations`
- `recommendedExercises`
- `learningActions`

### 4.3 资料学习包

`POST /api/ai/study-artifacts`

请求：

```json
{
  "sourceText": "栈具有后进先出特性，递归依赖调用栈。",
  "title": "栈学习材料",
  "nodeId": "stack"
}
```

返回包含：

- `summary`
- `linkedNodes`
- `nodeCards`
- `graphRelations`
- `quiz`
- `knowledgeCards`
- `recommendedExercises`
- `learningActions`

### 4.4 C++ 代码生成

`POST /api/ai/code-generation`

请求：

```json
{
  "prompt": "生成括号匹配的栈代码",
  "nodeId": "stack",
  "history": []
}
```

返回包含：

- `code`
- `language`
- `explanation`
- `linkedNodes`
- `nodeCards`
- `graphRelations`
- `recommendedExercises`
- `learningActions`

## 5. 大模型接入

后端兼容 OpenAI Chat Completions 风格接口，并已适配 DeepSeek。

推荐把密钥写到 `backend/.env`，不要提交到 Git。

DeepSeek V4 Pro 配置：

```bash
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=你的 DeepSeek API Key
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_THINKING=disabled
DEEPSEEK_REASONING_EFFORT=
AI_TEMPERATURE=0.2
AI_MAX_TOKENS=1800
AI_TIMEOUT_SECONDS=90
```

通用 OpenAI-compatible 配置：

```bash
AI_API_KEY=你的 API Key
AI_MODEL=你的模型名
AI_BASE_URL=https://api.openai.com/v1
```

可选：

```bash
AI_CHAT_COMPLETIONS_URL=完整 chat/completions 地址
AI_TEMPERATURE=0.2
AI_MAX_TOKENS=1800
AI_TIMEOUT_SECONDS=90
```

兼容变量：

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_CHAT_COMPLETIONS_URL`
- `DEEPSEEK_THINKING`
- `DEEPSEEK_REASONING_EFFORT`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_BASE_URL`
- `OPENAI_CHAT_COMPLETIONS_URL`

## 6. 本地兜底

即使没有配置 API，系统也能运行。

兜底能力：

- 问答：基于本地知识库生成回答
- 代码分析：基于规则匹配知识点
- Quiz：基于知识点定义、性质和常见错误生成
- 知识卡片：基于课程 JSON 数据生成
- C++ 代码：基于内置模板生成

## 7. 数据关联

AI 功能主要依赖以下数据：

```txt
data/knowledge-graph/nodes.json
data/knowledge-graph/edges.json
data/learning-content/knowledge-content.json
data/learning-content/code-examples.json
data/exercises/exercises.json
data/learning-content/code-analysis-rules.json
```

所有 AI 结果都尽量返回 `linkedNodes`，用于建立：

```txt
AI 结果 -> 知识图谱节点 -> 知识库详情 -> 练习推荐 -> 错误再分析
```

## 8. 验收要点

应至少验证：

- 多轮提问后能显示新的 AI 消息
- 返回知识点跳转卡片，并能跳到知识库节点
- 代码分析能把错误绑定到图谱节点
- 粘贴资料后能生成 Quiz 和知识卡片
- 代码生成能输出 C++ 代码并关联知识点
- 未配置 API 时仍能使用本地兜底
- 配置 API 后能真实调用外部模型接口
