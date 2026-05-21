# AlgoMotion

《数据结构》智慧学习平台。项目目标是形成“知识图谱 -> OJ 练习 -> 学习追踪 -> AI 辅助分析”的学习闭环。

当前仓库包含四部分：

- C++ 数据结构核心：链表、树、图、算法等基础实现与演示入口。
- FastAPI 后端：读取 JSON 数据、提供知识库/OJ/学习追踪/AI 接口。
- React 前端：知识库、OJ 练习、学习追踪、AI 问答四个主页面。
- JSON 数据层：知识图谱、讲解内容、示例代码、题库、演示进度和分析规则。

## 快速复现

推荐分别开两个终端：一个跑后端，一个跑前端。

### 1. 启动后端

环境建议：Python 3.10+。

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

后端默认地址：

```txt
http://127.0.0.1:8000
```

接口文档：

```txt
http://127.0.0.1:8000/docs
```

健康检查：

```bash
curl http://127.0.0.1:8000/api/health
```

Windows PowerShell 也可以用：

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

### 2. 启动前端

环境建议：Node.js 20+。

```bash
cd frontend
npm install
npm run dev
```

前端默认地址：

```txt
http://127.0.0.1:5173
```

前端会优先连接 `http://127.0.0.1:8000`。如果后端正常启动，页面顶部会显示“FastAPI 已连接”；如果后端没开，会进入本地 JSON 兜底模式。

### 3. 一键验收常用命令

在仓库根目录运行：

```bash
python scripts/validate_data.py
```

后端语法检查：

```bash
python -m compileall backend/app
```

前端构建检查：

```bash
cd frontend
npm run build
```

## 后端结构

后端入口已经拆薄，`backend/app/main.py` 只负责创建 FastAPI app、配置 CORS、注册路由。协作开发时优先按模块找文件，不要把新功能继续塞回 `main.py`。

```txt
backend/app/
├── main.py                 # FastAPI app 装配入口
├── config.py               # 项目路径、.env 加载
├── storage.py              # JSON 读取、学习进度持久化
├── schemas.py              # Pydantic 请求/响应模型
├── validators.py           # 参数校验
├── mastery.py              # 掌握度、遗忘曲线、复习时间计算
├── services/
│   ├── knowledge.py        # 知识点检索、相关节点、AI 上下文拼装
│   └── ai.py               # AI 调用、兜底回答、代码分析
└── routes/
    ├── core.py             # /api/health、/api/bootstrap、/api/exercises
    ├── legacy.py           # 前端当前依赖的旧格式接口
    ├── knowledge.py        # 新版知识图谱接口
    ├── progress.py         # 学习进度接口
    ├── analytics.py        # 高级学习分析接口
    ├── recommendations.py  # 推荐接口
    ├── ai.py               # AI 问答和代码分析入口
    └── oj.py               # OJ 判题和题目读取
```

建议分工：

- 知识库功能：`routes/knowledge.py`、`services/knowledge.py`、`data/knowledge-graph/`、`data/learning-content/`
- OJ 功能：`routes/oj.py`、`data/exercises/`、`oj/`
- 学习追踪：`routes/progress.py`、`routes/analytics.py`、`mastery.py`、`storage.py`
- AI 问答：`routes/ai.py`、`services/ai.py`、`data/learning-content/code-analysis-rules.json`
- 前端页面：`frontend/src/App.tsx` 和 `frontend/src/components/`

## 前端结构

```txt
frontend/src/
├── App.tsx                         # 主布局、页面切换、前后端联动
├── api.ts                          # 后端请求封装
├── data.ts                         # 本地 JSON 兜底数据聚合
├── types.ts                        # 前端共享类型
├── styles.css                      # 全局样式
└── components/
    ├── GraphView.tsx               # 知识图谱
    ├── DirectoryView.tsx           # 知识目录
    ├── KnowledgeDetail.tsx         # 知识点详情
    ├── ExerciseOjPage.tsx          # OJ 页面
    ├── LearningAnalyticsPage.tsx   # 学习追踪页
    ├── AiPanel.tsx                 # AI 问答页
    └── oj/                         # OJ 子组件
```

前端启动时调用 `/api/bootstrap` 拉取首屏数据。状态修改、OJ 判题、AI 问答会继续调用后端接口。

## 数据文件

```txt
data/
├── knowledge-graph/
│   ├── nodes.json                  # 知识点节点
│   └── edges.json                  # 知识点关系边
├── learning-content/
│   ├── knowledge-content.json      # 知识点讲解
│   ├── code-examples.json          # C++ 示例代码
│   ├── initial-progress.json       # 首次启动用演示进度
│   ├── recommendation-seeds.json   # 推荐路径默认配置
│   └── code-analysis-rules.json    # 代码分析规则
├── exercises/
│   └── exercises.json              # OJ 题库索引
└── oj-data/                        # 编程题测试数据
```

学习进度持久化说明：

- 后端首次启动时，如果没有 `data/learning-content/progress.json`，会读取 `initial-progress.json`。
- 用户更新学习状态后，会写入 `data/learning-content/progress.json`。
- `progress.json` 是运行期个人数据，已在 `.gitignore` 中忽略。
- 如需重置演示数据，停止后端后删除 `data/learning-content/progress.json`，再重启后端。

修改数据后务必运行：

```bash
python scripts/validate_data.py
```

这个脚本会检查节点、边、题目、内容、代码示例、分析规则是否引用了不存在的知识点。

## 主要接口

基础接口：

- `GET /api/health`
- `GET /api/bootstrap`
- `GET /api/exercises`

知识库旧格式接口，前端当前仍在使用：

- `GET /api/knowledge/nodes`
- `GET /api/knowledge/edges`
- `GET /api/knowledge/graph`
- `GET /api/knowledge/{node_id}`

学习进度：

- `GET /api/progress/me`
- `POST /api/progress/update`
- `GET /api/progress`
- `POST /api/progress/{node_id}`
- `POST /api/progress/submit`
- `GET /api/progress/analysis/{node_id}`

学习分析：

- `GET /api/analytics/report`
- `GET /api/analytics/weak`
- `GET /api/analytics/trend`
- `GET /api/analytics/cognitive/{node_id}`

AI：

- `POST /api/ai/chat`
- `POST /api/ai/code-analysis`

OJ：

- `POST /api/judge`
- `GET /api/get_problem_data/{id}`
- `POST /api/check_S&C_ans/{id}`

推荐：

- `GET /api/recommendations/me`
- `GET /api/recommendations`

## AI 配置

AI 问答使用兼容 OpenAI Chat Completions 的接口。没有配置 API 时，后端会基于本地知识库给出兜底回答，前端仍可正常使用。

可以在仓库根目录 `.env` 或 `backend/.env` 中配置：

```txt
AI_API_KEY=你的 API Key
AI_MODEL=你的模型名
AI_BASE_URL=https://api.openai.com/v1
```

也可以使用环境变量：

```bash
export AI_API_KEY=你的 API Key
export AI_MODEL=你的模型名
export AI_BASE_URL=https://api.openai.com/v1
```

Windows PowerShell：

```powershell
$env:AI_API_KEY="你的 API Key"
$env:AI_MODEL="你的模型名"
$env:AI_BASE_URL="https://api.openai.com/v1"
```

更多示例见 `backend/.env.example`。

## OJ 判题说明

`POST /api/judge` 默认调用 Docker 容器 `global-judger`。如果只复现知识库、学习追踪、AI 页面，可以不启动 OJ 容器；OJ 编程题真实判题会失败或返回服务错误，但前端其他功能不受影响。

需要真实判题时参考：

```txt
oj/README.md
```

当前题库入口：

```txt
data/exercises/exercises.json
```

编程题测试数据：

```txt
data/oj-data/
```

## C++ 核心

C++ 部分当前是独立演示/核心能力层，尚未作为 Web 后端主链路的一部分。

```bash
mkdir build
cd build
cmake -G "MinGW Makefiles" ..
cmake --build .
./algomotion
```

如果不是负责 C++ 核心模块，可以先不用构建这部分。

## 协作开发路线

当前重点方向：

1. 知识库：把图谱展示升级为“章节层级视图 + 图结构关系”，补路径指导、搜索定位、示例代码和知识点题目。
2. OJ：重整题库目录，支持按题号和章节检索，补相关题推荐和基础题库。
3. 学习追踪：准备更完整的演示学生数据，完善高级分析展示，增加报告导出。
4. AI 问答：升级为多轮对话，支持上传材料生成 quiz/知识卡片，生成可跳转知识点卡片，形成“发现问题 -> 讲解 -> 练习 -> 推荐”的闭环。

开发建议：

- 新功能尽量放到对应 `routes/` 或 `services/` 文件，不要扩张 `main.py`。
- 修改数据文件后跑 `python scripts/validate_data.py`。
- 修改前端后跑 `npm run build`。
- 修改后端后跑 `python -m compileall backend/app`。
- 保持旧接口兼容，除非同步修改 `frontend/src/api.ts` 和调用方。

## 常见问题

### 前端显示“本地/异常模式”

通常是后端没有启动，或后端端口不是 `8000`。先访问：

```txt
http://127.0.0.1:8000/api/health
```

### 修改学习状态后想恢复初始演示数据

停止后端，删除：

```txt
data/learning-content/progress.json
```

然后重启后端。

### AI 没有调用外部模型

检查 `.env` 或环境变量中是否配置了 `AI_API_KEY` 和 `AI_MODEL`。没配置时是正常兜底模式。

### OJ 编程题判题失败

检查 Docker 和 `global-judger` 容器是否启动。只看知识库、学习追踪、AI 页面时可以先忽略。
