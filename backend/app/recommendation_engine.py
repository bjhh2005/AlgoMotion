"""
AlgoMotion V2 智能学习路径推荐引擎

基于多因子打分 + 贝叶斯认知建模 + 自适应策略的推荐系统。
设计文档参见项目文档。
"""
import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


# ============================================
# 常量与配置
# ============================================

BLOOM_LEVELS = ["remember", "understand", "apply", "analyze", "evaluate", "create"]

BLOOM_WEIGHTS = {
    "remember": 0.6, "understand": 0.8, "apply": 1.0,
    "analyze": 1.2, "evaluate": 1.5, "create": 2.0,
}

EDGE_PROPAGATION_WEIGHTS = {
    "prerequisite": 1.0, "contains": 0.8, "used_in": 0.6,
    "related": 0.2, "error_caused_by": 0.9,
}

BETA_PRIOR_ALPHA = 2.0
BETA_PRIOR_BETA = 2.0
TIME_DECAY_LAMBDA = 0.1
VARIANCE_MAX = 0.08
PREREQ_THRESHOLD_HARD = 0.4
PREREQ_THRESHOLD_SOFT = 0.6
PREREQ_DISCOUNT = 0.8
PAGERANK_DAMPING = 0.85
PAGERANK_ITERATIONS = 30
CENTRALITY_LAMBDA1 = 0.6
CENTRALITY_LAMBDA2 = 0.4
ROOT_NODE_ID = "data-structure"


class RecommendationCategory(str, Enum):
    EXPLORE = "explore"
    REVIEW = "review"
    FOCUS = "focus"
    CROSS = "cross"


CATEGORY_LABELS = {
    RecommendationCategory.EXPLORE: "探索性推荐",
    RecommendationCategory.REVIEW: "复习性推荐",
    RecommendationCategory.FOCUS: "重点性推荐",
    RecommendationCategory.CROSS: "交叉性推荐",
}

CATEGORY_ICONS = {
    RecommendationCategory.EXPLORE: "🧭",
    RecommendationCategory.REVIEW: "🔄",
    RecommendationCategory.FOCUS: "🎯",
    RecommendationCategory.CROSS: "🔗",
}

CATEGORY_DESCRIPTIONS = {
    RecommendationCategory.EXPLORE: "探索新知识，拓展学习版图",
    RecommendationCategory.REVIEW: "温故知新，巩固已有基础",
    RecommendationCategory.FOCUS: "攻克重难点，消除传播风险",
    RecommendationCategory.CROSS: "跨领域应用，连接前置与下游",
}


class StrategyType(str, Enum):
    BALANCED = "balanced"
    CONSOLIDATION = "consolidation"
    SLOW_DOWN = "slow_down"
    ENCOURAGE = "encourage"


STRATEGY_WEIGHTS = {
    StrategyType.BALANCED: {
        "gap": 0.30, "uncertainty": 0.15, "risk": 0.20,
        "centrality": 0.20, "efficiency": 0.15,
    },
    StrategyType.CONSOLIDATION: {
        "gap": 0.35, "uncertainty": 0.10, "risk": 0.15,
        "centrality": 0.05, "efficiency": 0.25,
    },
    StrategyType.SLOW_DOWN: {
        "gap": 0.15, "uncertainty": 0.30, "risk": 0.25,
        "centrality": 0.10, "efficiency": 0.20,
    },
    StrategyType.ENCOURAGE: {
        "gap": 0.10, "uncertainty": 0.10, "risk": 0.10,
        "centrality": 0.40, "efficiency": 0.30,
    },
}


class KnowledgeState(str, Enum):
    TRULY_MASTERED = "truly_mastered"
    FRAGILE = "fragile"
    DEVELOPING = "developing"
    WEAK = "weak"


# ============================================
# 数据结构
# ============================================

@dataclass
class BetaBelief:
    alpha: float = BETA_PRIOR_ALPHA
    beta: float = BETA_PRIOR_BETA

    @property
    def expected(self) -> float:
        total = self.alpha + self.beta
        if total <= 0:
            return 0.5
        return self.alpha / total

    @property
    def variance(self) -> float:
        total = self.alpha + self.beta
        if total <= 1:
            return 0.0
        return (self.alpha * self.beta) / (total * total * (total + 1))


@dataclass
class NodeCognitiveState:
    bloom_beliefs: dict[str, BetaBelief] = field(default_factory=dict)

    def get_belief(self, level: str) -> BetaBelief:
        if level not in self.bloom_beliefs:
            self.bloom_beliefs[level] = BetaBelief()
        return self.bloom_beliefs[level]

    @property
    def apply_expected(self) -> float:
        return self.get_belief("apply").expected

    @property
    def apply_variance(self) -> float:
        return self.get_belief("apply").variance

    @property
    def understand_expected(self) -> float:
        return self.get_belief("understand").expected

    def classify(self) -> KnowledgeState:
        apply_e = self.apply_expected
        analyze_e = self.get_belief("analyze").expected
        understand_e = self.get_belief("understand").expected
        if apply_e >= 0.85 and analyze_e >= 0.7:
            return KnowledgeState.TRULY_MASTERED
        if understand_e >= 0.8 and apply_e < 0.5:
            return KnowledgeState.FRAGILE
        if apply_e >= 0.4:
            return KnowledgeState.DEVELOPING
        return KnowledgeState.WEAK


@dataclass
class FactorValues:
    gap: float = 0.0
    uncertainty: float = 0.0
    risk: float = 0.0
    centrality: float = 0.0
    efficiency: float = 0.0


@dataclass
class RecommendationResult:
    rank: int
    node_id: str
    node_name: str
    score: float
    factors: FactorValues
    reason: str
    action: str = "practice"
    knowledge_state: str = ""
    category: str = "explore"


# ============================================
# 图谱结构指标
# ============================================

def compute_pagerank(
    nodes: list[dict], edges: list[dict], damping: float = PAGERANK_DAMPING,
) -> dict[str, float]:
    node_ids = [n["id"] for n in nodes]
    n = len(node_ids)
    if n == 0:
        return {}
    idx = {nid: i for i, nid in enumerate(node_ids)}
    out_degree = [0] * n
    in_links: list[list[int]] = [[] for _ in range(n)]
    for e in edges:
        s, t = e.get("source"), e.get("target")
        if s in idx and t in idx:
            si, ti = idx[s], idx[t]
            out_degree[si] += 1
            in_links[ti].append(si)
    pr = [1.0 / n] * n
    for _ in range(PAGERANK_ITERATIONS):
        new_pr = [(1 - damping) / n] * n
        for i in range(n):
            for j in in_links[i]:
                if out_degree[j] > 0:
                    new_pr[i] += damping * pr[j] / out_degree[j]
        pr = new_pr
    return {node_ids[i]: pr[i] for i in range(n)}


def compute_betweenness(nodes: list[dict], edges: list[dict]) -> dict[str, float]:
    node_ids = [n["id"] for n in nodes]
    bc = {nid: 0.0 for nid in node_ids}
    adj: dict[str, list[str]] = {nid: [] for nid in node_ids}
    for e in edges:
        s, t = e.get("source"), e.get("target")
        if s in adj and t in adj:
            adj[s].append(t)
    n = len(node_ids)
    if n <= 2:
        return bc
    sample = node_ids if n <= 50 else node_ids[:50]
    for s_idx, s in enumerate(sample):
        stack = []
        pred: dict[str, list[str]] = {nid: [] for nid in node_ids}
        sigma = {nid: 0.0 for nid in node_ids}
        sigma[s] = 1.0
        dist = {nid: -1 for nid in node_ids}
        dist[s] = 0
        queue = [s]
        qi = 0
        while qi < len(queue):
            v = queue[qi]
            qi += 1
            stack.append(v)
            for w in adj[v]:
                if dist[w] < 0:
                    dist[w] = dist[v] + 1
                    queue.append(w)
                if dist[w] == dist[v] + 1:
                    sigma[w] += sigma[v]
                    pred[w].append(v)
        delta = {nid: 0.0 for nid in node_ids}
        while stack:
            w = stack.pop()
            for v in pred[w]:
                if sigma[w] > 0:
                    delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w])
            if w != s:
                bc[w] += delta[w]
    if n > 50:
        scale = n * (n - 1) / (50 * 49)
        for nid in bc:
            bc[nid] *= scale
    return bc


def compute_centrality(
    nodes: list[dict], edges: list[dict],
) -> dict[str, float]:
    pr = compute_pagerank(nodes, edges)
    bc = compute_betweenness(nodes, edges)
    if not pr:
        return {n["id"]: 0.0 for n in nodes}
    pr_max = max(pr.values()) or 1.0
    bc_max = max(bc.values()) or 1.0
    result = {}
    for nid in pr:
        pr_n = pr[nid] / pr_max
        bc_n = bc.get(nid, 0.0) / bc_max
        result[nid] = CENTRALITY_LAMBDA1 * pr_n + CENTRALITY_LAMBDA2 * bc_n
    return result


# ============================================
# 传播风险
# ============================================

def compute_propagation_risk(
    nodes: list[dict],
    edges: list[dict],
    cognitive_states: dict[str, NodeCognitiveState],
) -> dict[str, float]:
    node_ids = {n["id"] for n in nodes}
    downstream: dict[str, list[tuple[str, float]]] = {nid: [] for nid in node_ids}
    for e in edges:
        s, t = e.get("source"), e.get("target")
        if s in node_ids and t in node_ids:
            w = EDGE_PROPAGATION_WEIGHTS.get(e.get("type", ""), 0.1)
            downstream[s].append((t, w))
    risk: dict[str, float] = {}
    for nid in node_ids:
        total_risk = 0.0
        visited = {nid}
        queue = [(nid, 1.0)]
        qi = 0
        while qi < len(queue):
            current, path_w = queue[qi]
            qi += 1
            for next_nid, edge_w in downstream.get(current, []):
                if next_nid in visited:
                    continue
                visited.add(next_nid)
                combined_w = path_w * edge_w
                cs = cognitive_states.get(next_nid)
                if cs:
                    total_risk += combined_w * (1 - cs.apply_expected)
                if combined_w > 0.05:
                    queue.append((next_nid, combined_w))
        risk[nid] = total_risk
    return risk


# ============================================
# 认知状态构建
# ============================================

def build_cognitive_states(
    progress: dict[str, dict],
    cognitive_mastery: dict[str, Any] | None = None,
) -> dict[str, NodeCognitiveState]:
    states: dict[str, NodeCognitiveState] = {}
    for node_id, record in progress.items():
        metrics = record.get("metrics", {})
        mastery = metrics.get("mastery", 0.0)
        correct_rate = metrics.get("correctRate", 0.0)
        attempt_count = metrics.get("attemptCount", 0)
        cs = NodeCognitiveState()
        if cognitive_mastery and node_id in cognitive_mastery:
            cm = cognitive_mastery[node_id]
            level_mastery = cm.get("level_mastery", {})
            for level in BLOOM_LEVELS:
                lm = level_mastery.get(level, 0.0)
                alpha = BETA_PRIOR_ALPHA + max(0.1, lm) * 10
                beta = BETA_PRIOR_BETA + (1 - lm) * 10
                cs.bloom_beliefs[level] = BetaBelief(alpha=alpha, beta=beta)
        else:
            if attempt_count > 0:
                successes = int(correct_rate * attempt_count)
                failures = attempt_count - successes
                alpha = BETA_PRIOR_ALPHA + successes * 0.5
                beta = BETA_PRIOR_BETA + failures * 0.5
            else:
                alpha = BETA_PRIOR_ALPHA
                beta = BETA_PRIOR_BETA
            for level in BLOOM_LEVELS:
                w = BLOOM_WEIGHTS.get(level, 1.0)
                level_m = min(1.0, mastery * w / BLOOM_WEIGHTS["apply"]) if BLOOM_WEIGHTS["apply"] > 0 else mastery
                level_m = max(0.0, min(1.0, level_m))
                la = BETA_PRIOR_ALPHA + max(0.1, level_m) * 8
                lb = BETA_PRIOR_BETA + (1 - level_m) * 8
                cs.bloom_beliefs[level] = BetaBelief(alpha=la, beta=lb)
        states[node_id] = cs
    return states


def ensure_all_nodes_have_states(
    nodes: list[dict], states: dict[str, NodeCognitiveState]
) -> dict[str, NodeCognitiveState]:
    for n in nodes:
        nid = n["id"]
        if nid not in states:
            states[nid] = NodeCognitiveState()
    return states


# ============================================
# 策略判定
# ============================================

@dataclass
class StudentProfile:
    rush_rate: float = 0.0
    hesitation_rate: float = 0.0
    correct_rate: float = 0.0
    fake_effort_suspicion: float = 0.0
    consistency: float = 1.0


def build_student_profile(
    behavior_analyses: dict[str, Any] | None = None,
    motivation_index: dict[str, Any] | None = None,
    progress: dict[str, dict] | None = None,
) -> StudentProfile:
    profile = StudentProfile()
    if behavior_analyses:
        rush_vals = []
        hes_vals = []
        cr_vals = []
        cons_vals = []
        for ba in behavior_analyses.values():
            if isinstance(ba, dict):
                rush_vals.append(ba.get("rush_rate", 0.0))
                hes_vals.append(ba.get("hesitation_rate", 0.0))
                cons_vals.append(ba.get("consistency", 1.0))
            else:
                rush_vals.append(getattr(ba, "rush_rate", 0.0))
                hes_vals.append(getattr(ba, "hesitation_rate", 0.0))
                cons_vals.append(getattr(ba, "consistency", 1.0))
        if rush_vals:
            profile.rush_rate = sum(rush_vals) / len(rush_vals)
        if hes_vals:
            profile.hesitation_rate = sum(hes_vals) / len(hes_vals)
        if cons_vals:
            profile.consistency = sum(cons_vals) / len(cons_vals)
    if progress:
        total_cr = 0.0
        count = 0
        for record in progress.values():
            cr = record.get("metrics", {}).get("correctRate", 0.0)
            if cr > 0:
                total_cr += cr
                count += 1
        if count > 0:
            profile.correct_rate = total_cr / count
    if motivation_index:
        mi = motivation_index
        if isinstance(mi, dict):
            profile.fake_effort_suspicion = mi.get("fake_effort_suspicion", 0.0)
        else:
            profile.fake_effort_suspicion = getattr(mi, "fake_effort_suspicion", 0.0)
    return profile


def classify_recommendation(
    node_id: str,
    ks: KnowledgeState,
    factors: FactorValues,
    edges: list[dict],
    cognitive_states: dict[str, NodeCognitiveState],
) -> RecommendationCategory:
    if ks in (KnowledgeState.WEAK, KnowledgeState.FRAGILE) and factors.risk > 0.4:
        return RecommendationCategory.FOCUS
    if ks in (KnowledgeState.WEAK, KnowledgeState.FRAGILE):
        return RecommendationCategory.REVIEW
    has_prereq_met = any(
        e.get("target") == node_id and e.get("type") == "prerequisite"
        and cognitive_states.get(e.get("source", ""), NodeCognitiveState()).understand_expected >= 0.6
        for e in edges
    )
    has_prereq = any(
        e.get("target") == node_id and e.get("type") == "prerequisite"
        for e in edges
    )
    used_in_count = sum(
        1 for e in edges
        if e.get("source") == node_id and e.get("type") in ("used_in", "related")
    )
    if has_prereq and has_prereq_met and used_in_count > 0:
        return RecommendationCategory.CROSS
    if ks == KnowledgeState.DEVELOPING and factors.gap > 0.3:
        return RecommendationCategory.EXPLORE
    if used_in_count > 1:
        return RecommendationCategory.CROSS
    return RecommendationCategory.EXPLORE


def determine_strategy(profile: StudentProfile, override: str | None = None) -> StrategyType:
    if override and override in [s.value for s in StrategyType]:
        return StrategyType(override)
    if profile.fake_effort_suspicion > 0.7:
        return StrategyType.CONSOLIDATION
    if profile.rush_rate > 0.7 and profile.correct_rate < 0.5:
        return StrategyType.SLOW_DOWN
    if profile.hesitation_rate > 0.6:
        return StrategyType.ENCOURAGE
    return StrategyType.BALANCED


def get_strategy_reason(strategy: StrategyType, profile: StudentProfile) -> str:
    reasons = {
        StrategyType.CONSOLIDATION: "检测到虚假努力风险，建议巩固已有知识基础",
        StrategyType.SLOW_DOWN: "答题节奏偏快且正确率较低，建议放慢速度巩固基础",
        StrategyType.ENCOURAGE: "学习节奏偏谨慎，推荐核心枢纽节点以建立信心",
        StrategyType.BALANCED: "基于当前学习状态的综合推荐",
    }
    return reasons.get(strategy, reasons[StrategyType.BALANCED])


# ============================================
# 多因子打分
# ============================================

def compute_factors(
    node_id: str,
    cs: NodeCognitiveState,
    propagation_risk: dict[str, float],
    centrality: dict[str, float],
    efficiency_scores: dict[str, float],
    max_risk: float,
) -> FactorValues:
    f_gap = 1.0 - cs.apply_expected
    raw_var = cs.apply_variance
    f_uncertainty = min(1.0, raw_var / VARIANCE_MAX) if VARIANCE_MAX > 0 else 0.0
    f_risk = min(1.0, propagation_risk.get(node_id, 0.0) / max_risk) if max_risk > 0 else 0.0
    f_centrality = centrality.get(node_id, 0.0)
    f_efficiency = efficiency_scores.get(node_id, 0.5)
    return FactorValues(
        gap=f_gap, uncertainty=f_uncertainty, risk=f_risk,
        centrality=f_centrality, efficiency=f_efficiency,
    )


def compute_score(factors: FactorValues, weights: dict[str, float]) -> float:
    return (
        weights.get("gap", 0.0) * factors.gap
        + weights.get("uncertainty", 0.0) * factors.uncertainty
        + weights.get("risk", 0.0) * factors.risk
        + weights.get("centrality", 0.0) * factors.centrality
        + weights.get("efficiency", 0.0) * factors.efficiency
    )


# ============================================
# 前置约束
# ============================================

def compute_prereq_score(
    node_id: str, edges: list[dict], cognitive_states: dict[str, NodeCognitiveState],
) -> float:
    prereqs = [
        e["source"] for e in edges
        if e.get("target") == node_id and e.get("type") == "prerequisite"
    ]
    if not prereqs:
        return 1.0
    min_score = 1.0
    for p in prereqs:
        cs = cognitive_states.get(p)
        score = cs.understand_expected if cs else 0.0
        min_score = min(min_score, score)
    return min_score


def find_prereq_to_learn(
    node_id: str, edges: list[dict], cognitive_states: dict[str, NodeCognitiveState],
) -> str | None:
    prereqs = [
        e["source"] for e in edges
        if e.get("target") == node_id and e.get("type") == "prerequisite"
    ]
    if not prereqs:
        return None
    worst = None
    worst_score = 1.0
    for p in prereqs:
        cs = cognitive_states.get(p)
        score = cs.understand_expected if cs else 0.0
        if score < worst_score:
            worst_score = score
            worst = p
    return worst


# ============================================
# 推荐理由生成
# ============================================

def generate_reason(
    node_name: str, factors: FactorValues, strategy: StrategyType,
) -> str:
    if strategy == StrategyType.CONSOLIDATION:
        if factors.gap > 0.7:
            return f"「{node_name}」是基础薄弱点，建议先巩固"
        if factors.efficiency > 0.6:
            return f"历史上您在「{node_name}」上学习效率较高，建议重新回顾"
        return f"「{node_name}」需要巩固基础"
    if strategy == StrategyType.SLOW_DOWN:
        if factors.uncertainty > 0.25:
            return f"对「{node_name}」的掌握程度尚不确定，建议针对性练习确认"
        if factors.risk > 0.5:
            return f"「{node_name}」的薄弱会影响后续多个知识点，建议优先解决"
        return f"建议先确认对「{node_name}」的掌握情况"
    if strategy == StrategyType.ENCOURAGE:
        if factors.centrality > 0.5:
            return f"「{node_name}」是知识体系中的核心枢纽，掌握后将打通多条学习路径"
        if factors.efficiency > 0.5:
            return f"您在学习「{node_name}」时效率较高，是适合您的学习方向"
        return f"「{node_name}」是适合您当前状态的学习内容"
    if factors.gap > 0.5:
        return f"「{node_name}」的掌握度有待提升"
    if factors.risk > 0.4:
        return f"建议优先学习「{node_name}」，它对后续知识学习很重要"
    return f"基于当前学习进度，推荐学习「{node_name}」"


# ============================================
# 主推荐函数
# ============================================

def recommend(
    nodes: list[dict],
    edges: list[dict],
    progress: dict[str, dict],
    cognitive_mastery: dict[str, Any] | None = None,
    behavior_analyses: dict[str, Any] | None = None,
    motivation_index: dict[str, Any] | None = None,
    investment_effectiveness: list[Any] | None = None,
    propagation_analyses: list[Any] | None = None,
    current_node_id: str | None = None,
    count: int = 5,
    strategy_override: str | None = None,
) -> dict:
    node_by_id = {n["id"]: n for n in nodes}
    cognitive_states = build_cognitive_states(progress, cognitive_mastery)
    cognitive_states = ensure_all_nodes_have_states(nodes, cognitive_states)

    profile = build_student_profile(behavior_analyses, motivation_index, progress)
    strategy = determine_strategy(profile, strategy_override)
    strategy_reason = get_strategy_reason(strategy, profile)
    weights = STRATEGY_WEIGHTS[strategy]

    centrality = compute_centrality(nodes, edges)
    prop_risk = compute_propagation_risk(nodes, edges, cognitive_states)
    max_risk = max(prop_risk.values()) if prop_risk else 1.0

    efficiency_scores: dict[str, float] = {}
    if investment_effectiveness:
        for ie in investment_effectiveness:
            if isinstance(ie, dict):
                nid = ie.get("node_id", "")
                eff = ie.get("efficiency_score", 0.5)
            else:
                nid = getattr(ie, "node_id", "")
                eff = getattr(ie, "efficiency_score", 0.5)
            if nid:
                efficiency_scores[nid] = eff
    if propagation_analyses:
        for pa in propagation_analyses:
            if isinstance(pa, dict):
                src = pa.get("source_node_id", "")
                sev = pa.get("weakness_severity", 0.0)
            else:
                src = getattr(pa, "source_node_id", "")
                sev = getattr(pa, "weakness_severity", 0.0)
            if src and src not in efficiency_scores:
                efficiency_scores[src] = max(0.0, 1.0 - sev)

    candidates: list[dict] = []
    for n in nodes:
        nid = n["id"]
        cs = cognitive_states.get(nid, NodeCognitiveState())
        ks = cs.classify()
        if ks == KnowledgeState.TRULY_MASTERED and cs.apply_variance < 0.05:
            continue
        if strategy == StrategyType.CONSOLIDATION and cs.apply_expected < 0.2:
            continue
        prereq_score = compute_prereq_score(nid, edges, cognitive_states)
        if prereq_score < PREREQ_THRESHOLD_HARD:
            prereq_id = find_prereq_to_learn(nid, edges, cognitive_states)
            if prereq_id and prereq_id not in {c["node_id"] for c in candidates}:
                prereq_node = node_by_id.get(prereq_id)
                if prereq_node:
                    prereq_cs = cognitive_states.get(prereq_id, NodeCognitiveState())
                    prereq_factors = compute_factors(
                        prereq_id, prereq_cs, prop_risk, centrality,
                        efficiency_scores, max_risk,
                    )
                    prereq_score_val = compute_score(prereq_factors, weights)
                    candidates.append({
                        "node_id": prereq_id,
                        "node_name": prereq_node.get("name", prereq_id),
                        "score": prereq_score_val,
                        "factors": prereq_factors,
                        "knowledge_state": prereq_cs.classify().value,
                        "discount": 1.0,
                    })
            continue
        discount = 1.0
        if prereq_score < PREREQ_THRESHOLD_SOFT:
            discount = PREREQ_DISCOUNT
        factors = compute_factors(nid, cs, prop_risk, centrality, efficiency_scores, max_risk)
        score = compute_score(factors, weights) * discount
        candidates.append({
            "node_id": nid,
            "node_name": n.get("name", nid),
            "score": score,
            "factors": factors,
            "knowledge_state": ks.value,
            "discount": discount,
        })

    if current_node_id and current_node_id in node_by_id:
        current_nid = current_node_id
        for e in edges:
            if e.get("source") == current_nid:
                target = e.get("target")
                if target and target in node_by_id:
                    existing = {c["node_id"] for c in candidates}
                    if target not in existing:
                        cs = cognitive_states.get(target, NodeCognitiveState())
                        if cs.classify() != KnowledgeState.TRULY_MASTERED:
                            factors = compute_factors(
                                target, cs, prop_risk, centrality,
                                efficiency_scores, max_risk,
                            )
                            score = compute_score(factors, weights)
                            candidates.append({
                                "node_id": target,
                                "node_name": node_by_id[target].get("name", target),
                                "score": score,
                                "factors": factors,
                                "knowledge_state": cs.classify().value,
                                "discount": 1.0,
                            })

    candidates.sort(key=lambda c: c["score"], reverse=True)

    root_children = {e.get("target") for e in edges if e.get("source") == ROOT_NODE_ID and e.get("type") == "contains"}
    root_in_candidates = next((c for c in candidates if c["node_id"] == ROOT_NODE_ID), None)
    root_cs = cognitive_states.get(ROOT_NODE_ID, NodeCognitiveState())
    root_ks = root_cs.classify()

    if root_in_candidates and root_ks in (KnowledgeState.DEVELOPING, KnowledgeState.TRULY_MASTERED):
        children_not_mastered = [
            c for c in candidates if c["node_id"] in root_children
            and c["knowledge_state"] not in (KnowledgeState.TRULY_MASTERED.value,)
        ]
        if children_not_mastered:
            candidates = [c for c in candidates if c["node_id"] != ROOT_NODE_ID]

    top = candidates[:count]

    results = []
    for i, c in enumerate(top):
        reason = generate_reason(c["node_name"], c["factors"], strategy)
        ks_val = c["knowledge_state"]
        ks_enum = KnowledgeState(ks_val) if ks_val in [e.value for e in KnowledgeState] else KnowledgeState.DEVELOPING
        cat = classify_recommendation(c["node_id"], ks_enum, c["factors"], edges, cognitive_states)
        results.append(RecommendationResult(
            rank=i + 1,
            node_id=c["node_id"],
            node_name=c["node_name"],
            score=round(c["score"], 4),
            factors=FactorValues(
                gap=round(c["factors"].gap, 4),
                uncertainty=round(c["factors"].uncertainty, 4),
                risk=round(c["factors"].risk, 4),
                centrality=round(c["factors"].centrality, 4),
                efficiency=round(c["factors"].efficiency, 4),
            ),
            reason=reason,
            action="practice",
            knowledge_state=ks_val,
            category=cat.value,
        ))

    grouped: dict[str, list[dict]] = {}
    for r in results:
        grouped.setdefault(r.category, []).append({
            "rank": r.rank,
            "node_id": r.node_id,
            "node_name": r.node_name,
            "score": r.score,
            "factor_breakdown": {
                "gap": r.factors.gap,
                "uncertainty": r.factors.uncertainty,
                "risk": r.factors.risk,
                "centrality": r.factors.centrality,
                "efficiency": r.factors.efficiency,
            },
            "reason": r.reason,
            "action": r.action,
            "knowledge_state": r.knowledge_state,
            "category": r.category,
        })

    category_groups = []
    for cat_enum in RecommendationCategory:
        items = grouped.get(cat_enum.value, [])
        category_groups.append({
            "category": cat_enum.value,
            "label": CATEGORY_LABELS[cat_enum],
            "icon": CATEGORY_ICONS[cat_enum],
            "description": CATEGORY_DESCRIPTIONS[cat_enum],
            "items": items,
        })

    return {
        "strategy": strategy.value,
        "strategy_reason": strategy_reason,
        "weights": {k: round(v, 2) for k, v in weights.items()},
        "student_profile": {
            "rush_rate": round(profile.rush_rate, 3),
            "hesitation_rate": round(profile.hesitation_rate, 3),
            "correct_rate": round(profile.correct_rate, 3),
            "fake_effort_suspicion": round(profile.fake_effort_suspicion, 3),
            "consistency": round(profile.consistency, 3),
        },
        "summary": {
            "total_candidates": len(candidates),
            "total_recommended": len(top),
            "category_counts": {g["category"]: len(g["items"]) for g in category_groups},
        },
        "recommendations": [item for items in grouped.values() for item in items],
        "category_groups": category_groups,
    }
