"""
AlgoMotion 后端 API 服务

基于 FastAPI 的数据结构智慧学习平台后端
支持知识图谱、学习进度追踪、AI 辅助问答等功能
"""
import json
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .schemas import ChatRequest, CodeAnalysisRequest, ProgressUpdate
from .response import error_response


# ============================================
# 配置
# ============================================

ROOT = Path(__file__).resolve().parents[2]
GRAPH_DIR = ROOT / "data" / "knowledge-graph"
EXERCISE_DIR = ROOT / "data" / "exercises"
CONTENT_DIR = ROOT / "data" / "learning-content"

# 允许的 CORS 来源
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


# ============================================
# 生命周期管理
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时加载数据
    print("AlgoMotion API 启动中...")
    yield
    # 关闭时保存数据
    print("AlgoMotion API 关闭中...")
    save_progress()


# ============================================
# FastAPI 应用
# ============================================

app = FastAPI(
    title="AlgoMotion API",
    description="数据结构智慧学习平台后端 API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# 异常处理
# ============================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """HTTP 异常处理"""
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response(exc.detail or "Request error", str(exc)),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """通用异常处理"""
    return JSONResponse(
        status_code=500,
        content=error_response("Internal server error", str(exc)),
    )


# ============================================
# 数据加载
# ============================================

def read_json(path: Path):
    """读取 JSON 文件"""
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_json(path: Path, data):
    """保存 JSON 文件"""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)


# 进度存储（内存）
progress_store: dict = {}


def load_initial_data():
    """加载初始数据"""
    global progress_store
    
    # 加载进度数据
    progress_file = CONTENT_DIR / "initial-progress.json"
    if progress_file.exists():
        progress_store = read_json(progress_file)
    else:
        progress_store = {}


def save_progress():
    """保存进度数据"""
    progress_file = CONTENT_DIR / "initial-progress.json"
    save_json(progress_file, progress_store)


def nodes():
    """获取知识点"""
    return read_json(GRAPH_DIR / "nodes.json")


def edges():
    """获取知识边"""
    return read_json(GRAPH_DIR / "edges.json")


def contents():
    """获取知识内容"""
    return read_json(CONTENT_DIR / "knowledge-content.json")


def code_examples():
    """获取代码示例"""
    return read_json(CONTENT_DIR / "code-examples.json")


def recommendation_seeds():
    """获取推荐配置"""
    return read_json(CONTENT_DIR / "recommendation-seeds.json")


def code_analysis_rules():
    """获取代码分析规则"""
    return read_json(CONTENT_DIR / "code-analysis-rules.json")


def exercises():
    """获取练习题"""
    return read_json(EXERCISE_DIR / "exercises.json")


# 启动时加载数据
load_initial_data()


# ============================================
# 健康检查
# ============================================

@app.get("/api/health", tags=["健康检查"])
def health():
    """健康检查接口"""
    return {"status": "ok", "service": "AlgoMotion API", "version": "1.0.0"}


# ============================================
# 引导数据接口
# ============================================

@app.get("/api/bootstrap", tags=["数据"])
def bootstrap():
    """
    获取初始引导数据
    
    返回启动应用所需的所有初始数据
    """
    return {
        "nodes": nodes(),
        "edges": edges(),
        "contents": contents(),
        "codeExamples": code_examples(),
        "exercises": exercises(),
        "progress": progress_store,
        "analysisRules": code_analysis_rules(),
        "recommendationConfig": recommendation_seeds()
    }


# ============================================
# 知识图谱路由
# ============================================

from .routes.knowledge import router as knowledge_router
app.include_router(knowledge_router)


# ============================================
# 学习进度路由
# ============================================

from .routes.progress import router as progress_router
app.include_router(progress_router)


# ============================================
# 学习分析路由
# ============================================

from .routes.analytics import router as analytics_router
app.include_router(analytics_router)


# ============================================
# 推荐路由
# ============================================

from .routes.recommendations import router as recommendations_router
app.include_router(recommendations_router)


# ============================================
# AI 对话路由
# ============================================

from .routes.ai import router as ai_router
app.include_router(ai_router)


# ============================================
# 兼容旧接口（可移除）
# ============================================

@app.get("/api/progress/me", tags=["兼容"])
def get_progress_legacy():
    """获取进度（旧接口，保留兼容）"""
    return progress_store


@app.post("/api/recommendations/me", tags=["兼容"])
def get_recommendations_legacy():
    """获取推荐（旧接口，保留兼容）"""
    from .routes.recommendations import get_recommendations as get_rec
    from fastapi import Query
    return get_rec(limit=Query(default=5), type=Query(default="next"))


@app.post("/api/ai/chat", tags=["兼容"])
def chat_legacy(payload: ChatRequest):
    """聊天（旧接口，保留兼容）"""
    from .routes.ai import chat
    return chat(payload)


@app.post("/api/ai/code-analysis", tags=["兼容"])
def analyze_code_legacy(payload: CodeAnalysisRequest):
    """代码分析（旧接口，保留兼容）"""
    from .routes.ai import analyze_code
    return analyze_code(payload)
