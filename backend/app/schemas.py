"""
数据模型模块
定义所有 API 请求/响应的数据结构
"""
from datetime import datetime
from typing import Literal, Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ============================================
# 基础类型定义
# ============================================

ProgressStatus = Literal["not_started", "learning", "mastered", "weak"]
CognitiveLevel = Literal["remember", "understand", "apply", "analyze", "evaluate", "create"]
EdgeRelation = Literal["prerequisite", "used_in", "related", "extends", "contains"]
EngagementCategory = Literal["efficient", "inefficient", "diving", "dormant"]
EngagementDepth = Literal["surface", "moderate", "deep"]
AnswerBehavior = Literal["normal", "rushed", "hesitant", "guess", "cheat"]
DiscriminationEffectiveness = Literal["excellent", "good", "acceptable", "poor"]
RiskLevel = Literal["low", "medium", "high", "critical"]
ForumContributionLevel = Literal["simple_statement", "information_seeking", "knowledge_construction"]


# ============================================
# 知识点相关模型
# ============================================

class KnowledgeNode(BaseModel):
    """知识点"""
    id: str
    name: str
    category: str = ""
    difficulty: int = Field(ge=1, le=10, default=5)
    estimated_minutes: int | None = Field(default=None, ge=1, le=300)
    tags: list[str] = Field(default_factory=list)
    content: str | None = None

    @field_validator("id")
    @classmethod
    def validate_id(cls, v: str) -> str:
        if not v or len(v) > 100:
            raise ValueError("Invalid node ID")
        return v

    class Config:
        populate_by_name = True


class KnowledgeEdge(BaseModel):
    """知识边"""
    id: str | None = None
    source: str
    target: str
    relation: EdgeRelation = "prerequisite"
    weight: float = Field(default=0.5, ge=0, le=1)
    label: str | None = None


# ============================================
# 学习进度相关模型
# ============================================

class LearningMetrics(BaseModel):
    """学习指标"""
    mastery: float = Field(default=0, ge=0, le=1)
    confidence: float = Field(default=0, ge=0, le=1)
    studyMinutes: int = Field(default=0, ge=0)
    attemptCount: int = Field(default=0, ge=0)
    correctRate: float = Field(default=0, ge=0, le=1)
    errorCount: int = Field(default=0, ge=0)
    streakDays: int = Field(default=0, ge=0)
    lastActivityAt: str | None = None
    reviewDueAt: str | None = None


class ProgressRecord(BaseModel):
    """学习进度记录"""
    status: ProgressStatus = "not_started"
    score: int = Field(default=0, ge=0, le=100)
    metrics: LearningMetrics = Field(default_factory=LearningMetrics)
    last_studied_at: str | None = None
    review_due_at: str | None = None

    class Config:
        populate_by_name = True


class ProgressUpdate(BaseModel):
    """进度更新请求"""
    nodeId: str = Field(..., min_length=1, max_length=100, alias="node_id")
    status: ProgressStatus
    score: int = Field(default=0, ge=0, le=100)
    metrics: LearningMetrics = Field(default_factory=LearningMetrics)

    model_config = ConfigDict(populate_by_name=True)


# ============================================
# 维度一：知识关联结构 - 认知分析
# ============================================

class QuestionAttemptStats(BaseModel):
    """题目作答统计"""
    total: int = 0
    correct: int = 0
    avg_time_spent: float = 0.0
    guess_rate: float = 0.0


class CognitiveMastery(BaseModel):
    """认知掌握度"""
    node_id: str
    level_mastery: dict[CognitiveLevel, float] = Field(default_factory=dict)
    question_attempt_stats: dict[CognitiveLevel, QuestionAttemptStats] = Field(default_factory=dict)
    bloom_weighted_mastery: float = 0.0


class PropagationNode(BaseModel):
    """传播影响节点"""
    node_id: str
    propagation_strength: float = 0.0
    path_type: EdgeRelation = "related"
    root_cause: bool = False


class PropagationAnalysis(BaseModel):
    """知识传播分析"""
    source_node_id: str
    affected_nodes: list[PropagationNode] = Field(default_factory=list)
    weakness_severity: float = 0.0
    downstream_risk: RiskLevel = "low"


# ============================================
# 维度二：学习质量深度 - 行为分析
# ============================================

class BehaviorAnalysis(BaseModel):
    """学习行为分析"""
    node_id: str
    average_time_per_question: float = 0.0
    time_variance: float = 0.0
    rush_rate: float = 0.0
    hesitation_rate: float = 0.0
    guess_rate: float = 0.0
    consistency: float = 0.0
    suspicious_flag: bool = False
    suspicious_reason: str | None = None


class DiscriminationAnalysis(BaseModel):
    """题目区分度分析"""
    exercise_id: str
    discrimination_index: float = 0.0
    difficulty: float = 0.0
    effectiveness: DiscriminationEffectiveness = "acceptable"


# ============================================
# 维度三：认知投入层级 - 投入成效分析
# ============================================

class LearningInvestment(BaseModel):
    """学习投入"""
    student_id: str
    node_id: str | None = None
    study_time_minutes: int = 0
    interaction_count: int = 0
    practice_time_minutes: int = 0
    note_count: int = 0
    doubt_raised: int = 0
    discussion_contribution: int = 0
    engagement_depth: EngagementDepth = "surface"


class EffectivenessMetrics(BaseModel):
    """成效指标"""
    mastery_gain: float = 0.0
    score_improvement: float = 0.0
    skill_growth: float = 0.0


class InvestmentFlags(BaseModel):
    """投入标识"""
    suspected_fake_effort: bool = False
    potential_method_issue: bool = False
    under_utilized: bool = False


class InvestmentEffectivenessAnalysis(BaseModel):
    """投入成效分析"""
    student_id: str
    investment: LearningInvestment
    effectiveness: EffectivenessMetrics
    category: EngagementCategory = "dormant"
    correlation_coefficient: float = 0.0
    efficiency_score: float = 0.0
    flags: InvestmentFlags = Field(default_factory=InvestmentFlags)
    recommendations: list[str] = Field(default_factory=list)


class MotivationIndex(BaseModel):
    """动机指数"""
    student_id: str
    consistency_score: float = 0.0
    perseverance_index: float = 0.0
    growth_mindset_score: float = 0.0
    intrinsic_motivation_score: float = 0.0
    effort_effectiveness_ratio: float = 0.0
    fake_effort_suspicion: float = 0.0


# ============================================
# 综合报告
# ============================================

class LearningOverview(BaseModel):
    """学习概览"""
    total_nodes: int = 0
    mastered: int = 0
    learning: int = 0
    weak: int = 0
    not_started: int = 0
    avg_mastery: float = 0.0
    total_study_minutes: int = 0
    total_attempts: int = 0
    total_errors: int = 0


class TrendPoint(BaseModel):
    """趋势数据点"""
    date: str
    mastery: float = 0.0
    study_minutes: int = 0


class TrendSummary(BaseModel):
    """趋势摘要"""
    avg_mastery: float = 0.0
    total_study_minutes: int = 0
    peak_date: str | None = None


class LearningTrend(BaseModel):
    """学习趋势"""
    days: int
    trend: list[TrendPoint] = Field(default_factory=list)
    summary: TrendSummary


class WeakKnowledgePoint(BaseModel):
    """薄弱知识点"""
    node_id: str
    name: str
    mastery: float = 0.0
    status: ProgressStatus = "weak"
    review_due_at: str | None = None
    affected_nodes: list[str] = Field(default_factory=list)


class ComprehensiveReport(BaseModel):
    """综合学习报告"""
    student_id: str
    timestamp: str
    overview: LearningOverview
    cognitive_mastery: dict[str, CognitiveMastery] = Field(default_factory=dict)
    propagation_analyses: list[PropagationAnalysis] = Field(default_factory=list)
    behavior_analyses: dict[str, BehaviorAnalysis] = Field(default_factory=dict)
    motivation_index: MotivationIndex | None = None


# ============================================
# 推荐相关模型
# ============================================

class RecommendationItem(BaseModel):
    """推荐项"""
    id: str
    name: str
    difficulty: int = 5
    estimated_minutes: int | None = None
    reason: str = ""
    priority: int = 0


# ============================================
# AI 对话相关模型
# ============================================

class ChatRequest(BaseModel):
    """聊天请求"""
    message: str = Field(..., min_length=1, max_length=2000)
    nodeId: str | None = Field(default=None, alias="node_id")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Message cannot be empty")
        return v.strip()


class CodeAnalysisRequest(BaseModel):
    """代码分析请求"""
    code: str = Field(..., min_length=1, max_length=50000)
    problem: str | None = None


class JudgeRequest(BaseModel):
    """OJ 判题请求"""
    submission_id: str
    problem_id: str
    code: str
    time_limit: int
    mem_limit: int


class Select_CompleteRequest(BaseModel):
    """选择题/填空题判定请求"""
    problem_id: str
    answer: str


# ============================================
# 掌握度计算相关模型
# ============================================

class ExerciseResult(BaseModel):
    """单次练习结果"""
    correct: bool
    difficulty: int = Field(default=5, ge=1, le=10)
    time_spent: float = Field(default=60.0, ge=0)
    cognitive_level: CognitiveLevel = "apply"
    guess_flag: bool = False


class MasteryBreakdown(BaseModel):
    """掌握度分解"""
    base_score: float = 0.0
    correct_rate: float = 0.0
    correct_rate_weighted: float = 0.0
    stability_score: float = 0.0
    time_score: float = 0.0
    error_count: int = 0
    difficulty_distribution: dict[int, int] = Field(default_factory=dict)


class MasteryCalculationResponse(BaseModel):
    """掌握度计算响应"""
    node_id: str
    previous_mastery: float
    new_mastery: float
    status: ProgressStatus
    review_due_at: str
    breakdown: MasteryBreakdown
    message: str


class DecayInfo(BaseModel):
    """遗忘曲线信息"""
    base_decay_rate: float = 0.15
    stability_factor: float = 7.0
    retention_rate: float = 1.0


class MasteryAnalysisResponse(BaseModel):
    """掌握度分析响应"""
    node_id: str
    node_name: str
    current_mastery: float
    mastery_after_decay: float
    days_since_last_study: int
    optimal_review_intervals: list[int]
    status: ProgressStatus
    score: int
    metrics: LearningMetrics
    decay_info: DecayInfo
    recommendations: list[str]


class WeightedStats(BaseModel):
    """加权统计"""
    correct: int
    total: int
    rate: float
    weighted_rate: float | None = None


class DifficultyStats(BaseModel):
    """难度级别统计"""
    correct: int
    total: int
    rate: float


class ExerciseSubmissionResponse(BaseModel):
    """练习提交响应"""
    node_id: str
    previous_mastery: float
    new_mastery: float
    status: ProgressStatus
    review_due_at: str
    breakdown: MasteryBreakdown
    message: str
    weighted_stats: dict = Field(default_factory=dict)
