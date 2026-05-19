"""
路由模块
包含所有 API 路由
"""
from .knowledge import router as knowledge_router
from .progress import router as progress_router
from .analytics import router as analytics_router
from .ai import router as ai_router
from .recommendations import router as recommendations_router

__all__ = [
    "knowledge_router",
    "progress_router",
    "analytics_router",
    "ai_router",
    "recommendations_router",
]
