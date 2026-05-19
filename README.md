# AlgoMotion

《数据结构》智慧学习平台。当前仓库已经包含 C++ 数据结构核心、FastAPI 数据接口、React 前端和 JSON 知识数据层，目标是形成“知识图谱 -> 学习追踪 -> OJ 练习 -> AI 辅助分析”的闭环。

## 当前已完成

- C++ 核心：抽象数据结构接口、线性表、链表、二叉树、图、基础算法、知识库和统一 Manager JSON API。
- 知识图谱：33 个数据结构知识节点、45 条关系边，支持层级包含、前置知识、相关、应用、错因来源等关系类型。
- 前端主界面：侧边栏一级入口包括知识库、OJ 练习、学习追踪、AI 辅助问答。
- 知识库页面：支持图谱/目录切换、搜索、知识点详情、C++ 示例、关联知识点、学习状态标记。
- 学习追踪页面：使用专业指标记录学习情况，包括掌握度、自信度、学习时长、OJ 尝试次数、正确率、错因数量、连续学习天数和复习时间。
- OJ 练习页面：练习题已经从知识详情中独立出来，支持从知识点跳转到 OJ 页面，并预留提交区。
- 错因分析绑定：OJ 与 AI 代码分析都通过 `nodeId` 绑定知识库，可把错题、代码问题和常见错误映射到知识点。
- AI 辅助问答：已作为侧边栏一级分支，不再放在页面底部；当前使用规则和占位回复，后续可接大模型。
- 前后端基础联通：前端启动时优先请求 FastAPI `/api/bootstrap`，学习状态更新会 POST 到后端，AI/OJ 代码分析会调用后端分析接口。
- 数据校验脚本：可校验节点、边、题目、内容、代码示例、分析规则是否引用了不存在的知识点。

## 项目结构

```txt
AlgoMotion/
├── include/                         # C++ 头文件
├── src/                             # C++ 实现与 Manager 演示入口
├── external/json/                   # jsoncpp 头文件和静态库
├── backend/                         # FastAPI 接口层
│   └── app/
├── frontend/                        # React + TypeScript + Vite 前端
│   └── src/
│       ├── components/              # 图谱、目录、知识详情、OJ、学习追踪、AI 页面
│       ├── App.tsx                  # 主导航和页面切换
│       ├── data.ts                  # JSON 数据聚合入口
│       └── types.ts                 # 前端共享类型
├── data/
│   ├── knowledge-graph/             # 知识节点与关系边
│   ├── learning-content/            # 讲解、代码示例、进度、推荐、分析规则
│   ├── exercises/                   # OJ 题库
│   └── knowledge.json               # C++ 知识库参考数据
├── docs/                            # 架构、API、图谱数据规范、协作计划
└── scripts/                         # 数据校验脚本
```

## 功能模块

### 1. C++ 数据结构核心

位置：`include/`、`src/`

- `DataStructure`：统一抽象基类。
- `LinearStructure`：线性结构中间抽象层。
- `LinkedList`、`BinaryTree`、`Graph`：当前已实现的数据结构示例。
- `Algorithm`：基础算法工具。
- `KnowledgeDB`：C++ 侧知识点数据库。
- `DirectoryBuilder`：树状/图状目录构建。
- `Manager`：统一 JSON API 入口，提供目录、知识点详情、可视化数据、学习报告、AI 占位接口。

### 2. FastAPI 数据接口

位置：`backend/app/main.py`、`backend/app/schemas.py`

已提供接口：

- `GET /api/bootstrap`
- `GET /api/health`
- `GET /api/knowledge/nodes`
- `GET /api/knowledge/edges`
- `GET /api/knowledge/graph`
- `GET /api/knowledge/{node_id}`
- `GET /api/progress/me`
- `POST /api/progress/update`
- `GET /api/recommendations/me`
- `POST /api/ai/chat`
- `POST /api/ai/code-analysis`

MVP 阶段接口直接读取 `data/` 下 JSON 文件，学习进度使用内存存储，后续可替换为数据库。

### 3. React 前端

位置：`frontend/src/`

- `App.tsx`：主布局、侧边栏一级导航、页面切换、当前知识点和练习题状态。
- `GraphView.tsx`：SVG 知识图谱。
- `DirectoryView.tsx`：知识目录树。
- `KnowledgeDetail.tsx`：知识点详情、状态标记、练习题跳转。
- `ExerciseOjPage.tsx`：OJ 练习页、提交区、错因分析、知识点绑定。
- `LearningAnalyticsPage.tsx`：学习追踪指标面板、薄弱点、推荐路径。
- `AiPanel.tsx`：AI 问答和 C++ 代码分析占位。

### 4. JSON 数据层

位置：`data/`

- `knowledge-graph/nodes.json`：知识点节点。
- `knowledge-graph/edges.json`：知识点关系。
- `learning-content/knowledge-content.json`：定义、性质、操作步骤、复杂度、常见错误。
- `learning-content/code-examples.json`：C++ 示例代码。
- `learning-content/initial-progress.json`：演示用学习记录。
- `learning-content/code-analysis-rules.json`：代码分析规则与知识点映射。
- `learning-content/recommendation-seeds.json`：推荐路径种子。
- `exercises/exercises.json`：OJ 练习题。

## 数据模型重点

学习状态分两层：

```txt
status: not_started | learning | mastered | weak
score: 0-100
metrics: 专业学习追踪参数
```

`metrics` 当前包括：

- `mastery`：掌握度
- `confidence`：自评置信度
- `studyMinutes`：有效学习时长
- `attemptCount`：OJ 尝试次数
- `correctRate`：练习正确率
- `errorCount`：错因数量
- `streakDays`：连续学习天数
- `lastActivityAt`：最近学习时间
- `reviewDueAt`：下次复习时间

知识本体关系兼容层：

```txt
KnowledgeEdge -> OntologyRelation
subjectId + predicate + objectId + source + evidence
```

这样后续可以把人工知识图谱、OJ 错题关系、AI 分析结果统一接入同一套知识本体。

## 运行方式

### 前端

```bash
cd frontend
npm install
npm run dev
```

默认地址：`http://127.0.0.1:5173`

前端会优先连接 `http://127.0.0.1:8000` 的 FastAPI 后端。若后端未启动，页面顶部会显示“本地/异常模式”，并回退到本地 JSON mock 数据；若连接成功，会显示“FastAPI 已连接”。

### 前端构建检查

```bash
cd frontend
npm run build
```

### 数据校验

```bash
python scripts/validate_data.py
```

### FastAPI 后端

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

默认地址：`http://127.0.0.1:8000`

接口文档：`http://127.0.0.1:8000/docs`

AI 问答使用兼容 OpenAI Chat Completions 的接口。启动后端前配置：

```bash
set AI_API_KEY=你的 API Key
set AI_MODEL=你的模型名
set AI_BASE_URL=https://api.openai.com/v1
```

也可以参考 `backend/.env.example`。如果未配置 API，问答会基于本地知识库给出兜底回答，前端仍可正常联通。
后端会自动读取仓库根目录 `.env` 或 `backend/.env` 中的上述配置。

### C++ 核心

```bash
mkdir build
cd build
cmake -G "MinGW Makefiles" ..
cmake --build .
./algomotion
```

也可以参考根目录 `Makefile`，但当前 CMake 路径已经配置 jsoncpp，更适合现有代码。

## 近期优先级

1. 统一前端是否直接读 JSON，还是切到 FastAPI 接口读取。
2. 为 OJ 页面补真实提交状态：未提交、通过、错误、查看解析。
3. 把 `attemptCount`、`correctRate`、`errorCount` 从 OJ 操作反向写入学习追踪。
4. 扩充知识内容和题库，优先覆盖栈、队列、树、图、查找、排序主线。
5. 把 AI 占位规则升级为“题目 + 代码 + 知识点”的结构化分析结果。

## 前后端联通验收清单

| 功能 | 当前程度 | 验收方式 |
|------|----------|----------|
| 启动数据联通 | 已完成基础联通，前端通过 `/api/bootstrap` 拉取节点、边、内容、题库、进度、规则和推荐配置 | 先启动 FastAPI，再启动前端，页面顶部显示“FastAPI 已连接” |
| 本地兜底 | 已完成，后端没开时前端仍可用本地 JSON mock | 关闭后端刷新前端，页面顶部显示“本地/异常模式” |
| 学习状态同步 | 已完成 POST，点击知识点详情里的学习状态按钮会调用 `/api/progress/update` | 点击“已掌握/学习中/需巩固”，顶部提示“FastAPI 已同步” |
| 知识库页面 | 已接后端启动数据，图谱、目录、详情、练习题入口可用 | 搜索知识点、切换图谱/目录、点击节点查看详情 |
| OJ 页面 | 已接后端题库数据，提交分析会调用 `/api/ai/code-analysis` | 进入 OJ，输入代码后点击“提交分析”，查看绑定知识点和建议 |
| AI 页面 | 已接后端问答和代码分析接口 | 点击“发送问题”或“分析代码”，查看后端返回内容 |
| 学习追踪页面 | 已使用后端进度数据初始化，推荐仍由前端基于图谱规则计算 | 查看学习追踪页的掌握度、时长、尝试次数、薄弱点 |
| 真实 OJ 判题 | 未完成，目前是提交区和错因分析占位 | 后续需新增判题接口、运行状态和测试用例结果 |
| C++ 接入 Web | 未完成，C++ 当前仍是独立 demo/核心能力层 | 后续可由 Python 调用 C++ 程序或抽成服务 |

