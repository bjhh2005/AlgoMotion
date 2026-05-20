"""
AI 对话相关路由
"""
from fastapi import APIRouter, HTTPException

from ..schemas import ChatRequest, CodeAnalysisRequest
from ..response import success_response
from ..validators import validate_node_id, sanitize_string

router = APIRouter(prefix="/api/ai", tags=["AI 辅助"])


def get_code_analysis_rules():
    """获取代码分析规则"""
    from ..main import code_analysis_rules
    return code_analysis_rules()


@router.post("/chat", response_model=dict)
async def chat(payload: ChatRequest):
    """
    AI 问答接口
    
    - **message**: 用户消息
    - **node_id**: 可选，当前聚焦的知识点 ID
    """
    # 清理输入
    message = sanitize_string(payload.message, max_length=2000)
    
    focus = f" 当前聚焦知识点：{payload.nodeId}。" if payload.nodeId else ""
    
    # TODO: 后续可接入大模型与自建问答库
    return success_response({
        "answer": f"这是 AI 问答接口占位回复。{focus}您的的问题是：{message}",
        "linkedNodes": [payload.nodeId] if payload.nodeId else []
    })


@router.post("/code-analysis", response_model=dict)
async def analyze_code(payload: CodeAnalysisRequest):
    """
    代码分析接口
    
    - **code**: 需要分析的代码
    - **problem**: 可选，题目描述
    """
    code = sanitize_string(payload.code, max_length=50000)
    
    linked = []
    suggestions = []
    
    for rule in get_code_analysis_rules():
        keywords = rule.get("keywords", [])
        if all(keyword.lower() in code.lower() for keyword in keywords):
            linked.extend(rule.get("linkedNodes", []))
            suggestions.append(rule.get("suggestion", ""))
    
    if not linked:
        linked = ["linear-list"]
        suggestions = ["暂未识别到明确算法标签，可补充题目描述提升分析准确度。"]
    
    # TODO: 后续可替换为大模型分析
    return success_response({
        "summary": "代码分析占位结果：当前版本使用规则识别，后续可替换为大模型分析。",
        "linkedNodes": list(dict.fromkeys(linked)),
        "suggestions": suggestions
    })
