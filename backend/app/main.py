from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import load_local_env
from .routes.analytics import router as analytics_router
from .routes.ai import router as ai_router
from .routes.core import router as core_router
from .routes.knowledge import router as knowledge_router
from .routes.legacy import router as legacy_router
from .routes.oj import router as oj_router
from .routes.progress import router as progress_router
from .routes.recommendations import router as recommendations_router


load_local_env()

app = FastAPI(title="AlgoMotion API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(core_router)
app.include_router(legacy_router)
app.include_router(ai_router)
app.include_router(oj_router)
app.include_router(analytics_router)
app.include_router(progress_router)
app.include_router(recommendations_router)
app.include_router(knowledge_router)
