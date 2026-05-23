# AlgoMotion 系统功能梳理与测试指南

> 文档版本：v1.1 | 更新日期：2026-05-22

---

## 一、系统概述

AlgoMotion 是一个**《数据结构》智慧学习平台**，形成 **"知识图谱 → OJ 练习 → 学习追踪 → AI 辅助分析"** 的学习闭环。

### 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | React 19 + TypeScript + Vite + @xyflow/react | 知识图谱可视化、OJ、学习追踪、AI 问答 |
| 后端 | Python FastAPI + Pydantic + Uvicorn | REST API 服务，JSON 数据驱动 |
| C++ 核心 | C++17 + jsoncpp + CMake | 数据结构实现（独立演示，未接入 Web 主链路） |
| OJ 判题 | Docker + gcc + UOJ judger | 编程题在线判题 |
| 数据层 | 纯 JSON 文件 | 知识图谱、题库、学习内容、进度持久化 |

### 启动方式

```bash
# 1. 启动后端（端口 8000）
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload

# 2. 启动前端（端口 5173）
cd frontend && npm install && npm run dev

# 3. 启动 OJ 判题容器（可选，编程题需要）
cd oj && docker-compose up -d
```

---

## 二、功能模块梳理

### 模块 1：知识图谱浏览

**功能描述**：以可视化图谱形式展示数据结构知识点及其关系，支持节点搜索、聚焦定位、学习状态着色。

| 子功能 | 说明 |
|--------|------|
| 图谱可视化 | 基于 @xyflow/react 的交互式知识图谱，支持缩放、拖拽、平移 |
| 节点着色 | 按学习状态（未学习/学习中/已掌握）给节点着不同颜色 |
| 搜索高亮 | 搜索知识点名称，匹配节点高亮显示 |
| 聚焦定位 | 点击目录树或推荐项，图谱自动定位到对应节点 |
| 关系边展示 | 展示 prerequisite/contains/related/used_in/extends 等关系类型 |

**涉及文件**：
- 前端：`frontend/src/components/GraphView.tsx`
- 后端 API：`GET /api/knowledge/graph`、`GET /api/knowledge/nodes`、`GET /api/knowledge/edges`
- 数据：`data/knowledge-graph/nodes.json`、`data/knowledge-graph/edges.json`

---

### 模块 2：知识目录树

**功能描述**：以树状目录形式按层级展示知识点，方便快速导航。

| 子功能 | 说明 |
|--------|------|
| 层级目录 | 按 category（线性结构/树结构/图结构/算法等）分组展示 |
| 节点选择 | 点击节点触发详情加载和图谱聚焦 |
| 状态标识 | 显示每个知识点的学习进度状态 |

**涉及文件**：
- 前端：`frontend/src/components/DirectoryView.tsx`
- 后端 API：`GET /api/knowledge/nodes`

---

### 模块 3：知识点详情

**功能描述**：展示选中知识点的完整学习内容，包括定义、性质、操作步骤、复杂度分析、常见错误和代码示例。

| 子功能 | 说明 |
|--------|------|
| 定义与性质 | 知识点的定义描述和关键性质 |
| 操作步骤 | 数据结构的核心操作步骤说明 |
| 复杂度分析 | 时间/空间复杂度信息 |
| 常见错误 | 学习该知识点时的典型错误和陷阱 |
| C++ 代码示例 | 可运行的示例代码 |
| 关联题目 | 该知识点关联的练习题列表 |

**涉及文件**：
- 前端：`frontend/src/components/KnowledgeDetail.tsx`
- 后端 API：`GET /api/knowledge/{node_id}`
- 数据：`data/learning-content/knowledge-content.json`、`data/learning-content/code-examples.json`

---

### 模块 4：OJ 在线练习

**功能描述**：提供选择题、填空题、编程题三种题型的在线练习和自动判题。

| 子功能 | 说明 |
|--------|------|
| 题目列表 | 按知识点分组展示题目，支持筛选 |
| 选择题 | 展示选项，提交后后端比对答案 |
| 填空题 | 输入答案，提交后后端判定 |
| 编程题 | 在线代码编辑器，提交代码到 Docker 容器编译运行判题 |
| Markdown 题面 | 支持 Markdown 格式的题目描述渲染 |
| 标签搜索 | 按标签筛选题目 |

**涉及文件**：
- 前端：`frontend/src/components/ExerciseOjPage.tsx`、`frontend/src/components/oj/`
- 后端 API：`GET /api/exercises`、`POST /api/judge`、`GET /api/get_problem_data/{id}`、`POST /api/check_S&C_ans/{id}`、`GET /api/search_tag`、`GET /api/git_tag`
- 判题容器：`oj/`（Docker）
- 数据：`data/exercises/`、`data/oj-data/`

---

### 模块 5：学习进度追踪

**功能描述**：记录和展示学生的学习进度，支持掌握度自动计算。

| 子功能 | 说明 |
|--------|------|
| 进度记录 | 记录每个知识点的学习状态、正确率、尝试次数 |
| 掌握度计算 | 综合基础分(25%) + 正确率分(35%) + 稳定性分(25%) + 时效分(15%) |
| 遗忘曲线 | 基于艾宾浩斯遗忘曲线计算记忆衰减 |
| 复习建议 | 根据遗忘曲线给出复习时间推荐（1/2/4/7/15/30/60/90 天间隔序列） |
| 进度持久化 | 进度数据写入 `progress.json`，原子写入保证安全 |
| 练习提交 | 提交练习结果后自动触发掌握度重算 |

**涉及文件**：
- 前端：`frontend/src/App.tsx`（进度状态管理）
- 后端 API：`GET /api/progress`、`POST /api/progress/submit`、`GET /api/progress/analysis/{node_id}`、`POST /api/progress/update`、`GET /api/progress/{node_id}`、`POST /api/progress/{node_id}`
- 后端核心：`backend/app/mastery.py`、`backend/app/storage.py`
- 数据：`data/learning-content/progress.json`、`data/learning-content/initial-progress.json`

---

### 模块 6：学习分析

**功能描述**：多维度学习数据分析与可视化，包括认知层级、知识传播、行为分析等。

| 子功能 | 说明 |
|--------|------|
| 学习概览 | 总体学习进度、知识点掌握率统计 |
| 认知层级分析 | 基于布鲁姆分类（记忆/理解/应用/分析/评价/创造）的掌握度雷达图 |
| 知识传播分析 | 知识点之间的影响传播关系图 |
| 学习行为分析 | 学习时间分布、练习频率、专注度等行为指标 |
| 题目区分度 | 各题目的难度区分度分析 |
| 投入成效分析 | 学习时间投入与掌握度提升的散点图 |
| 动机指数 | 学习动机和坚持度指标 |
| 薄弱知识点 | 低于阈值的薄弱知识点识别 |
| 学习趋势 | 指定时间范围内的掌握度变化趋势 |
| 综合报告 | 汇总所有分析维度的综合报告，支持导出 JSON |

**涉及文件**：
- 前端：`frontend/src/components/LearningAnalyticsPage.tsx`、`AdvancedAnalyticsDashboard.tsx`、`CognitiveRadarChart.tsx`、`KnowledgeHeatmap.tsx`、`KnowledgePropagationGraph.tsx`、`LearningBehaviorPanel.tsx`、`LearningTrendChart.tsx`、`InvestmentEffectivenessScatter.tsx`、`EfficiencyGauge.tsx`、`ProgressDistributionChart.tsx`、`StatsPanel.tsx`
- 后端 API：`GET /api/analytics/cognitive/{node_id}`、`GET /api/analytics/trend`、`GET /api/analytics/weak`、`GET /api/analytics/report`、`GET /api/analytics/report/export`

---

### 模块 7：智能推荐

**功能描述**：基于学习进度和知识图谱关系，智能推荐下一步学习内容。

| 推荐类型 | 说明 |
|----------|------|
| next | 基于已掌握节点，推荐下一步应该学习的知识点 |
| weak | 优先推荐掌握度低的薄弱知识点 |
| review | 根据遗忘曲线，推荐需要复习的知识点 |
| path | 推荐主线路径（支持 full=true 返回完整路径） |

**涉及文件**：
- 前端：`frontend/src/components/PathGuidePanel.tsx`、`frontend/src/utils/pathGuide.ts`
- 后端 API：`GET /api/recommendations?limit=&type=&node_id=&full=`
- 数据：`data/learning-content/recommendation-seeds.json`

---

### 模块 8：AI 智能助手

**功能描述**：集成 AI 大模型的问答、代码分析、学习资料生成和代码生成功能，实现"发现问题→讲解→练习→推荐"的学习闭环。

| 子功能 | 说明 |
|--------|------|
| 多轮对话 | 支持 history 上下文的多轮 AI 对话 |
| 知识点关联 | AI 回答自动关联相关知识点卡片，可点击跳转 |
| 代码分析 | 提交 C++ 代码，AI 分析正确性、关联知识点、给出改进建议 |
| 学习资料生成 | 基于知识点自动生成学习卡片、测验、推荐练习 |
| 代码生成 | 根据描述生成数据结构实现代码 |
| 本地兜底 | 未配置 AI API 时，使用本地知识库匹配生成兜底回答 |

**AI 返回结构 `AiLearningBundle`**：`linkedNodes`（关联节点）、`nodeCards`（知识点卡片）、`graphRelations`（图谱关系）、`quiz`（小测验）、`knowledgeCards`（知识卡片）、`recommendedExercises`（推荐练习）、`learningActions`（学习动作）、`loop`（学习闭环）

**涉及文件**：
- 前端：`frontend/src/components/AiPanel.tsx`
- 后端 API：`POST /api/ai/chat`、`POST /api/ai/code-analysis`、`POST /api/ai/study-artifacts`、`POST /api/ai/code-generation`
- 后端服务：`backend/app/ai_assistant.py`、`backend/app/services/ai.py`、`backend/app/services/knowledge.py`
- 配置：`backend/.env.example`（DEEPSEEK_BASE_URL/API_KEY/MODEL 等）

---

### 模块 9：首屏聚合加载

**功能描述**：前端启动时一次性拉取所有必要数据，减少请求次数；后端不可用时自动降级为本地 JSON 数据。

| 子功能 | 说明 |
|--------|------|
| 聚合接口 | `/api/bootstrap` 一次返回 nodes+edges+contents+codeExamples+exercises+progress+analysisRules+recommendationConfig |
| 本地降级 | 后端不可用时，前端直接 import 本地 JSON 文件作为兜底数据 |
| 路径引导降级 | 推荐请求失败时，使用 `computeLocalRecommendations()` 本地计算 |

**涉及文件**：
- 前端：`frontend/src/App.tsx`、`frontend/src/api.ts`、`frontend/src/data.ts`
- 后端 API：`GET /api/bootstrap`

---

### 模块 10：C++ 核心演示

**功能描述**：C++ 实现的数据结构核心能力，当前为独立命令行演示，未接入 Web 主链路。

| 子功能 | 说明 |
|--------|------|
| API 管理器 | Manager 单例，统一入口 |
| 知识数据库 | KnowledgeDB，管理知识点元数据 |
| 目录构建 | DirectoryBuilder，生成树状/图状目录 |
| 数据结构 | 线性结构、链表、二叉树、图的实现与可视化 |
| 算法 | 排序、搜索等算法 |

**涉及文件**：
- `src/main.cpp`、`src/Manager.cpp`、`src/KnowledgeDB.cpp`、`src/DirectoryBuilder.cpp`、`src/DataStructure.cpp`、`src/LinearStructure.cpp`、`src/LinkedList.cpp`、`src/BinaryTree.cpp`、`src/Graph.cpp`、`src/Algorithm.cpp`
- `include/` 对应头文件
- 构建：`CMakeLists.txt`、`Makefile`

---

## 三、API 接口汇总

### 基础接口

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/bootstrap` | 首屏聚合数据 |
| GET | `/api/exercises` | 题库列表 |

### 知识图谱接口

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/knowledge/nodes` | 知识点列表 |
| GET | `/api/knowledge/edges?node_id=` | 知识边（可选筛选） |
| GET | `/api/knowledge/graph` | 完整图谱 |
| GET | `/api/knowledge/{node_id}` | 知识点详情 |

### 学习进度接口

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/progress` | 全部进度 |
| POST | `/api/progress/submit` | 提交练习结果+自动计算掌握度 |
| GET | `/api/progress/analysis/{node_id}` | 掌握度详细分析 |
| POST | `/api/progress/update` | 更新进度（兼容旧接口） |
| GET/POST | `/api/progress/{node_id}` | 获取/更新指定知识点进度 |

### 学习分析接口

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/analytics/cognitive/{node_id}` | 布鲁姆认知层级分析 |
| GET | `/api/analytics/trend?days=&node_id=` | 学习趋势 |
| GET | `/api/analytics/weak?threshold=` | 薄弱知识点 |
| GET | `/api/analytics/report` | 综合学习分析报告 |
| GET | `/api/analytics/report/export` | 导出报告为 JSON |

### 推荐接口

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/recommendations?limit=&type=&node_id=&full=` | 智能推荐 |

### AI 接口

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/ai/chat` | AI 多轮对话 |
| POST | `/api/ai/code-analysis` | 代码分析 |
| POST | `/api/ai/study-artifacts` | 学习资料生成 |
| POST | `/api/ai/code-generation` | 代码生成 |

### OJ 接口

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/judge` | 编程题判题 |
| GET | `/api/get_problem_data/{id}` | 获取题目数据 |
| GET | `/api/git_tag` | 获取所有标签 |
| GET | `/api/search_tag?tag=` | 按标签搜索 |
| POST | `/api/check_S&C_ans/{id}` | 选择题/填空题判定 |

---

## 四、测试指南

### 4.1 环境准备

#### 前置条件

- Python 3.10+
- Node.js 18+
- Docker（编程题判题需要）
- g++ (C++17)（C++ 核心编译需要）
- AI API Key（可选，AI 功能需要）

#### 启动步骤

```bash
# 1. 安装后端依赖并启动
cd D:/Repositories/AlgoMotion/backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# 2. 安装前端依赖并启动
cd D:/Repositories/AlgoMotion/frontend
npm install
npm run dev

# 3. 启动 OJ 判题容器（如需测试编程题）
cd D:/Repositories/AlgoMotion/oj
docker-compose up -d
```

---

### 4.2 模块 1：知识图谱浏览 — 测试

#### 测试 1.1：图谱加载与渲染

| 项目 | 内容 |
|------|------|
| 前置 | 后端已启动 |
| 步骤 | 1. 打开 `http://localhost:5173`<br>2. 确认默认显示"知识库"页面<br>3. 观察图谱区域是否渲染出节点和边 |
| 预期 | 图谱正常渲染，节点按分类布局，边连线正确 |
| 验证 API | `curl http://127.0.0.1:8000/api/knowledge/graph` 返回 `success: true` 且 `data` 含 nodes 和 edges |

#### 测试 1.2：节点搜索与高亮

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 在图谱上方搜索框输入"二叉树"<br>2. 观察图谱变化 |
| 预期 | 匹配"二叉树"的节点高亮显示，图谱自动聚焦到匹配节点 |

#### 测试 1.3：节点点击与详情加载

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 点击图谱中"栈"节点<br>2. 观察右侧详情面板 |
| 预期 | 详情面板显示"栈"的定义、性质、操作步骤、代码示例等完整内容 |
| 验证 API | `curl http://127.0.0.1:8000/api/knowledge/stack` |

#### 测试 1.4：节点学习状态着色

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 完成某个知识点的练习（参考模块 5 测试）<br>2. 刷新页面，观察图谱中该节点颜色 |
| 预期 | 已学习/已掌握节点与未学习节点颜色不同 |

#### 测试 1.5：后端不可用时的本地降级

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 停止后端服务<br>2. 刷新前端页面 |
| 预期 | 图谱仍能正常渲染（使用本地 JSON 兜底数据），但数据可能略有延迟 |

---

### 4.3 模块 2：知识目录树 — 测试

#### 测试 2.1：目录树展示

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 在知识库页面左侧观察目录树 |
| 预期 | 知识点按分类层级展示，如"线性结构 → 数组/链表/栈/队列" |

#### 测试 2.2：目录节点选择联动

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 在目录树中点击"红黑树"<br>2. 观察图谱和详情面板 |
| 预期 | 图谱聚焦到"红黑树"节点，详情面板显示红黑树内容 |

---

### 4.4 模块 3：知识点详情 — 测试

#### 测试 3.1：完整详情展示

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 选择知识点"堆"<br>2. 逐一查看详情面板各区域 |
| 预期 | 展示：定义、性质、操作步骤、时间复杂度、空间复杂度、常见错误、C++ 代码示例 |

#### 测试 3.2：代码示例展示

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 选择有代码示例的知识点（如"链表"）<br>2. 查看代码示例区域 |
| 预期 | C++ 代码示例以代码块格式正确显示，语法高亮 |

#### 测试 3.3：关联题目列表

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 选择有练习题的知识点（如"二叉搜索树"）<br>2. 查看关联题目区域 |
| 预期 | 显示该知识点关联的选择题/填空题/编程题列表 |

---

### 4.5 模块 4：OJ 在线练习 — 测试

#### 测试 4.1：OJ 页面加载

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 点击顶部导航栏"OJ"标签<br>2. 观察页面 |
| 预期 | OJ 页面正常加载，左侧显示题目分类列表 |

#### 测试 4.2：选择题作答

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 选择一道选择题<br>2. 选择一个选项<br>3. 点击提交 |
| 预期 | 后端返回判定结果（正确/错误），显示正确答案和解析 |
| 验证 API | `curl -X POST http://127.0.0.1:8000/api/check_S&C_ans/{id} -H "Content-Type: application/json" -d '{"answer": "A"}'` |

#### 测试 4.3：填空题作答

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 选择一道填空题<br>2. 输入答案<br>3. 点击提交 |
| 预期 | 后端返回判定结果 |
| 验证 API | `curl -X POST http://127.0.0.1:8000/api/check_S&C_ans/{id} -H "Content-Type: application/json" -d '{"answer": "O(n log n)"}'` |

#### 测试 4.4：编程题代码编辑与判题

| 项目 | 内容 |
|------|------|
| 前置 | Docker 判题容器已启动（`docker-compose up -d`） |
| 步骤 | 1. 选择一道编程题<br>2. 在代码编辑器中编写代码<br>3. 点击提交判题 |
| 预期 | 代码提交到 Docker 容器编译运行，返回判题结果（AC/WA/TLE/CE 等）及各测试点详情 |
| 验证 API | `curl -X POST http://127.0.0.1:8000/api/judge -H "Content-Type: application/json" -d '{"problem_id": "1001", "code": "#include <iostream>\nint main() { return 0; }", "language": "cpp"}'` |

#### 测试 4.5：题目标签搜索

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 使用标签搜索功能搜索"树"相关题目 |
| 预期 | 返回标签匹配的题目列表 |
| 验证 API | `curl http://127.0.0.1:8000/api/search_tag?tag=树` |

#### 测试 4.6：Markdown 题面渲染

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 打开任意题目，查看题面 |
| 预期 | 题面中的 Markdown 格式（加粗、代码块、公式等）正确渲染 |

---

### 4.6 模块 5：学习进度追踪 — 测试

#### 测试 5.1：初始进度加载

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 首次启动系统（确保 `progress.json` 不存在）<br>2. 观察进度数据 |
| 预期 | 使用 `initial-progress.json` 作为初始进度数据 |
| 验证 API | `curl http://127.0.0.1:8000/api/progress` |

#### 测试 5.2：练习提交与掌握度计算

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 提交一道"栈"相关的选择题并答对<br>2. 查看"栈"的掌握度变化 |
| 预期 | 掌握度自动重算，正确率提升，综合掌握度增加 |
| 验证 API | `curl -X POST http://127.0.0.1:8000/api/progress/submit -H "Content-Type: application/json" -d '{"node_id": "stack", "exercise_id": "stack-01", "correct": true, "difficulty": 3, "cognitive_level": "apply"}'` |

#### 测试 5.3：掌握度详细分析

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 获取某个知识点的掌握度分析 |
| 预期 | 返回遗忘曲线数据、复习建议、各维度得分明细 |
| 验证 API | `curl http://127.0.0.1:8000/api/progress/analysis/stack` |

#### 测试 5.4：进度持久化

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 提交练习更新进度<br>2. 重启后端服务<br>3. 再次获取进度 |
| 预期 | 重启后进度数据仍然保留（从 `progress.json` 读取） |

#### 测试 5.5：遗忘曲线与复习建议

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 查看一个很久未复习的知识点分析 |
| 预期 | 遗忘曲线显示掌握度衰减，复习建议显示"建议复习" |

---

### 4.7 模块 6：学习分析 — 测试

#### 测试 6.1：学习分析页面加载

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 点击顶部导航栏"学习追踪"标签<br>2. 观察页面 |
| 预期 | 学习追踪页面正常加载，显示学习概览和各分析图表 |

#### 测试 6.2：认知层级雷达图

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 查看布鲁姆认知层级雷达图 |
| 预期 | 六个维度（记忆/理解/应用/分析/评价/创造）的雷达图正确渲染 |
| 验证 API | `curl http://127.0.0.1:8000/api/analytics/cognitive/stack` |

#### 测试 6.3：学习趋势图

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 查看学习趋势折线图<br>2. 尝试切换时间范围（7天/30天/90天） |
| 预期 | 折线图正确展示掌握度随时间的变化趋势 |
| 验证 API | `curl "http://127.0.0.1:8000/api/analytics/trend?days=30&node_id=stack"` |

#### 测试 6.4：薄弱知识点识别

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 查看薄弱知识点列表 |
| 预期 | 掌握度低于阈值（默认 0.5）的知识点被列出 |
| 验证 API | `curl "http://127.0.0.1:8000/api/analytics/weak?threshold=0.5"` |

#### 测试 6.5：综合报告

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 查看综合学习分析报告 |
| 预期 | 报告包含认知掌握度、知识传播、行为分析、区分度、投入成效、动机指数 |
| 验证 API | `curl http://127.0.0.1:8000/api/analytics/report` |

#### 测试 6.6：报告导出

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 点击"导出报告"按钮 |
| 预期 | 下载 JSON 格式的综合报告文件 |
| 验证 API | `curl http://127.0.0.1:8000/api/analytics/report/export -o report.json` |

#### 测试 6.7：高级分析仪表盘

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 查看高级分析仪表盘各子组件<br>2. 包括：知识热力图、知识传播图、学习行为面板、投入成效散点图、效率仪表 |
| 预期 | 各图表组件正确渲染，数据与进度数据一致 |

---

### 4.8 模块 7：智能推荐 — 测试

#### 测试 7.1：下一步推荐

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 在知识库页面选择一个已掌握的节点<br>2. 查看路径引导面板的推荐 |
| 预期 | 推荐面板显示基于已掌握节点的下一步学习建议 |
| 验证 API | `curl "http://127.0.0.1:8000/api/recommendations?type=next&limit=5"` |

#### 测试 7.2：薄弱知识点推荐

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 请求 weak 类型推荐 |
| 预期 | 优先返回掌握度低的知识点 |
| 验证 API | `curl "http://127.0.0.1:8000/api/recommendations?type=weak&limit=5"` |

#### 测试 7.3：复习推荐

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 请求 review 类型推荐 |
| 预期 | 返回根据遗忘曲线需要复习的知识点 |
| 验证 API | `curl "http://127.0.0.1:8000/api/recommendations?type=review&limit=5"` |

#### 测试 7.4：路径推荐

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 请求 path 类型推荐（full=true） |
| 预期 | 返回完整的学习主线路径 |
| 验证 API | `curl "http://127.0.0.1:8000/api/recommendations?type=path&full=true"` |

#### 测试 7.5：推荐降级

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 停止后端服务<br>2. 在前端切换知识点 |
| 预期 | 路径引导面板使用本地计算结果作为兜底 |

---

### 4.9 模块 8：AI 智能助手 — 测试

#### 测试 8.1：AI 问答

| 项目 | 内容 |
|------|------|
| 前置 | 已配置 AI API Key（`backend/.env` 中设置 DEEPSEEK_API_KEY 等） |
| 步骤 | 1. 点击顶部导航栏"AI"标签<br>2. 输入"什么是红黑树？"<br>3. 点击发送 |
| 预期 | AI 返回红黑树相关回答，附带关联知识点卡片 |
| 验证 API | `curl -X POST http://127.0.0.1:8000/api/ai/chat -H "Content-Type: application/json" -d '{"message": "什么是红黑树？", "history": []}'` |

#### 测试 8.2：多轮对话

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 先问"什么是二叉树？"<br>2. 再问"它和红黑树有什么区别？" |
| 预期 | AI 基于上下文理解"它"指二叉树，给出对比回答 |

#### 测试 8.3：代码分析

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 在 AI 面板切换到"代码分析"模式<br>2. 粘贴一段 C++ 链表代码<br>3. 提交分析 |
| 预期 | AI 返回代码分析结果，包括关联知识点、改进建议、潜在问题 |
| 验证 API | `curl -X POST http://127.0.0.1:8000/api/ai/code-analysis -H "Content-Type: application/json" -d '{"code": "#include <iostream>\nstruct Node { int val; Node* next; };", "language": "cpp"}'` |

#### 测试 8.4：学习资料生成

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 请求生成学习资料 |
| 预期 | 返回知识卡片、小测验、推荐练习等 `AiLearningBundle` 结构 |
| 验证 API | `curl -X POST http://127.0.0.1:8000/api/ai/study-artifacts -H "Content-Type: application/json" -d '{"node_id": "red-black-tree", "type": "quiz"}'` |

#### 测试 8.5：代码生成

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 请求生成代码 |
| 预期 | AI 根据描述生成数据结构实现代码 |
| 验证 API | `curl -X POST http://127.0.0.1:8000/api/ai/code-generation -H "Content-Type: application/json" -d '{"description": "实现一个最小堆", "language": "cpp"}'` |

#### 测试 8.6：AI 未配置时的本地兜底

| 项目 | 内容 |
|------|------|
| 前置 | 未配置 AI API Key |
| 步骤 | 1. 在 AI 面板输入"什么是栈？"<br>2. 点击发送 |
| 预期 | 系统使用本地知识库匹配生成兜底回答（非 AI 生成，但仍有内容） |

---

### 4.10 模块 9：首屏聚合与降级 — 测试

#### 测试 9.1：Bootstrap 聚合接口

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 调用 `/api/bootstrap` 接口 |
| 预期 | 返回包含 nodes、edges、contents、codeExamples、exercises、progress、analysisRules、recommendationConfig 的聚合数据 |
| 验证 API | `curl http://127.0.0.1:8000/api/bootstrap | python -m json.tool | head -50` |

#### 测试 9.2：前端降级模式

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 停止后端<br>2. 打开前端页面 |
| 预期 | 页面正常加载，使用本地 JSON 数据，控制台可能显示连接失败警告 |

---

### 4.11 模块 10：C++ 核心 — 测试

#### 测试 10.1：C++ 编译与运行

| 项目 | 内容 |
|------|------|
| 前置 | 已安装 g++ (C++17) 和 Make |
| 步骤 | 1. `cd D:/Repositories/AlgoMotion`<br>2. `make && ./algomotion` |
| 预期 | 程序编译成功并运行，输出各数据结构的演示信息 |

#### 测试 10.2：CMake 构建

| 项目 | 内容 |
|------|------|
| 步骤 | 1. `mkdir -p build && cd build`<br>2. `cmake -G "MinGW Makefiles" ..`<br>3. `cmake --build .` |
| 预期 | CMake 构建成功 |

---

## 五、通用测试与验证

### 5.1 数据完整性校验

```bash
python D:/Repositories/AlgoMotion/scripts/validate_data.py
```

校验内容：节点/边引用完整性、题目内容完整性、代码示例完整性、分析规则完整性。

### 5.2 后端语法检查

```bash
python -m compileall D:/Repositories/AlgoMotion/backend/app
```

### 5.3 前端构建检查

```bash
cd D:/Repositories/AlgoMotion/frontend && npm run build
```

### 5.4 后端健康检查

```bash
curl http://127.0.0.1:8000/api/health
```

预期返回 `{"success": true, "data": {...}}`

### 5.5 CORS 验证

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 从 `http://localhost:5173` 发起 API 请求 |
| 预期 | 后端正确返回 CORS 头，允许跨域访问 |

### 5.6 参数校验

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 传入无效 nodeId（如特殊字符脚本注入）<br>2. 传入超出范围的分数 |
| 预期 | 后端 `validators.py` 拒绝无效输入，返回 422 错误 |

### 5.7 并发进度写入

| 项目 | 内容 |
|------|------|
| 步骤 | 1. 同时提交多个练习结果 |
| 预期 | `storage.py` 的线程锁（`threading.RLock`）保证数据不损坏 |

---

## 六、测试检查清单

### 快速冒烟测试（5 分钟）

| # | 测试项 | 方法 | 通过 |
|---|--------|------|------|
| 1 | 后端启动 | `uvicorn` 无报错 | ☐ |
| 2 | 健康检查 | `curl /api/health` | ☐ |
| 3 | 前端启动 | `npm run dev` 无报错 | ☐ |
| 4 | 首屏加载 | 浏览器打开显示图谱 | ☐ |
| 5 | 知识点详情 | 点击节点显示详情 | ☐ |
| 6 | OJ 页面 | 切换到 OJ 页面 | ☐ |
| 7 | 学习追踪 | 切换到分析页面 | ☐ |
| 8 | AI 面板 | 切换到 AI 页面 | ☐ |

### 完整功能测试（30 分钟）

| # | 测试项 | 对应章节 | 通过 |
|---|--------|----------|------|
| 1 | 图谱渲染与交互 | 4.2 | ☐ |
| 2 | 目录树联动 | 4.3 | ☐ |
| 3 | 详情展示完整性 | 4.4 | ☐ |
| 4 | 选择题/填空题判定 | 4.5 | ☐ |
| 5 | 编程题判题（Docker） | 4.5 | ☐ |
| 6 | 练习提交与掌握度 | 4.6 | ☐ |
| 7 | 遗忘曲线分析 | 4.6 | ☐ |
| 8 | 进度持久化 | 4.6 | ☐ |
| 9 | 认知层级分析 | 4.7 | ☐ |
| 10 | 薄弱知识点 | 4.7 | ☐ |
| 11 | 综合报告与导出 | 4.7 | ☐ |
| 12 | 四种推荐类型 | 4.8 | ☐ |
| 13 | AI 问答 | 4.9 | ☐ |
| 14 | 代码分析 | 4.9 | ☐ |
| 15 | AI 兜底模式 | 4.9 | ☐ |
| 16 | Bootstrap 聚合 | 4.10 | ☐ |
| 17 | 前端降级模式 | 4.10 | ☐ |
| 18 | 数据完整性校验 | 5.1 | ☐ |
| 19 | 后端语法检查 | 5.2 | ☐ |
| 20 | 前端构建检查 | 5.3 | ☐ |

---

## 七、已知限制与注意事项

1. **无自动化测试**：项目目前没有 pytest/Jest 等自动化测试框架，所有测试需手动进行
2. **C++ 未接入 Web**：C++ 核心模块为独立命令行程序，不参与 Web API 链路
3. **OJ 判题依赖 Docker**：编程题判题需要 Docker 容器运行，否则仅选择题和填空题可用
4. **AI 功能可选**：未配置 API Key 时 AI 功能使用本地兜底，回答质量有限
5. **单用户模式**：当前无用户认证系统，进度数据全局共享
6. **进度并发**：使用 `threading.RLock` 保护，适合单实例部署，多实例需外接存储
