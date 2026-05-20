"""
学习进度相关路由
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field

from ..schemas import ProgressUpdate, LearningMetrics
from ..response import success_response
from ..validators import validate_node_id
from ..mastery import (
    ExerciseResult, MasteryCalculation,
    calculate_mastery_with_breakdown,
    calculate_review_due_with_decay,
    calculate_difficulty_weight,
    calculate_weighted_correct_rate,
    calculate_cognitive_level_mastery,
    calculate_bloom_weighted_mastery,
    DIFFICULTY_WEIGHTS,
)

router = APIRouter(prefix="/api/progress", tags=["学习进度"])


def get_progress_store():
    """获取进度存储（延迟导入）"""
    from ..main import progress_store
    return progress_store


def persist_progress_record(node_id: str, record: dict):
    """持久化单个知识点进度（延迟导入）"""
    from ..main import set_progress_record
    return set_progress_record(node_id, record)


def get_nodes_data():
    """获取知识点数据"""
    from ..main import nodes
    return nodes()


def calculate_review_due(status: str, mastery: float) -> str:
    """计算下次复习时间（简单版本）"""
    if status == "mastered":
        days = 7 if mastery < 0.9 else 14
    elif status == "weak":
        days = 1
    elif status == "learning":
        days = 3
    else:
        days = 0
    
    due = datetime.now() + timedelta(days=days)
    return due.isoformat() + "Z"


# ============================================
# 练习提交请求模型
# ============================================

class ExerciseSubmission(BaseModel):
    """练习提交"""
    node_id: str = Field(..., min_length=1, max_length=100, description="知识点ID")
    score: int = Field(default=0, ge=0, le=100, description="得分")
    exercises: list[dict] = Field(default_factory=list, description="练习结果列表")

    class Config:
        json_schema_extra = {
            "example": {
                "node_id": "binary-search",
                "score": 85,
                "exercises": [
                    {
                        "correct": True,
                        "difficulty": 4,
                        "time_spent": 45.5,
                        "cognitive_level": "apply",
                        "guess": False
                    },
                    {
                        "correct": False,
                        "difficulty": 6,
                        "time_spent": 120.0,
                        "cognitive_level": "analyze",
                        "guess": False
                    }
                ]
            }
        }


class MasteryResponse(BaseModel):
    """掌握度计算响应"""
    node_id: str
    previous_mastery: float
    new_mastery: float
    status: str
    review_due_at: str
    breakdown: dict
    message: str


@router.get("", response_model=dict)
async def get_progress():
    """
    获取学习进度
    
    返回当前用户所有知识点的学习进度
    """
    progress = get_progress_store()
    return success_response(progress)


@router.post("/submit", response_model=dict)
async def submit_exercises(
    submission: ExerciseSubmission = Body(...)
):
    """
    提交练习结果并自动计算掌握度
    
    使用智能掌握度计算、遗忘曲线模型和题目区分度加权
    
    - **node_id**: 知识点 ID
    - **score**: 总得分 (0-100)
    - **exercises**: 练习结果列表，每项包含:
        - correct: 是否正确
        - difficulty: 题目难度 (1-10)
        - time_spent: 用时（秒）
        - cognitive_level: 认知层级 (remember/understand/apply/analyze/evaluate/create)
        - guess: 是否猜题
    """
    node_id = submission.node_id
    
    if not validate_node_id(node_id):
        raise HTTPException(status_code=400, detail="Invalid node ID format")
    
    nodes = get_nodes_data()
    if not any(n.get("id") == node_id for n in nodes):
        raise HTTPException(status_code=404, detail="Knowledge node not found")
    
    progress = get_progress_store()
    current_record = progress.get(node_id, {})
    
    # 获取当前状态
    current_mastery = current_record.get("metrics", {}).get("mastery", 0.0)
    last_mastery = current_record.get("metrics", {}).get("mastery", current_mastery)
    last_studied_at = current_record.get("lastStudiedAt")
    previous_status = current_record.get("status", "not_started")
    
    # 转换练习结果
    exercise_results = [
        ExerciseResult(
            correct=ex.get("correct", False),
            difficulty=ex.get("difficulty", 5),
            time_spent=ex.get("time_spent", 60),
            cognitive_level=ex.get("cognitive_level", "apply"),
            guess_flag=ex.get("guess", False)
        )
        for ex in submission.exercises
    ]
    
    # 计算新的掌握度
    calculation = calculate_mastery_with_breakdown(
        current_mastery=current_mastery,
        exercise_results=exercise_results,
        study_minutes=submission.score // 2,  # 估算学习时长
        attempt_count=len(exercise_results),
        last_mastery=last_mastery,
        last_studied_at=last_studied_at
    )
    
    # 更新进度
    progress_record = {
        "status": calculation.status,
        "score": submission.score,
        "metrics": {
            "mastery": calculation.new_mastery,
            "confidence": calculation.new_mastery,
            "studyMinutes": current_record.get("metrics", {}).get("studyMinutes", 0) + submission.score // 2,
            "attemptCount": current_record.get("metrics", {}).get("attemptCount", 0) + len(exercise_results),
            "correctRate": calculation.mastery_breakdown.get("correct_rate", 0),
            "errorCount": calculation.mastery_breakdown.get("error_count", 0),
            "streakDays": current_record.get("metrics", {}).get("streakDays", 0),
            "lastActivityAt": datetime.now().isoformat() + "Z",
            "reviewDueAt": calculation.review_due_at,
        },
        "lastStudiedAt": datetime.now().isoformat() + "Z",
        "reviewDueAt": calculation.review_due_at,
        "masteryAnalysis": calculation.mastery_breakdown
    }
    persist_progress_record(node_id, progress_record)
    
    return success_response({
        "nodeId": node_id,
        "previousMastery": current_mastery,
        "newMastery": calculation.new_mastery,
        "status": calculation.status,
        "reviewDueAt": calculation.review_due_at,
        "breakdown": calculation.mastery_breakdown,
        "message": calculation.message,
        "weightedStats": calculate_weighted_correct_rate(exercise_results)
    })


@router.get("/analysis/{node_id}", response_model=dict)
async def get_mastery_analysis(node_id: str):
    """
    获取知识点掌握度详细分析
    
    - **node_id**: 知识点 ID
    """
    if not validate_node_id(node_id):
        raise HTTPException(status_code=400, detail="Invalid node ID format")
    
    progress = get_progress_store()
    if node_id not in progress:
        raise HTTPException(status_code=404, detail="Progress not found for this node")
    
    record = progress[node_id]
    current_mastery = record.get("metrics", {}).get("mastery", 0.0)
    last_studied_at = record.get("lastStudiedAt")
    
    # 计算遗忘调整
    from ..mastery import calculate_decay_from_last_study, get_optimal_review_intervals
    mastery_after_decay = calculate_decay_from_last_study(current_mastery, last_studied_at)
    optimal_intervals = get_optimal_review_intervals(current_mastery)
    
    # 获取节点信息
    nodes = get_nodes_data()
    node_info = next((n for n in nodes if n.get("id") == node_id), {})
    
    return success_response({
        "nodeId": node_id,
        "nodeName": node_info.get("name", node_id),
        "currentMastery": current_mastery,
        "masteryAfterDecay": round(mastery_after_decay, 3),
        "daysSinceLastStudy": 0,  # 可从 last_studied_at 计算
        "optimalReviewIntervals": optimal_intervals,
        "status": record.get("status", "not_started"),
        "score": record.get("score", 0),
        "metrics": record.get("metrics", {}),
        "decayInfo": {
            "baseDecayRate": 0.15,
            "stabilityFactor": 7.0,
            "retentionRate": round(mastery_after_decay / current_mastery if current_mastery > 0 else 1.0, 3)
        },
        "recommendations": [
            f"建议{'高频' if current_mastery < 0.5 else '定期'}复习",
            f"下次复习时间: {record.get('reviewDueAt', '未安排')}",
            f"当前复习间隔: {optimal_intervals[0] if optimal_intervals else 1} 天"
        ]
    })


@router.post("/update", response_model=dict)
async def update_progress_legacy(payload: ProgressUpdate):
    """
    更新学习进度（兼容旧接口）
    
    建议使用 POST /api/progress/{node_id} 或 POST /api/progress/submit
    """
    return await update_node_progress(payload.nodeId, payload)


@router.post("/{node_id}", response_model=dict)
async def update_node_progress(node_id: str, payload: ProgressUpdate):
    """
    更新指定知识点的学习进度
    
    - **node_id**: 知识点 ID
    """
    if not validate_node_id(node_id):
        raise HTTPException(status_code=400, detail="Invalid node ID format")
    
    nodes = get_nodes_data()
    if not any(n.get("id") == node_id for n in nodes):
        raise HTTPException(status_code=404, detail="Knowledge node not found")
    
    # 计算复习时间
    review_due = calculate_review_due(payload.status, payload.metrics.mastery)
    
    # 更新进度
    persist_progress_record(node_id, {
        "status": payload.status,
        "score": payload.score,
        "metrics": payload.metrics.model_dump(),
        "lastStudiedAt": datetime.now().isoformat() + "Z",
        "reviewDueAt": review_due
    })
    
    return success_response({
        "nodeId": node_id,
        "updated": True,
        "reviewDueAt": review_due
    })


@router.get("/{node_id}", response_model=dict)
async def get_node_progress(node_id: str):
    """
    获取指定知识点的学习进度
    
    - **node_id**: 知识点 ID
    """
    if not validate_node_id(node_id):
        raise HTTPException(status_code=400, detail="Invalid node ID format")
    
    progress = get_progress_store()
    if node_id not in progress:
        raise HTTPException(status_code=404, detail="Progress not found for this node")
    
    return success_response({node_id: progress[node_id]})
