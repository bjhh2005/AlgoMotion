from fastapi import APIRouter, HTTPException

from ..schemas import ChatRequest, CodeAnalysisRequest
from ..services.ai import analyze_cpp_code, answer_chat

router = APIRouter(prefix="/api/ai", tags=["AI 辅助"])


@router.post("/chat")
def chat(payload: ChatRequest):
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="message cannot be empty")

    return answer_chat(message, payload.nodeId)


@router.post("/code-analysis")
def analyze_code(payload: CodeAnalysisRequest):
    return analyze_cpp_code(payload.code, payload.problem)
