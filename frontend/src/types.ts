export type ProgressStatus = "not_started" | "learning" | "mastered" | "weak";
export type KnowledgeEdgeType = "contains" | "prerequisite" | "related" | "used_in" | "error_caused_by";

export interface KnowledgeNode {
  id: string;
  name: string;
  category: string;
  description: string;
  difficulty: number;
  tags: string[];
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  type: KnowledgeEdgeType;
  label: string;
}

export interface Exercise {
  id: string;
  nodeId: string;
  type: "choice" | "fill" | "programming";
  difficulty: "basic" | "postgraduate" | "interview";
  title: string;
  options?: string[];
  answer: string;
  ojRoute?: string;
  linkedNodeIds?: string[];
}

export interface LearningMetrics {
  mastery: number;
  confidence: number;
  studyMinutes: number;
  attemptCount: number;
  correctRate: number;
  errorCount: number;
  streakDays: number;
  lastActivityAt?: string;
  reviewDueAt?: string;
}

export interface ProgressRecord {
  status: ProgressStatus;
  score: number;
  metrics: LearningMetrics;
}

export type ProgressMap = Record<string, ProgressRecord>;

export interface OntologyRelation {
  subjectId: string;
  predicate: KnowledgeEdgeType;
  objectId: string;
  label: string;
  source: "knowledge-graph" | "oj-error" | "ai-analysis";
  evidence: "curated" | "exercise-attempt" | "rule-match";
}

export interface KnowledgeContent {
  nodeId: string;
  definition: string;
  properties: string[];
  operationSteps: string[];
  complexity: {
    time: string;
    space: string;
  };
  commonMistakes: string[];
  resourceLinks: string[];
}

export interface CodeExample {
  nodeId: string;
  language: "cpp";
  title: string;
  code: string;
}

export interface CodeAnalysisRule {
  id: string;
  keywords: string[];
  linkedNodes: string[];
  suggestion: string;
}

export interface RecommendationSeeds {
  defaultPath: string[];
  weakPrerequisiteBoost: boolean;
  maxRecommendations: number;
}

// ============================================
// 维度一：知识关联结构 - 知识追踪与分析
// ============================================

// 认知层级类型（基于布鲁姆分类学）
export type CognitiveLevel = "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";

// 认知层级配置
export interface CognitiveLevelConfig {
  level: CognitiveLevel;
  label: string;
  description: string;
  weight: number; // 在综合评估中的权重
}

export const COGNITIVE_LEVELS: CognitiveLevelConfig[] = [
  { level: "remember", label: "记忆", description: "识别和回忆信息", weight: 0.1 },
  { level: "understand", label: "理解", description: "解释和阐述概念", weight: 0.15 },
  { level: "apply", label: "应用", description: "在新情境中运用程序", weight: 0.25 },
  { level: "analyze", label: "分析", description: "区分整体与部分关系", weight: 0.25 },
  { level: "evaluate", label: "评价", description: "依据标准做出判断", weight: 0.15 },
  { level: "create", label: "创造", description: "重组要素形成新整体", weight: 0.1 }
];

// 题目认知层级标签
export interface ExerciseCognitiveTag {
  exerciseId: string;
  cognitiveLevel: CognitiveLevel;
  discrimination: number; // 题目区分度 (0-1)，衡量题目区分学霸和学渣的能力
}

// 知识点认知层级掌握度
export interface CognitiveMastery {
  nodeId: string;
  levelMastery: Record<CognitiveLevel, number>; // 各层级掌握度 0-1
  questionAttemptStats: Record<CognitiveLevel, {
    total: number;
    correct: number;
    avgTimeSpent: number; // 秒
    guess嫌疑率: number; // 0-1，答题时间异常短的比率
  }>;
  bloomWeightedMastery: number; // 布鲁姆加权综合掌握度
}

// 知识传播影响分析
export interface PropagationAnalysis {
  sourceNodeId: string;
  affectedNodes: {
    nodeId: string;
    propagationStrength: number; // 0-1，影响强度
    pathType: "prerequisite" | "used_in" | "related";
    rootCause: boolean; // 是否是根本原因
  }[];
  weaknessSeverity: number; // 0-1，薄弱严重程度
  downstreamRisk: "low" | "medium" | "high" | "critical";
}

// ============================================
// 维度二：学习质量深度 - 行为模式分析
// ============================================

// 答题行为模式
export type AnswerBehavior = "normal" | "rushed" | "hesitant" | "guess" | "cheat";

// 答题记录详情
export interface AnswerRecord {
  exerciseId: string;
  nodeId: string;
  timestamp: string;
  timeSpent: number; // 秒
  isCorrect: boolean;
  behavior: AnswerBehavior;
  behaviorConfidence: number; // 0-1，行为判定置信度
}

// 学习行为分析结果
export interface BehaviorAnalysis {
  nodeId: string;
  averageTimePerQuestion: number; // 平均每题耗时(秒)
  timeVariance: number; // 时间方差，衡量稳定性
  rushRate: number; // 0-1，仓促答题比率
  hesitationRate: number; // 0-1，犹豫答题比率
  guessRate: number; // 0-1，蒙猜嫌疑比率
  consistency: number; // 0-1，学习表现一致性
  suspiciousFlag: boolean; // 是否标记为可疑学习
  suspiciousReason?: string; // 可疑原因说明
}

// 题目区分度分析
export interface DiscriminationAnalysis {
  exerciseId: string;
  discriminationIndex: number; // 区分度指数，通常在 -1 到 1 之间
  difficulty: number; // 难度 0-1
  effectiveness: "excellent" | "good" | "acceptable" | "poor"; // 有效性评估
}

// ============================================
// 维度三：认知投入层级 - 投入与成效分析
// ============================================

// 学习投入类型
export interface LearningInvestment {
  studentId: string;
  nodeId?: string; // 可选，特定知识点
  studyTimeMinutes: number; // 学习时长
  interactionCount: number; // 互动次数（论坛发言、提问等）
  practiceTimeMinutes: number; // 练习时长
  noteCount: number; // 笔记数量
  doubtRaised: number; // 提出疑问数
  discussionContribution: number; // 讨论贡献度
  engagementDepth: "surface" | "moderate" | "deep"; // 投入深度
}

// 认知投入层级分类
export type EngagementCategory = "efficient" | "inefficient" | "diving" | "dormant";

// 投入-成效分析结果
export interface InvestmentEffectivenessAnalysis {
  studentId: string;
  investment: LearningInvestment;
  effectiveness: {
    masteryGain: number; // 掌握度提升值
    scoreImprovement: number; // 分数提升
    skillGrowth: number; // 技能成长指数
  };
  category: EngagementCategory;
  correlationCoefficient: number; // 投入与成效相关系数
  efficiencyScore: number; // 效率评分 0-100
  flags: {
    suspectedFakeEffort: boolean;
    potentialMethodIssue: boolean;
    underUtilized: boolean;
  };
  recommendations: string[];
}

// 论坛发言认知层级
export type ForumContributionLevel = "simple_statement" | "information_seeking" | "knowledge_construction";

export interface ForumContribution {
  contributionId: string;
  studentId: string;
  timestamp: string;
  content: string;
  cognitiveLevel: ForumContributionLevel;
  quality: number; // 0-1，质量评分
}

// 驱动力与毅力指数
export interface MotivationIndex {
  studentId: string;
  consistencyScore: number; // 学习一致性 (0-100)
  perseveranceIndex: number; // 毅力指数 (0-100)
  growthMindsetScore: number; // 成长型思维评分 (0-100)
  intrinsicMotivationScore: number; // 内在动机评分 (0-100)
  effortEffectivenessRatio: number; // 努力成效比
  fakeEffortSuspicion: number; // 假努力嫌疑度 (0-1)
}

// ============================================
// 综合学习分析报告
// ============================================

export interface ComprehensiveLearningReport {
  studentId: string;
  timestamp: string;
  
  // 维度一：知识关联结构
  knowledgeStructure: {
    weakNodes: string[]; // 薄弱知识点
    propagationRisks: PropagationAnalysis[];
    cognitivePaths: {
      sourceNode: string;
      brokenPrerequisites: string[];
      rootCauses: string[];
    }[];
    dynamicMasteryProbability: Record<string, number>; // 动态掌握概率
  };
  
  // 维度二：学习质量深度
  learningQuality: {
    cognitiveMastery: Record<string, CognitiveMastery>;
    behaviorAnalysis: Record<string, BehaviorAnalysis>;
    questionDiscrimination: DiscriminationAnalysis[];
  };
  
  // 维度三：认知投入层级
  cognitiveEngagement: {
    investmentEffectiveness: Record<string, InvestmentEffectivenessAnalysis>;
    motivationIndex: MotivationIndex;
    forumContributions: ForumContribution[];
  };
  
  // 综合评分
  overallScores: {
    knowledgeMastery: number;
    learningQuality: number;
    cognitiveEngagement: number;
    compositeIndex: number;
  };
}
