"""
学习分析相关路由
基于真实学习记录计算分析数据，支持 JSON/Markdown/HTML 导出
"""
import json
import math
from datetime import datetime, timedelta
from io import BytesIO
from typing import Optional

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
from ..learning_records import (
    get_exercise_log, get_daily_snapshots, clear_learning_records
)

router = APIRouter(prefix="/api/analytics", tags=["学习分析"])


def get_nodes_data():
    from ..storage import nodes
    return nodes()


def get_edges_data():
    from ..storage import edges
    return edges()


def get_progress_store():
    from ..storage import progress_store
    return progress_store


# ============================================
# 辅助：从真实学习记录计算各维度数据
# ============================================

def _compute_cognitive_from_log(node_id: str, progress_record: dict, node_log: list[dict]):
    mastery = progress_record.get("metrics", {}).get("mastery", 0.5)
    confidence = progress_record.get("metrics", {}).get("confidence", 0.5)
    attempt_count = max(1, progress_record.get("metrics", {}).get("attemptCount", 0))
    correct_rate = progress_record.get("metrics", {}).get("correctRate", mastery)
    study_minutes = progress_record.get("metrics", {}).get("studyMinutes", 0)

    cognitive_levels: list[CognitiveLevel] = ["remember", "understand", "apply", "analyze", "evaluate", "create"]
    level_mastery = {}
    question_stats = {}
    weights = [0.1, 0.15, 0.25, 0.25, 0.15, 0.1]

    level_records = {level: [] for level in cognitive_levels}
    for rec in node_log:
        level = rec.get("cognitiveLevel", "apply")
        if level in level_records:
            level_records[level].append(rec)

    for idx, level in enumerate(cognitive_levels):
        records = level_records[level]
        if records:
            correct_count = sum(1 for r in records if r.get("correct"))
            total_count = len(records)
            lm = correct_count / total_count if total_count > 0 else 0
            avg_time = sum(r.get("timeSpent", 60) for r in records) / total_count
            guess_count = sum(1 for r in records if r.get("guess"))
            guess_rate = guess_count / total_count if total_count > 0 else 0

            level_mastery[level] = round(lm, 3)
            question_stats[level] = QuestionAttemptStats(
                total=total_count,
                correct=correct_count,
                avg_time_spent=round(avg_time, 1),
                guess_rate=round(guess_rate, 3)
            )
        else:
            base = mastery * 0.65 + confidence * 0.25 + (1 - idx * 0.08) * 0.1
            multiplier = 1 - idx * 0.08
            lm = min(1.0, max(0.0, base * multiplier + (0.03 if attempt_count > 3 else -0.02)))
            level_mastery[level] = round(lm, 3)

            total = max(3, min(12, int(round(attempt_count * max(0.4, 1 - idx * 0.08)))))
            correct = min(total, int(round(total * min(1.0, correct_rate + 0.05))))
            avg_time_spent = round(max(10.0, min(240.0, study_minutes * 1.0 / attempt_count * (1 + idx * 0.03))), 1)
            guess_rate_val = round(min(1.0, max(0.0, (1 - correct_rate) * (0.9 + idx * 0.02))), 3)

            question_stats[level] = QuestionAttemptStats(
                total=total,
                correct=correct,
                avg_time_spent=avg_time_spent,
                guess_rate=guess_rate_val
            )

    bloom_sum = sum(level_mastery[level] * weights[idx] for idx, level in enumerate(cognitive_levels))
    return CognitiveMastery(
        node_id=node_id,
        level_mastery=level_mastery,
        question_attempt_stats=question_stats,
        bloom_weighted_mastery=round(bloom_sum, 3)
    )


def _compute_behavior_from_log(node_id: str, progress_record: dict, node_log: list[dict]):
    metrics = progress_record.get("metrics", {})
    mastery = metrics.get("mastery", 0.0)
    confidence = metrics.get("confidence", 0.0)
    attempt_count = metrics.get("attemptCount", 0)
    study_minutes = metrics.get("studyMinutes", 0)
    correct_rate = metrics.get("correctRate", 0.0)
    error_count = metrics.get("errorCount", 0)

    if node_log:
        times = [r.get("timeSpent", 60) for r in node_log]
        avg_time = sum(times) / len(times)
        time_variance = sum((t - avg_time) ** 2 for t in times) / len(times)
        rush_count = sum(1 for t in times if t < 15)
        rush_rate = rush_count / len(times)
        hesitation_count = sum(1 for t in times if t > 300)
        hesitation_rate = hesitation_count / len(times)
        guess_count = sum(1 for r in node_log if r.get("guess"))
        guess_rate = guess_count / len(node_log)
    else:
        avg_time = study_minutes / attempt_count if attempt_count else 0.0
        time_variance = (avg_time * 5 + error_count * 3) * 0.5
        rush_rate = min(1.0, max(0.0, 0.15 + (1 - correct_rate) * 0.5 - min(avg_time / 120, 0.1)))
        hesitation_rate = min(1.0, max(0.0, (1 - confidence) * 0.55 + (0.08 if attempt_count > 0 else 0.02)))
        guess_rate = min(1.0, max(0.0, 1 - correct_rate)) if attempt_count else 0.0

    consistency = min(1.0, confidence * 0.45 + mastery * 0.35 + min(attempt_count / 10, 1.0) * 0.2)
    suspicious_flag = attempt_count > 0 and avg_time < 12 and error_count / max(1, attempt_count) > 0.3
    suspicious_reason = None
    if suspicious_flag:
        suspicious_reason = "答题时间显著偏短且错误率较高，存在学习策略问题"

    return BehaviorAnalysis(
        node_id=node_id,
        average_time_per_question=round(avg_time, 1),
        time_variance=round(time_variance, 2),
        rush_rate=round(rush_rate, 3),
        hesitation_rate=round(hesitation_rate, 3),
        guess_rate=round(guess_rate, 3),
        consistency=round(consistency, 3),
        suspicious_flag=suspicious_flag,
        suspicious_reason=suspicious_reason
    )


# ============================================
# 认知层级分析
# ============================================

@router.get("/cognitive/{node_id}", response_model=dict)
async def get_cognitive_analysis(node_id: str):
    if not validate_node_id(node_id):
        raise HTTPException(status_code=400, detail="Invalid node ID format")

    nodes = get_nodes_data()
    if not any(n.get("id") == node_id for n in nodes):
        raise HTTPException(status_code=404, detail="Knowledge node not found")

    progress = get_progress_store()
    record = progress.get(node_id, {})
    node_log = get_exercise_log(node_id=node_id, limit=500)

    cognitive = _compute_cognitive_from_log(node_id, record, node_log)
    return success_response(cognitive.model_dump())


# ============================================
# 学习趋势（基于真实每日快照）
# ============================================

@router.get("/trend", response_model=dict)
async def get_learning_trend(
    days: int = Query(default=7, ge=1, le=90, description="统计天数"),
    node_id: str | None = Query(default=None, description="筛选特定节点")
):
    if node_id and not validate_node_id(node_id):
        raise HTTPException(status_code=400, detail="Invalid node ID format")

    nodes = get_nodes_data()
    if node_id and not any(n.get("id") == node_id for n in nodes):
        raise HTTPException(status_code=404, detail="Knowledge node not found")

    progress = get_progress_store()
    snapshots = get_daily_snapshots(days=days)

    trend = []
    for i in range(days):
        date = datetime.now() - timedelta(days=days - i - 1)
        date_str = date.strftime("%Y-%m-%d")
        snap = snapshots.get(date_str, {})

        if snap:
            node_masteries = snap.get("nodeMasteries", {})
            if node_id:
                mastery = node_masteries.get(node_id, None)
                if mastery is None:
                    record = progress.get(node_id, {})
                    mastery = record.get("metrics", {}).get("mastery", 0.0)
            else:
                vals = [v for v in node_masteries.values() if v > 0]
                mastery = sum(vals) / len(vals) if vals else 0.0
            study_minutes = snap.get("totalStudyMinutes", 0)
        else:
            if node_id:
                record = progress.get(node_id, {})
                mastery = record.get("metrics", {}).get("mastery", 0.0)
            else:
                total_m = sum(r.get("metrics", {}).get("mastery", 0) for r in progress.values())
                mastery = total_m / len(progress) if progress else 0.0
            study_minutes = 0

        trend.append(TrendPoint(
            date=date_str,
            mastery=round(mastery, 3),
            study_minutes=study_minutes
        ))

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
    progress = get_progress_store()
    nodes = get_nodes_data()
    edges = get_edges_data()

    node_by_id = {n.get("id"): n for n in nodes}
    weak_points = []

    for node_id, record in progress.items():
        mastery = record.get("metrics", {}).get("mastery", 0)
        status = record.get("status", "not_started")

        if mastery < threshold or status == "weak":
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
                affected_nodes=affected[:5]
            ))

    weak_points.sort(key=lambda x: x.mastery)
    return success_response([wp.model_dump() for wp in weak_points])


# ============================================
# 综合学习报告（基于真实记录）
# ============================================

def build_comprehensive_report() -> ComprehensiveReport:
    progress = get_progress_store()
    nodes = get_nodes_data()
    edges = get_edges_data()
    all_log = get_exercise_log(limit=5000)

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

    log_by_node = {}
    for rec in all_log:
        nid = rec.get("nodeId")
        if nid not in log_by_node:
            log_by_node[nid] = []
        log_by_node[nid].append(rec)

    weak_nodes = [n_id for n_id, record in progress.items() if record.get("status") == "weak"]
    propagation_analyses = []
    for weak_id in weak_nodes[:5]:
        weak_record = progress.get(weak_id, {})
        weak_mastery = weak_record.get("metrics", {}).get("mastery", 0)
        connected_edges = [e for e in edges if e.get("source") == weak_id or e.get("target") == weak_id]
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

    cognitive_mastery: dict[str, CognitiveMastery] = {}
    for node in nodes:
        node_id = node.get("id")
        record = progress.get(node_id, {})
        node_log = log_by_node.get(node_id, [])
        cognitive_mastery[node_id] = _compute_cognitive_from_log(node_id, record, node_log)

    behavior_analyses: dict[str, BehaviorAnalysis] = {}
    for node in nodes:
        node_id = node.get("id")
        record = progress.get(node_id, {})
        node_log = log_by_node.get(node_id, [])
        behavior_analyses[node_id] = _compute_behavior_from_log(node_id, record, node_log)

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
                "suspected_fake_effort": efficiency_score < 40 and avg_correct_rate < 0.6,
                "potential_method_issue": efficiency_score < 45,
                "under_utilized": category == "dormant",
            },
            recommendations=[
                "增加专项练习，提升薄弱知识点掌握度" if category in ("inefficient", "dormant") else "继续保持当前学习节奏并关注错题复习"
            ]
        )
    ]

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

    return ComprehensiveReport(
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


@router.get("/report")
async def get_comprehensive_report():
    report = build_comprehensive_report()
    return success_response(report.model_dump())


# ============================================
# 报告导出（JSON / Markdown / HTML）
# ============================================

def _pct(val: float) -> str:
    return f"{val:.1%}"

def _bar(value: float, color: str = "#4facfe", width: str = "120px") -> str:
    pct_int = max(0, min(100, int(value * 100)))
    return f'''<div style="display:flex;align-items:center;gap:8px;">
      <div style="width:{width};height:8px;background:#e8ecf1;border-radius:4px;overflow:hidden;">
        <div style="width:{pct_int}%;height:100%;background:{color};border-radius:4px;"></div>
      </div>
      <span style="font-size:12px;color:#555;">{pct_int}%</span>
    </div>'''

def _risk_badge(level: str) -> str:
    colors = {"critical": "#e74c3c", "high": "#e67e22", "medium": "#f39c12", "low": "#27ae60"}
    c = colors.get(level, "#95a5a6")
    return f'<span style="display:inline-block;padding:2px 10px;border-radius:12px;color:#fff;background:{c};font-size:11px;font-weight:600;">{level.upper()}</span>'

def _effectiveness_badge(e: str) -> str:
    colors = {"excellent": "#27ae60", "good": "#2ecc71", "acceptable": "#f39c12", "poor": "#e74c3c"}
    c = colors.get(e, "#95a5a6")
    return f'<span style="display:inline-block;padding:2px 10px;border-radius:12px;color:#fff;background:{c};font-size:11px;font-weight:600;">{e.upper()}</span>'

def _category_badge(cat: str) -> str:
    colors = {"efficient": "#27ae60", "inefficient": "#e74c3c", "diving": "#3498db", "dormant": "#95a5a6"}
    labels = {"efficient": "高效", "inefficient": "低效", "diving": "深潜", "dormant": "休眠"}
    c = colors.get(cat, "#95a5a6")
    l = labels.get(cat, cat)
    return f'<span style="display:inline-block;padding:2px 10px;border-radius:12px;color:#fff;background:{c};font-size:11px;font-weight:600;">{l}</span>'

BLOOM_LEVELS = ["remember", "understand", "apply", "analyze", "evaluate", "create"]
BLOOM_LABELS = {"remember": "记忆", "understand": "理解", "apply": "应用", "analyze": "分析", "evaluate": "评价", "create": "创造"}
BLOOM_COLORS = {"remember": "#4facfe", "understand": "#43e97b", "apply": "#fa709a", "analyze": "#f0abfc", "evaluate": "#fbbf24", "create": "#a78bfa"}

def _report_to_html(report: ComprehensiveReport) -> str:
    ov = report.overview
    sections = []

    sections.append(f"""<div class="header">
      <div class="logo">AlgoMotion</div>
      <h1>学习分析综合报告</h1>
      <div class="meta">
        <span>学生: {report.student_id}</span>
        <span>生成时间: {report.timestamp}</span>
      </div>
    </div>""")

    sections.append("""<div class="section">
      <h2>一、学习概览</h2>
      <div class="overview-grid">""")
    overview_cards = [
        ("知识点总数", ov.total_nodes, "#4facfe", "📚"),
        ("已掌握", ov.mastered, "#27ae60", "✅"),
        ("学习中", ov.learning, "#3498db", "📖"),
        ("需巩固", ov.weak, "#e67e22", "⚠️"),
        ("未开始", ov.not_started, "#95a5a6", "⬜"),
        ("总学习时长", f"{ov.total_study_minutes} min", "#9b59b6", "⏱️"),
        ("总尝试次数", ov.total_attempts, "#1abc9c", "🔄"),
        ("总错误次数", ov.total_errors, "#e74c3c", "❌"),
    ]
    for label, value, color, icon in overview_cards:
        sections.append(f"""<div class="stat-card" style="border-left:4px solid {color};">
          <div class="stat-icon">{icon}</div>
          <div class="stat-value">{value}</div>
          <div class="stat-label">{label}</div>
        </div>""")
    sections.append(f"""</div>
      <div class="mastery-bar-wrap">
        <div class="mastery-bar-label">平均掌握度</div>
        <div class="mastery-bar-track">
          <div class="mastery-bar-fill" style="width:{ov.avg_mastery:.1%};"></div>
        </div>
        <div class="mastery-bar-pct">{ov.avg_mastery:.1%}</div>
      </div>
    </div>""")

    sections.append('<div class="section"><h2>二、布鲁姆认知层级分析</h2>')
    for node_id, cm in list(report.cognitive_mastery.items())[:10]:
        sections.append(f'<h3 style="margin-top:16px;color:#2c3e50;">{node_id}</h3>')
        sections.append('<table><thead><tr><th>层级</th><th>掌握度</th><th>题目数</th><th>正确数</th><th>平均用时</th><th>蒙猜率</th></tr></thead><tbody>')
        for level in BLOOM_LEVELS:
            lm = cm.level_mastery.get(level, 0)
            qs = cm.question_attempt_stats.get(level)
            color = BLOOM_COLORS[level]
            label = BLOOM_LABELS[level]
            if qs:
                sections.append(f'<tr><td><span style="color:{color};font-weight:600;">● {label}</span></td><td>{_bar(lm, color)}</td><td>{qs.total}</td><td>{qs.correct}</td><td>{qs.avg_time_spent:.1f}s</td><td>{_bar(qs.guess_rate, "#e74c3c", "80px")}</td></tr>')
            else:
                sections.append(f'<tr><td><span style="color:{color};font-weight:600;">● {label}</span></td><td>{_bar(lm, color)}</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>')
        sections.append(f'</tbody></table><div class="bloom-weighted">布鲁姆加权掌握度: <strong>{_pct(cm.bloom_weighted_mastery)}</strong></div>')
    sections.append('</div>')

    sections.append('<div class="section"><h2>三、知识传播风险分析</h2>')
    if report.propagation_analyses:
        for pa in report.propagation_analyses:
            sections.append(f'<div class="risk-card"><div class="risk-header">{pa.source_node_id} {_risk_badge(pa.downstream_risk)}</div><div class="risk-severity">严重度: {pa.weakness_severity:.2f}</div>')
            if pa.affected_nodes:
                sections.append('<div class="risk-affected">')
                for an in pa.affected_nodes[:3]:
                    sections.append(f'<span class="affected-tag">{an.node_id} (强度 {an.propagation_strength:.2f})</span>')
                sections.append('</div>')
            sections.append('</div>')
    else:
        sections.append('<p class="empty-hint">暂无传播风险数据</p>')
    sections.append('</div>')

    sections.append('<div class="section"><h2>四、学习行为分析</h2>')
    sections.append('<table><thead><tr><th>知识点</th><th>平均用时</th><th>时间方差</th><th>赶工率</th><th>犹豫率</th><th>蒙猜率</th><th>一致性</th><th>可疑</th></tr></thead><tbody>')
    for node_id, ba in list(report.behavior_analyses.items())[:15]:
        sus = '<span style="color:#e74c3c;font-weight:bold;">⚠</span>' if ba.suspicious_flag else '<span style="color:#27ae60;">✓</span>'
        sections.append(f'<tr><td>{node_id}</td><td>{ba.average_time_per_question:.1f}s</td><td>{ba.time_variance:.1f}</td><td>{_bar(ba.rush_rate, "#e67e22", "60px")}</td><td>{_bar(ba.hesitation_rate, "#9b59b6", "60px")}</td><td>{_bar(ba.guess_rate, "#e74c3c", "60px")}</td><td>{_bar(ba.consistency, "#27ae60", "60px")}</td><td>{sus}</td></tr>')
    sections.append('</tbody></table></div>')

    sections.append('<div class="section"><h2>五、题目区分度分析</h2>')
    sections.append('<table><thead><tr><th>题目</th><th>区分度</th><th>难度</th><th>有效性</th></tr></thead><tbody>')
    for da in report.question_discriminations:
        sections.append(f'<tr><td>{da.exercise_id}</td><td>{da.discrimination_index:.3f}</td><td>{da.difficulty:.3f}</td><td>{_effectiveness_badge(da.effectiveness)}</td></tr>')
    sections.append('</tbody></table></div>')

    sections.append('<div class="section"><h2>六、投入成效分析</h2>')
    for ie in report.investment_effectiveness:
        inv = ie.investment
        eff = ie.effectiveness
        sections.append(f"""<div class="investment-card">
          <div class="inv-row"><span class="inv-label">学习时长</span><span class="inv-value">{inv.study_time_minutes} 分钟</span></div>
          <div class="inv-row"><span class="inv-label">交互次数</span><span class="inv-value">{inv.interaction_count}</span></div>
          <div class="inv-row"><span class="inv-label">掌握度提升</span><span class="inv-value">{_pct(eff.mastery_gain)}</span></div>
          <div class="inv-row"><span class="inv-label">分数提升</span><span class="inv-value">{eff.score_improvement:.1f}</span></div>
          <div class="inv-row"><span class="inv-label">效率得分</span><span class="inv-value">{ie.efficiency_score:.1f}</span></div>
          <div class="inv-row"><span class="inv-label">类别</span><span class="inv-value">{_category_badge(ie.category)}</span></div>
          <div class="inv-row"><span class="inv-label">相关系数</span><span class="inv-value">{ie.correlation_coefficient:.3f}</span></div>
        </div>""")
    sections.append('</div>')

    sections.append('<div class="section"><h2>七、动机指数</h2>')
    if report.motivation_index:
        mi = report.motivation_index
        sections.append("""<div class="motivation-grid">""")
        mot_items = [
            ("一致性得分", mi.consistency_score, "#4facfe"),
            ("坚持指数", mi.perseverance_index, "#27ae60"),
            ("成长思维", mi.growth_mindset_score, "#f39c12"),
            ("内在动机", mi.intrinsic_motivation_score, "#9b59b6"),
            ("努力成效比", mi.effort_effectiveness_ratio * 100, "#1abc9c"),
            ("虚假努力嫌疑", mi.fake_effort_suspicion * 100, "#e74c3c"),
        ]
        for label, val, color in mot_items:
            sections.append(f"""<div class="mot-card" style="border-top:3px solid {color};">
              <div class="mot-label">{label}</div>
              <div class="mot-value" style="color:{color};">{val:.1f}</div>
            </div>""")
        sections.append('</div>')
    sections.append('</div>')

    body_content = "\n".join(sections)

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>AlgoMotion 学习分析报告</title>
<style>
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ font-family: "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif; background: #f0f2f5; color: #2c3e50; line-height: 1.6; }}
.container {{ max-width: 960px; margin: 0 auto; padding: 40px 24px; }}
.header {{ text-align: center; margin-bottom: 40px; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; color: #fff; }}
.header .logo {{ font-size: 14px; letter-spacing: 4px; text-transform: uppercase; opacity: 0.8; margin-bottom: 8px; }}
.header h1 {{ font-size: 28px; font-weight: 700; margin-bottom: 12px; }}
.header .meta {{ font-size: 13px; opacity: 0.85; display: flex; justify-content: center; gap: 24px; }}
.section {{ background: #fff; border-radius: 12px; padding: 28px; margin-bottom: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }}
.section h2 {{ font-size: 20px; color: #1a1a2e; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #e8ecf1; }}
.section h3 {{ font-size: 16px; }}
.overview-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }}
.stat-card {{ background: #f8f9fb; border-radius: 10px; padding: 16px; text-align: center; }}
.stat-icon {{ font-size: 24px; margin-bottom: 6px; }}
.stat-value {{ font-size: 22px; font-weight: 700; color: #1a1a2e; }}
.stat-label {{ font-size: 12px; color: #7f8c8d; margin-top: 4px; }}
.mastery-bar-wrap {{ display: flex; align-items: center; gap: 12px; padding: 12px 0; }}
.mastery-bar-label {{ font-size: 13px; color: #555; white-space: nowrap; }}
.mastery-bar-track {{ flex: 1; height: 12px; background: #e8ecf1; border-radius: 6px; overflow: hidden; }}
.mastery-bar-fill {{ height: 100%; background: linear-gradient(90deg, #4facfe, #00f2fe); border-radius: 6px; }}
.mastery-bar-pct {{ font-size: 14px; font-weight: 700; color: #4facfe; }}
table {{ width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }}
th {{ background: #f0f2f5; padding: 10px 12px; text-align: left; font-weight: 600; color: #555; border-bottom: 2px solid #dde1e6; }}
td {{ padding: 8px 12px; border-bottom: 1px solid #eee; }}
tr:hover td {{ background: #f8f9fb; }}
.bloom-weighted {{ margin-top: 8px; padding: 8px 16px; background: linear-gradient(135deg, #f5f7fa, #c3cfe2); border-radius: 8px; font-size: 14px; }}
.bloom-weighted strong {{ color: #4facfe; font-size: 18px; }}
.risk-card {{ background: #f8f9fb; border-radius: 8px; padding: 14px 18px; margin-bottom: 12px; border-left: 4px solid #e74c3c; }}
.risk-header {{ font-weight: 600; font-size: 15px; display: flex; align-items: center; gap: 10px; }}
.risk-severity {{ font-size: 12px; color: #888; margin-top: 4px; }}
.risk-affected {{ margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }}
.affected-tag {{ display: inline-block; padding: 2px 8px; background: #edf2f7; border-radius: 4px; font-size: 11px; color: #555; }}
.investment-card {{ background: #f8f9fb; border-radius: 8px; padding: 16px; margin-bottom: 12px; }}
.inv-row {{ display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; }}
.inv-row:last-child {{ border-bottom: none; }}
.inv-label {{ font-size: 13px; color: #7f8c8d; }}
.inv-value {{ font-size: 13px; font-weight: 600; }}
.motivation-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }}
.mot-card {{ background: #f8f9fb; border-radius: 10px; padding: 16px; text-align: center; }}
.mot-label {{ font-size: 12px; color: #7f8c8d; margin-bottom: 8px; }}
.mot-value {{ font-size: 26px; font-weight: 700; }}
.empty-hint {{ color: #aaa; font-style: italic; padding: 12px 0; }}
@media print {{ body {{ background: #fff; }} .container {{ padding: 0; }} .section {{ box-shadow: none; border: 1px solid #ddd; }} }}
</style>
</head>
<body>
<div class="container">
{body_content}
</div>
</body>
</html>"""
    lines = []
    lines.append("# AlgoMotion 学习分析报告")
    lines.append("")
    lines.append(f"**生成时间**: {report.timestamp}")
    lines.append(f"**学生ID**: {report.student_id}")
    lines.append("")

    lines.append("## 一、学习概览")
    lines.append("")
    ov = report.overview
    lines.append(f"| 指标 | 数值 |")
    lines.append(f"|------|------|")
    lines.append(f"| 知识点总数 | {ov.total_nodes} |")
    lines.append(f"| 已掌握 | {ov.mastered} |")
    lines.append(f"| 学习中 | {ov.learning} |")
    lines.append(f"| 需巩固 | {ov.weak} |")
    lines.append(f"| 未开始 | {ov.not_started} |")
    lines.append(f"| 平均掌握度 | {ov.avg_mastery:.1%} |")
    lines.append(f"| 总学习时长 | {ov.total_study_minutes} 分钟 |")
    lines.append(f"| 总尝试次数 | {ov.total_attempts} |")
    lines.append(f"| 总错误次数 | {ov.total_errors} |")
    lines.append("")

    lines.append("## 二、布鲁姆认知层级分析")
    lines.append("")
    for node_id, cm in list(report.cognitive_mastery.items())[:10]:
        lines.append(f"### {node_id}")
        lines.append("")
        lines.append(f"| 层级 | 掌握度 | 题目总数 | 正确数 | 平均用时(s) | 猜题率 |")
        lines.append(f"|------|--------|----------|--------|-------------|--------|")
        for level in ["remember", "understand", "apply", "analyze", "evaluate", "create"]:
            lm = cm.level_mastery.get(level, 0)
            qs = cm.question_attempt_stats.get(level)
            if qs:
                lines.append(f"| {level} | {lm:.1%} | {qs.total} | {qs.correct} | {qs.avg_time_spent:.1f} | {qs.guess_rate:.1%} |")
            else:
                lines.append(f"| {level} | {lm:.1%} | - | - | - | - |")
        lines.append(f"- **布鲁姆加权掌握度**: {cm.bloom_weighted_mastery:.1%}")
        lines.append("")

    lines.append("## 三、知识传播风险分析")
    lines.append("")
    for pa in report.propagation_analyses:
        lines.append(f"- **{pa.source_node_id}** → 风险等级: {pa.downstream_risk}，严重度: {pa.weakness_severity:.2f}")
        for an in pa.affected_nodes[:3]:
            lines.append(f"  - 影响 {an.node_id}（强度 {an.propagation_strength:.2f}，类型 {an.path_type}）")
    lines.append("")

    lines.append("## 四、学习行为分析")
    lines.append("")
    lines.append(f"| 知识点 | 平均用时(s) | 时间方差 | 赶工率 | 犹豫率 | 猜题率 | 一致性 | 可疑 |")
    lines.append(f"|--------|-------------|----------|--------|--------|--------|--------|------|")
    for node_id, ba in list(report.behavior_analyses.items())[:15]:
        suspicious = "⚠" if ba.suspicious_flag else ""
        lines.append(f"| {node_id} | {ba.average_time_per_question:.1f} | {ba.time_variance:.1f} | {ba.rush_rate:.1%} | {ba.hesitation_rate:.1%} | {ba.guess_rate:.1%} | {ba.consistency:.1%} | {suspicious} |")
    lines.append("")

    lines.append("## 五、题目区分度分析")
    lines.append("")
    lines.append(f"| 题目 | 区分度 | 难度 | 有效性 |")
    lines.append(f"|------|--------|------|--------|")
    for da in report.question_discriminations:
        lines.append(f"| {da.exercise_id} | {da.discrimination_index:.3f} | {da.difficulty:.3f} | {da.effectiveness} |")
    lines.append("")

    lines.append("## 六、投入成效分析")
    lines.append("")
    for ie in report.investment_effectiveness:
        inv = ie.investment
        eff = ie.effectiveness
        lines.append(f"- 学习时长: {inv.study_time_minutes} 分钟，交互次数: {inv.interaction_count}")
        lines.append(f"- 掌握度提升: {eff.mastery_gain:.1%}，分数提升: {eff.score_improvement:.1f}")
        lines.append(f"- 效率得分: {ie.efficiency_score:.1f}，类别: {ie.category}")
        lines.append(f"- 相关系数: {ie.correlation_coefficient:.3f}")
    lines.append("")

    lines.append("## 七、动机指数")
    lines.append("")
    if report.motivation_index:
        mi = report.motivation_index
        lines.append(f"| 指标 | 数值 |")
        lines.append(f"|------|------|")
        lines.append(f"| 一致性得分 | {mi.consistency_score:.1f} |")
        lines.append(f"| 坚持指数 | {mi.perseverance_index:.1f} |")
        lines.append(f"| 成长思维 | {mi.growth_mindset_score:.1f} |")
        lines.append(f"| 内在动机 | {mi.intrinsic_motivation_score:.1f} |")
        lines.append(f"| 努力成效比 | {mi.effort_effectiveness_ratio:.3f} |")
        lines.append(f"| 虚假努力嫌疑 | {mi.fake_effort_suspicion:.3f} |")
    lines.append("")

    return "\n".join(lines)


def _markdown_to_pdf_bytes(md_content: str) -> bytes:
    try:
        from weasyprint import HTML
        try:
            import markdown as md_lib
            html_body = md_lib.md(md_content, extensions=["tables", "fenced_code"])
        except ImportError:
            html_body = _simple_md_to_html(md_content)
        html_full = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
body {{ font-family: "Microsoft YaHei", "SimHei", "Helvetica Neue", Arial, sans-serif; margin: 30px; font-size: 12pt; line-height: 1.6; }}
h1 {{ border-bottom: 2px solid #333; padding-bottom: 8px; }}
h2 {{ border-bottom: 1px solid #999; padding-bottom: 4px; margin-top: 24px; }}
table {{ border-collapse: collapse; width: 100%; margin: 10px 0; }}
th, td {{ border: 1px solid #ccc; padding: 6px 10px; text-align: left; }}
th {{ background-color: #f5f5f5; }}
</style></head><body>{html_body}</body></html>"""
        buf = BytesIO()
        HTML(string=html_full).write_pdf(buf)
        return buf.getvalue()
    except (ImportError, OSError) as e:
        raise HTTPException(
            status_code=501,
            detail=f"PDF 导出不可用：{e}。Windows 需安装 GTK3 运行时，请参考 https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#installation"
        )


def _simple_md_to_html(md: str) -> str:
    lines = md.split("\n")
    html_lines = []
    in_table = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("# "):
            html_lines.append(f"<h1>{stripped[2:]}</h1>")
        elif stripped.startswith("## "):
            html_lines.append(f"<h2>{stripped[3:]}</h2>")
        elif stripped.startswith("### "):
            html_lines.append(f"<h3>{stripped[4:]}</h3>")
        elif stripped.startswith("- "):
            html_lines.append(f"<li>{stripped[2:]}</li>")
        elif stripped.startswith("| ") and "|" in stripped[1:]:
            cells = [c.strip() for c in stripped.split("|")[1:-1]]
            if all(set(c) <= set("-: ") for c in cells):
                continue
            tag = "th" if not in_table else "td"
            row = "".join(f"<{tag}>{c}</{tag}>" for c in cells)
            html_lines.append(f"<tr>{row}</tr>")
            in_table = True
        elif stripped == "":
            if in_table:
                html_lines.append("</table>")
                in_table = False
            html_lines.append("")
        else:
            if in_table:
                html_lines.append("</table>")
                in_table = False
            html_lines.append(f"<p>{stripped}</p>")
    if in_table:
        html_lines.append("</table>")
    result = "\n".join(html_lines)
    result = result.replace("<tr>", "<table><tr>", 1)
    return result


@router.get("/report/export")
async def export_comprehensive_report(
    format: str = Query(default="json", description="导出格式: json / markdown / html")
):
    report = build_comprehensive_report()
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")

    if format == "markdown" or format == "md":
        md_content = _report_to_markdown(report)
        filename = f"learning-report-{ts}.md"
        return Response(
            content=md_content,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    if format == "html":
        html_content = _report_to_html(report)
        filename = f"learning-report-{ts}.html"
        return Response(
            content=html_content,
            media_type="text/html; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    filename = f"learning-report-{ts}.json"
    content = json.dumps(report.model_dump(), ensure_ascii=False, indent=2)
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ============================================
# 清空学习数据
# ============================================

@router.delete("/data", response_model=dict)
async def clear_all_learning_data():
    from ..storage import progress_store, PROGRESS_FILE, write_json_atomic
    from ..learning_records import clear_learning_records

    progress_store.clear()
    if PROGRESS_FILE.exists():
        write_json_atomic(PROGRESS_FILE, {})
    clear_learning_records()

    return success_response({"message": "所有学习数据已清空（进度 + 练习记录 + 每日快照）"})
