"""
路由模块
包含所有 API 路由
"""
from .analytics import router as analytics_router
from .ai import router as ai_router
from .core import router as core_router
from .knowledge import router as knowledge_router
from .legacy import router as legacy_router
from .oj import router as oj_router
from .progress import router as progress_router
from .recommendations import router as recommendations_router

__all__ = [
    "analytics_router",
    "ai_router",
    "core_router",
    "knowledge_router",
    "legacy_router",
    "oj_router",
    "progress_router",
    "recommendations_router",
]
