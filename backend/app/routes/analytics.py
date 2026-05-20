"""
学习分析相关路由
"""
import random
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query

from ..schemas import (
    CognitiveMastery, QuestionAttemptStats,
    PropagationAnalysis, PropagationNode,
    BehaviorAnalysis, DiscriminationAnalysis,
    MotivationIndex, LearningOverview,
    ComprehensiveReport, LearningTrend, TrendPoint, TrendSummary,
    WeakKnowledgePoint, CognitiveLevel, ProgressStatus
)
from ..response import success_response
from ..validators import validate_node_id, validate_mastery

router = APIRouter(prefix="/api/analytics", tags=["学习分析"])


def get_nodes_data():
    """获取知识点数据"""
    from ..main import nodes
    return nodes()


def get_edges_data():
    """获取边数据"""
    from ..main import edges
    return edges()


def get_progress_store():
    """获取进度存储"""
    from ..main import progress_store
    return progress_store


# ============================================
# 认知层级分析
# ============================================

@router.get("/cognitive/{node_id}", response_model=dict)
async def get_cognitive_analysis(node_id: str):
    """
    获取指定知识点的布鲁姆认知层级分析
    
    - **node_id**: 知识点 ID
    """
    if not validate_node_id(node_id):
        raise HTTPException(status_code=400, detail="Invalid node ID format")
    
    nodes = get_nodes_data()
    if not any(n.get("id") == node_id for n in nodes):
        raise HTTPException(status_code=404, detail="Knowledge node not found")
    
    progress = get_progress_store()
    mastery = progress.get(node_id, {}).get("metrics", {}).get("mastery", 0.5)
    
    # 生成认知层级数据
    cognitive_levels: list[CognitiveLevel] = ["remember", "understand", "apply", "analyze", "evaluate", "create"]
    level_mastery = {}
    question_stats = {}
    
    weights = [0.1, 0.15, 0.25, 0.25, 0.15, 0.1]
    bloom_sum = 0
    
    for idx, level in enumerate(cognitive_levels):
        level_factor = 1 - idx * 0.12
        lm = min(1.0, mastery * level_factor + random.uniform(-0.1, 0.2))
        level_mastery[level] = round(lm, 3)
        
        total = random.randint(3, 15)
        correct = int(total * lm)
        question_stats[level] = QuestionAttemptStats(
            total=total,
            correct=correct,
            avg_time_spent=random.uniform(20, 300),
            guess_rate=random.uniform(0, 0.3)
        )
        
        bloom_sum += lm * weights[idx]
    
    cognitive = CognitiveMastery(
        node_id=node_id,
        level_mastery=level_mastery,
        question_attempt_stats=question_stats,
        bloom_weighted_mastery=round(bloom_sum, 3)
    )
    
    return success_response(cognitive.model_dump())


# ============================================
# 学习趋势
# ============================================

@router.get("/trend", response_model=dict)
async def get_learning_trend(
    days: int = Query(default=7, ge=1, le=90, description="统计天数"),
    node_id: str | None = Query(default=None, description="筛选特定节点")
):
    """
    获取学习趋势数据
    
    - **days**: 统计天数，默认 7
    - **node_id**: 可选，筛选特定节点
    """
    if node_id and not validate_node_id(node_id):
        raise HTTPException(status_code=400, detail="Invalid node ID format")
    
    nodes = get_nodes_data()
    if node_id and not any(n.get("id") == node_id for n in nodes):
        raise HTTPException(status_code=404, detail="Knowledge node not found")
    
    progress = get_progress_store()
    
    # 生成趋势数据
    trend = []
    base_mastery = 0.5
    base_minutes = 30
    
    for i in range(days):
        date = datetime.now() - timedelta(days=days - i - 1)
        date_str = date.strftime("%Y-%m-%d")
        
        # 模拟学习进步
        mastery = min(1.0, base_mastery + i * 0.03 + random.uniform(-0.05, 0.1))
        minutes = int(base_minutes + random.uniform(-10, 20))
        
        trend.append(TrendPoint(
            date=date_str,
            mastery=round(mastery, 3),
            study_minutes=minutes
        ))
        
        base_mastery = mastery
    
    # 计算摘要
    avg_mastery = sum(t.mastery for t in trend) / len(trend)
    total_minutes = sum(t.study_minutes for t in trend)
    peak_day = max(trend, key=lambda t: t.study_minutes)
    
    trend_data = LearningTrend(
        days=days,
        trend=trend,
        summary=TrendSummary(
            avg_mastery=round(avg_mastery, 3),
            total_study_minutes=total_minutes,
            peak_date=peak_day.date
        )
    )
    
    return success_response(trend_data.model_dump())


# ============================================
# 薄弱知识点
# ============================================

@router.get("/weak", response_model=dict)
async def get_weak_knowledge(
    threshold: float = Query(default=0.5, ge=0, le=1, description="掌握度阈值")
):
    """
    获取需要加强的知识点
    
    - **threshold**: 掌握度阈值，默认 0.5
    """
    progress = get_progress_store()
    nodes = get_nodes_data()
    edges = get_edges_data()
    
    node_by_id = {n.get("id"): n for n in nodes}
    weak_points = []
    
    for node_id, record in progress.items():
        mastery = record.get("metrics", {}).get("mastery", 0)
        status = record.get("status", "not_started")
        
        if mastery < threshold or status == "weak":
            # 找出受影响的节点
            affected = [
                e.get("target") if e.get("source") == node_id else e.get("source")
                for e in edges
                if e.get("source") == node_id or e.get("target") == node_id
            ]
            
            weak_points.append(WeakKnowledgePoint(
                node_id=node_id,
                name=node_by_id.get(node_id, {}).get("name", node_id),
                mastery=round(mastery, 3),
                status=status,
                review_due_at=record.get("reviewDueAt"),
                affected_nodes=affected[:5]  # 最多5个
            ))
    
    # 按掌握度排序
    weak_points.sort(key=lambda x: x.mastery)
    
    return success_response([wp.model_dump() for wp in weak_points])


# ============================================
# 综合学习报告
# ============================================

@router.get("/report", response_model=dict)
async def get_comprehensive_report():
    """
    获取综合学习分析报告
    
    包含所有三个维度的分析数据
    """
    progress = get_progress_store()
    nodes = get_nodes_data()
    edges = get_edges_data()
    
    # 统计概览
    status_counts: dict[ProgressStatus, int] = {
        "not_started": 0, "learning": 0, "mastered": 0, "weak": 0
    }
    total_mastery = 0
    total_minutes = 0
    total_attempts = 0
    total_errors = 0
    
    for node in nodes:
        node_id = node.get("id")
        record = progress.get(node_id, {})
        status = record.get("status", "not_started")
        status_counts[status] += 1
        total_mastery += record.get("metrics", {}).get("mastery", 0)
        total_minutes += record.get("metrics", {}).get("studyMinutes", 0)
        total_attempts += record.get("metrics", {}).get("attemptCount", 0)
        total_errors += record.get("metrics", {}).get("errorCount", 0)
    
    overview = LearningOverview(
        total_nodes=len(nodes),
        mastered=status_counts["mastered"],
        learning=status_counts["learning"],
        weak=status_counts["weak"],
        not_started=status_counts["not_started"],
        avg_mastery=round(total_mastery / len(nodes), 3) if nodes else 0,
        total_study_minutes=total_minutes,
        total_attempts=total_attempts,
        total_errors=total_errors
    )
    
    # 生成薄弱节点传播分析
    weak_nodes = [n.get("id") for n in nodes if progress.get(n.get("id"), {}).get("status") == "weak"]
    propagation_analyses = []
    
    for weak_id in weak_nodes[:5]:
        affected = [
            PropagationNode(
                node_id=e.get("target") if e.get("source") == weak_id else e.get("source"),
                propagation_strength=round(random.uniform(0.3, 0.9), 2),
                path_type=e.get("type", "related"),
                root_cause=random.choice([True, False])
            )
            for e in edges
            if e.get("source") == weak_id or e.get("target") == weak_id
        ]
        
        propagation_analyses.append(PropagationAnalysis(
            source_node_id=weak_id,
            affected_nodes=affected[:5],
            weakness_severity=round(random.uniform(0.3, 0.8), 2),
            downstream_risk=random.choice(["low", "medium", "high", "critical"])
        ))
    
    # 生成认知掌握度数据
    cognitive_mastery: dict[str, CognitiveMastery] = {}
    for node in nodes:
        node_id = node.get("id")
        mastery = progress.get(node_id, {}).get("metrics", {}).get("mastery", 0.5)
        
        cognitive_levels: list[CognitiveLevel] = ["remember", "understand", "apply", "analyze", "evaluate", "create"]
        level_mastery = {}
        question_stats = {}
        
        for idx, level in enumerate(cognitive_levels):
            lm = min(1.0, mastery * (1 - idx * 0.12) + random.uniform(-0.1, 0.1))
            level_mastery[level] = round(lm, 2)
            question_stats[level] = QuestionAttemptStats(
                total=random.randint(3, 10),
                correct=int(random.randint(2, 8)),
                avg_time_spent=random.uniform(20, 200),
                guess_rate=random.uniform(0, 0.25)
            )
        
        cognitive_mastery[node_id] = CognitiveMastery(
            node_id=node_id,
            level_mastery=level_mastery,
            question_attempt_stats=question_stats,
            bloom_weighted_mastery=round(sum(lm for lm in level_mastery.values()) / 6, 2)
        )
    
    # 生成行为分析数据
    behavior_analyses: dict[str, BehaviorAnalysis] = {}
    for node in nodes:
        node_id = node.get("id")
        record = progress.get(node_id, {})
        has_attempts = record.get("metrics", {}).get("attemptCount", 0) > 0
        
        behavior_analyses[node_id] = BehaviorAnalysis(
            node_id=node_id,
            average_time_per_question=random.uniform(15, 60) if has_attempts else random.uniform(10, 30),
            time_variance=random.uniform(50, 200),
            rush_rate=random.uniform(0, 0.4),
            hesitation_rate=random.uniform(0, 0.3),
            guess_rate=random.uniform(0, 0.25) if has_attempts else random.uniform(0, 0.15),
            consistency=random.uniform(0.5, 0.9),
            suspicious_flag=random.random() > 0.9,
            suspicious_reason="答题时间异常，可能存在蒙猜行为" if random.random() > 0.9 else None
        )
    
    # 动机指数
    motivation_index = MotivationIndex(
        student_id="current_user",
        consistency_score=round(random.uniform(60, 100), 1),
        perseverance_index=round(random.uniform(50, 100), 1),
        growth_mindset_score=round(random.uniform(70, 100), 1),
        intrinsic_motivation_score=round(random.uniform(60, 100), 1),
        effort_effectiveness_ratio=round(random.uniform(0.5, 1.0), 2),
        fake_effort_suspicion=round(random.uniform(0, 0.3), 2)
    )
    
    report = ComprehensiveReport(
        student_id="current_user",
        timestamp=datetime.now().isoformat() + "Z",
        overview=overview,
        cognitive_mastery=cognitive_mastery,
        propagation_analyses=propagation_analyses,
        behavior_analyses=behavior_analyses,
        motivation_index=motivation_index
    )
    
    return success_response(report.model_dump())
