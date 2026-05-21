"""
学习分析相关路由
"""
import json
import random
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from ..schemas import (
    CognitiveMastery, QuestionAttemptStats,
    PropagationAnalysis, PropagationNode,
    BehaviorAnalysis, DiscriminationAnalysis,
    InvestmentEffectivenessAnalysis,
    MotivationIndex, LearningOverview,
    ComprehensiveReport, LearningTrend, TrendPoint, TrendSummary,
    WeakKnowledgePoint, CognitiveLevel, ProgressStatus
)
from ..response import success_response
from ..validators import validate_node_id, validate_mastery

router = APIRouter(prefix="/api/analytics", tags=["学习分析"])


def get_nodes_data():
    """获取知识点数据"""
    from ..storage import nodes
    return nodes()


def get_edges_data():
    """获取边数据"""
    from ..storage import edges
    return edges()


def get_progress_store():
    """获取进度存储"""
    from ..storage import progress_store
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

def build_comprehensive_report():
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
    
    node_by_id = {n.get("id"): n for n in nodes}

    # 生成薄弱节点传播分析
    weak_nodes = [n_id for n_id, record in progress.items() if record.get("status") == "weak"]
    propagation_analyses = []

    for weak_id in weak_nodes[:5]:
        weak_record = progress.get(weak_id, {})
        weak_mastery = weak_record.get("metrics", {}).get("mastery", 0)
        connected_edges = [
            e for e in edges if e.get("source") == weak_id or e.get("target") == weak_id
        ]
        affected = []

        for e in connected_edges:
            target_id = e.get("target") if e.get("source") == weak_id else e.get("source")
            target_record = progress.get(target_id, {})
            target_mastery = target_record.get("metrics", {}).get("mastery", 0)
            edge_weight = e.get("weight", 0.5)
            type_bonus = 0.12 if e.get("type") == "prerequisite" else 0.06 if e.get("type") == "used_in" else 0.0
            strength = min(1.0, 0.35 + (1 - weak_mastery) * 0.5 + (1 - target_mastery) * 0.1 + edge_weight * 0.1 + type_bonus)

            affected.append(PropagationNode(
                node_id=target_id,
                propagation_strength=round(strength, 2),
                path_type=e.get("type", "related"),
                root_cause=weak_mastery < 0.45
            ))

        affected_masteries = [progress.get(n.node_id, {}).get("metrics", {}).get("mastery", 0) for n in affected]
        weak_link_count = sum(1 for m in affected_masteries if m < 0.6)
        severity = min(1.0, round((1 - weak_mastery) * 0.9 + weak_link_count * 0.08 + len(affected) * 0.02, 2))
        if severity >= 0.8:
            downstream_risk = "critical"
        elif severity >= 0.6:
            downstream_risk = "high"
        elif severity >= 0.35:
            downstream_risk = "medium"
        else:
            downstream_risk = "low"

        propagation_analyses.append(PropagationAnalysis(
            source_node_id=weak_id,
            affected_nodes=affected[:5],
            weakness_severity=severity,
            downstream_risk=downstream_risk
        ))

    # 生成认知掌握度数据
    cognitive_mastery: dict[str, CognitiveMastery] = {}
    for node in nodes:
        node_id = node.get("id")
        record = progress.get(node_id, {})
        metrics = record.get("metrics", {})
        mastery = metrics.get("mastery", 0.5)
        confidence = metrics.get("confidence", 0.5)
        attempt_count = max(1, metrics.get("attemptCount", 0))
        correct_rate = metrics.get("correctRate", mastery)
        study_minutes = metrics.get("studyMinutes", 0)

        cognitive_levels: list[CognitiveLevel] = ["remember", "understand", "apply", "analyze", "evaluate", "create"]
        level_mastery = {}
        question_stats = {}
        weights = [0.1, 0.15, 0.25, 0.25, 0.15, 0.1]

        for idx, level in enumerate(cognitive_levels):
            base = mastery * 0.65 + confidence * 0.25 + (1 - idx * 0.08) * 0.1
            multiplier = 1 - idx * 0.08
            lm = min(1.0, max(0.0, base * multiplier + (0.03 if attempt_count > 3 else -0.02)))
            level_mastery[level] = round(lm, 2)

            total = max(3, min(12, int(round(attempt_count * max(0.4, 1 - idx * 0.08)))))
            correct = min(total, int(round(total * min(1.0, correct_rate + 0.05))))
            avg_time_spent = round(max(10.0, min(240.0, study_minutes * 1.0 / attempt_count * (1 + idx * 0.03))), 1)
            guess_rate = round(min(1.0, max(0.0, (1 - correct_rate) * (0.9 + idx * 0.02))), 3)

            question_stats[level] = QuestionAttemptStats(
                total=total,
                correct=correct,
                avg_time_spent=avg_time_spent,
                guess_rate=guess_rate
            )

        weighted = sum(level_mastery[level] * weights[idx] for idx, level in enumerate(cognitive_levels))
        cognitive_mastery[node_id] = CognitiveMastery(
            node_id=node_id,
            level_mastery=level_mastery,
            question_attempt_stats=question_stats,
            bloom_weighted_mastery=round(weighted, 2)
        )

    # 生成行为分析数据
    behavior_analyses: dict[str, BehaviorAnalysis] = {}
    for node in nodes:
        node_id = node.get("id")
        record = progress.get(node_id, {})
        metrics = record.get("metrics", {})
        mastery = metrics.get("mastery", 0.0)
        confidence = metrics.get("confidence", 0.0)
        attempt_count = metrics.get("attemptCount", 0)
        study_minutes = metrics.get("studyMinutes", 0)
        correct_rate = metrics.get("correctRate", 0.0)
        error_count = metrics.get("errorCount", 0)

        avg_time = study_minutes / attempt_count if attempt_count else 0.0
        rush_rate = min(1.0, max(0.0, 0.15 + (1 - correct_rate) * 0.5 - min(avg_time / 120, 0.1)))
        hesitation_rate = min(1.0, max(0.0, (1 - confidence) * 0.55 + (0.08 if attempt_count > 0 else 0.02)))
        guess_rate = min(1.0, max(0.0, 1 - correct_rate)) if attempt_count else 0.0
        consistency = min(1.0, confidence * 0.45 + mastery * 0.35 + min(attempt_count / 10, 1.0) * 0.2)
        suspicious_flag = attempt_count > 0 and avg_time < 12 and error_count / attempt_count > 0.3
        suspicious_reason = None
        if suspicious_flag:
            suspicious_reason = "答题时间显著偏短且错误率较高，存在学习策略问题"

        behavior_analyses[node_id] = BehaviorAnalysis(
            node_id=node_id,
            average_time_per_question=round(avg_time or 0.0, 1),
            time_variance=round((avg_time * 5 + error_count * 3 + (1 - consistency) * 40), 2),
            rush_rate=round(rush_rate, 3),
            hesitation_rate=round(hesitation_rate, 3),
            guess_rate=round(guess_rate, 3),
            consistency=round(consistency, 3),
            suspicious_flag=suspicious_flag,
            suspicious_reason=suspicious_reason
        )

    # 生成题目区分度分析数据
    sorted_nodes = sorted(
        nodes,
        key=lambda n: progress.get(n.get("id"), {}).get("metrics", {}).get("attemptCount", 0),
        reverse=True
    )
    question_discriminations = []
    for node in sorted_nodes[:15]:
        node_id = node.get("id")
        metrics = progress.get(node_id, {}).get("metrics", {})
        mastery = metrics.get("mastery", 0.0)
        correct_rate = metrics.get("correctRate", 0.0)
        error_count = metrics.get("errorCount", 0)
        exercise_id = f"EX-{node_id}"
        discrimination_index = round(min(1.0, max(-1.0, correct_rate * 0.6 + mastery * 0.3 - error_count * 0.02)), 3)
        difficulty = round(min(1.0, max(0.1, node.get("difficulty", 5) / 10 * 0.7 + (1 - mastery) * 0.3)), 3)
        if discrimination_index >= 0.7:
            effectiveness = "excellent"
        elif discrimination_index >= 0.55:
            effectiveness = "good"
        elif discrimination_index >= 0.4:
            effectiveness = "acceptable"
        else:
            effectiveness = "poor"

        question_discriminations.append(DiscriminationAnalysis(
            exercise_id=exercise_id,
            discrimination_index=discrimination_index,
            difficulty=difficulty,
            effectiveness=effectiveness
        ))

    # 生成投入成效分析数据
    total_study_minutes = sum(r.get("metrics", {}).get("studyMinutes", 0) for r in progress.values())
    total_attempts = sum(r.get("metrics", {}).get("attemptCount", 0) for r in progress.values())
    avg_mastery = total_mastery / len(nodes) if nodes else 0.0
    avg_correct_rate = sum(r.get("metrics", {}).get("correctRate", 0.0) for r in progress.values()) / max(1, len(progress))
    engagement_depth = "deep" if avg_mastery >= 0.75 and total_study_minutes >= 100 else "moderate" if avg_mastery >= 0.5 else "surface"
    efficiency_score = round(min(100.0, avg_mastery * 60 + avg_correct_rate * 25 + min(total_study_minutes / 4, 20)), 1)
    category = (
        "efficient" if efficiency_score >= 70 else
        "inefficient" if efficiency_score <= 40 else
        "diving" if avg_mastery >= 0.6 and total_study_minutes < 80 else
        "dormant"
    )
    investment_effectiveness = [
        InvestmentEffectivenessAnalysis(
            student_id="current_user",
            investment={
                "student_id": "current_user",
                "study_time_minutes": total_study_minutes,
                "interaction_count": total_attempts,
                "practice_time_minutes": int(total_attempts * 3 + total_study_minutes * 0.2),
                "note_count": max(0, int(total_study_minutes / 30)),
                "doubt_raised": max(0, int(len([r for r in progress.values() if r.get("metrics", {}).get("confidence", 0) < 0.5]) / 2)),
                "discussion_contribution": max(0, int(len([r for r in progress.values() if r.get("metrics", {}).get("streakDays", 0) >= 3]) / 2)),
                "engagement_depth": engagement_depth,
            },
            effectiveness={
                "mastery_gain": round(min(1.0, avg_mastery * 0.25 + 0.05), 3),
                "score_improvement": round(avg_mastery * 100 * 0.4, 1),
                "skill_growth": round(avg_mastery * 80 * 0.4, 1),
            },
            category=category,
            correlation_coefficient=round(min(1.0, avg_mastery * 0.6 + avg_correct_rate * 0.4), 3),
            efficiency_score=efficiency_score,
            flags={
                "suspectedFakeEffort": efficiency_score < 40 and avg_correct_rate < 0.6,
                "potentialMethodIssue": efficiency_score < 45,
                "underUtilized": category == "dormant",
            },
            recommendations=[
                "增加专项练习，提升薄弱知识点掌握度" if category in ("inefficient", "dormant") else "继续保持当前学习节奏并关注错题复习"
            ]
        )
    ]

    # 动机指数
    avg_confidence = sum(r.get("metrics", {}).get("confidence", 0.0) for r in progress.values()) / max(1, len(progress))
    total_error_count = sum(r.get("metrics", {}).get("errorCount", 0) for r in progress.values())
    active_nodes = sum(1 for r in progress.values() if r.get("metrics", {}).get("attemptCount", 0) > 0)
    active_ratio = active_nodes / max(1, len(nodes))

    motivation_index = MotivationIndex(
        student_id="current_user",
        consistency_score=round(min(100.0, avg_mastery * 60 + avg_confidence * 30 + active_ratio * 10), 1),
        perseverance_index=round(min(100.0, active_ratio * 70 + min(total_study_minutes / 20, 20) + avg_confidence * 10), 1),
        growth_mindset_score=round(min(100.0, avg_confidence * 50 + avg_mastery * 35 + active_ratio * 15), 1),
        intrinsic_motivation_score=round(min(100.0, avg_confidence * 45 + active_ratio * 30 + (1 - total_error_count / max(1, total_attempts)) * 25), 1),
        effort_effectiveness_ratio=round(min(1.0, avg_mastery * 0.6 + avg_correct_rate * 0.3 + active_ratio * 0.1), 3),
        fake_effort_suspicion=round(max(0.0, min(1.0, 0.3 + (1 - avg_correct_rate) * 0.5 - active_ratio * 0.2)), 3)
    )

    report = ComprehensiveReport(
        student_id="current_user",
        timestamp=datetime.now().isoformat() + "Z",
        overview=overview,
        cognitive_mastery=cognitive_mastery,
        propagation_analyses=propagation_analyses,
        behavior_analyses=behavior_analyses,
        question_discriminations=question_discriminations,
        investment_effectiveness=investment_effectiveness,
        motivation_index=motivation_index
    )
    
    return success_response(report.model_dump())


@router.get("/report/export")
async def export_comprehensive_report():
    """
    导出综合学习分析报告

    返回 JSON 报告文件，适合下载保存。
    """
    report = build_comprehensive_report()
    filename = f"learning-analytics-report-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    content = json.dumps(report.model_dump(), ensure_ascii=False, indent=2)

    return Response(
        content=content,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
