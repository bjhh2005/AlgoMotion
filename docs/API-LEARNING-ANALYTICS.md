# 学习追踪模块 - 后端接口说明文档

## 概述

本文档描述学习追踪模块各功能组件所需的接口、参数及返回格式。

---

## 一、数据类型定义

### 1.1 知识点 (KnowledgeNode)

```typescript
interface KnowledgeNode {
  id: string;                    // 知识点唯一标识
  name: string;                  // 知识点名称
  difficulty: number;             // 难度系数 (1-10)
  estimatedMinutes?: number;      // 预估学习时长（分钟）
  tags?: string[];               // 标签
  content?: string;              // 内容描述
}
```

### 1.2 知识点边 (KnowledgeEdge)

```typescript
interface KnowledgeEdge {
  id?: string;                   // 边的唯一标识
  source: string;                // 源节点 ID（前置知识）
  target: string;                // 目标节点 ID（依赖此知识）
  relation?: "prerequisite" | "used_in" | "related" | "extends";
  weight?: number;               // 关联权重 (0-1)
}
```

### 1.3 学习进度 (ProgressRecord)

```typescript
interface ProgressRecord {
  status: ProgressStatus;        // 学习状态
  score: number;                 // 得分 (0-100)
  metrics: ProgressMetrics;      // 详细指标
  lastStudiedAt?: string;        // 最后学习时间 (ISO 8601)
  reviewDueAt?: string;          // 下次复习时间 (ISO 8601)
}

type ProgressStatus = "not_started" | "learning" | "mastered" | "weak";
```

### 1.4 进度指标 (ProgressMetrics)

```typescript
interface ProgressMetrics {
  mastery: number;               // 掌握度 (0-1)
  confidence: number;            // 自评置信度 (0-1)
  studyMinutes: number;          // 有效学习时长（分钟）
  attemptCount: number;          // OJ 尝试次数
  correctRate: number;          // 练习正确率 (0-1)
  errorCount: number;            // 绑定错因数量
  streakDays: number;            // 连续学习天数
}
```

### 1.5 认知掌握度 (CognitiveMastery)

```typescript
interface CognitiveMastery {
  nodeId: string;
  levelMastery: Record<CognitiveLevel, number>;  // 各层级掌握度
  questionAttemptStats: Record<CognitiveLevel, QuestionAttemptStats>;
  bloomWeightedMastery: number;   // 布鲁姆加权掌握度
}

type CognitiveLevel = "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";

interface QuestionAttemptStats {
  total: number;                  // 总题数
  correct: number;               // 正确数
  avgTimeSpent: number;          // 平均用时（秒）
  guessRate: number;             // 猜题率 (0-1)
}
```

---

## 二、接口清单

### 2.1 获取知识点列表

**接口**: `GET /api/knowledge/nodes`

**描述**: 获取当前用户的所有知识点

**请求参数**: 无

**返回格式**:
```json
{
  "success": true,
  "data": [
    {
      "id": "kn-001",
      "name": "二分查找",
      "difficulty": 5,
      "estimatedMinutes": 30,
      "tags": ["算法", "查找"],
      "content": "二分查找是一种在有序数组中查找目标元素的算法..."
    }
  ]
}
```

---

### 2.2 获取知识边关系

**接口**: `GET /api/knowledge/edges`

**描述**: 获取知识点之间的依赖关系

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| nodeId | string | 否 | 筛选特定节点的所有边 |

**返回格式**:
```json
{
  "success": true,
  "data": [
    {
      "id": "edge-001",
      "source": "kn-001",
      "target": "kn-002",
      "relation": "prerequisite",
      "weight": 0.9
    }
  ]
}
```

---

### 2.3 获取学习进度

**接口**: `GET /api/progress`

**描述**: 获取当前用户所有知识点的学习进度

**请求参数**: 无

**返回格式**:
```json
{
  "success": true,
  "data": {
    "kn-001": {
      "status": "mastered",
      "score": 85,
      "metrics": {
        "mastery": 0.85,
        "confidence": 0.8,
        "studyMinutes": 45,
        "attemptCount": 12,
        "correctRate": 0.75,
        "errorCount": 2,
        "streakDays": 3
      },
      "lastStudiedAt": "2026-05-19T10:30:00Z",
      "reviewDueAt": "2026-05-22T10:30:00Z"
    }
  }
}
```

**备注**: 返回格式为 `Record<nodeId, ProgressRecord>`

---

### 2.4 更新学习进度

**接口**: `POST /api/progress/:nodeId`

**描述**: 更新指定知识点的学习进度

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| nodeId | string | 知识点 ID |

**请求体**:
```json
{
  "status": "learning",
  "score": 70,
  "metrics": {
    "mastery": 0.7,
    "confidence": 0.6,
    "studyMinutes": 30,
    "attemptCount": 5,
    "correctRate": 0.6,
    "errorCount": 1
  }
}
```

**返回格式**:
```json
{
  "success": true,
  "data": {
    "nodeId": "kn-001",
    "updated": true,
    "reviewDueAt": "2026-05-21T10:30:00Z"
  }
}
```

---

### 2.5 获取认知层级分析

**接口**: `GET /api/analytics/cognitive/:nodeId`

**描述**: 获取指定知识点的布鲁姆认知层级分析

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| nodeId | string | 知识点 ID |

**返回格式**:
```json
{
  "success": true,
  "data": {
    "nodeId": "kn-001",
    "levelMastery": {
      "remember": 0.9,
      "understand": 0.85,
      "apply": 0.75,
      "analyze": 0.6,
      "evaluate": 0.45,
      "create": 0.3
    },
    "questionAttemptStats": {
      "remember": { "total": 10, "correct": 9, "avgTimeSpent": 30, "guessRate": 0.05 },
      "understand": { "total": 8, "correct": 7, "avgTimeSpent": 45, "guessRate": 0.1 },
      "apply": { "total": 12, "correct": 9, "avgTimeSpent": 120, "guessRate": 0.15 },
      "analyze": { "total": 6, "correct": 4, "avgTimeSpent": 180, "guessRate": 0.2 },
      "evaluate": { "total": 4, "correct": 2, "avgTimeSpent": 240, "guessRate": 0.25 },
      "create": { "total": 3, "correct": 1, "avgTimeSpent": 300, "guessRate": 0.3 }
    },
    "bloomWeightedMastery": 0.68
  }
}
```

---

### 2.6 获取综合学习分析报告

**接口**: `GET /api/analytics/report`

**描述**: 获取当前用户的综合学习分析报告，包含以下维度：学习概览、认知掌握度、薄弱知识传播分析、行为分析、动机指数。

**请求参数**: 无

**返回格式**:
```json
{
  "success": true,
  "data": {
    "student_id": "current_user",
    "timestamp": "2026-05-21T14:00:00Z",
    "overview": {
      "total_nodes": 12,
      "mastered": 4,
      "learning": 5,
      "weak": 3,
      "not_started": 0,
      "avg_mastery": 0.62,
      "total_study_minutes": 395,
      "total_attempts": 47,
      "total_errors": 14
    },
    "cognitive_mastery": {
      "stack": {
        "node_id": "stack",
        "level_mastery": {
          "remember": 0.82,
          "understand": 0.74,
          "apply": 0.63,
          "analyze": 0.52,
          "evaluate": 0.42,
          "create": 0.33
        },
        "question_attempt_stats": {
          "remember": { "total": 8, "correct": 7, "avg_time_spent": 32, "guess_rate": 0.08 },
          "understand": { "total": 7, "correct": 6, "avg_time_spent": 44, "guess_rate": 0.12 },
          "apply": { "total": 9, "correct": 7, "avg_time_spent": 95, "guess_rate": 0.18 },
          "analyze": { "total": 5, "correct": 3, "avg_time_spent": 150, "guess_rate": 0.22 },
          "evaluate": { "total": 3, "correct": 2, "avg_time_spent": 200, "guess_rate": 0.28 },
          "create": { "total": 2, "correct": 1, "avg_time_spent": 260, "guess_rate": 0.35 }
        },
        "bloom_weighted_mastery": 0.57
      }
    },
    "propagation_analyses": [
      {
        "source_node_id": "queue",
        "affected_nodes": [
          { "node_id": "stack", "propagation_strength": 0.7, "path_type": "prerequisite", "root_cause": true }
        ],
        "weakness_severity": 0.68,
        "downstream_risk": "high"
      }
    ],
    "behavior_analyses": {
      "stack": {
        "node_id": "stack",
        "average_time_per_question": 38.5,
        "time_variance": 120.8,
        "rush_rate": 0.18,
        "hesitation_rate": 0.22,
        "guess_rate": 0.15,
        "consistency": 0.72,
        "suspicious_flag": false,
        "suspicious_reason": null
      }
    },
    "motivation_index": {
      "student_id": "current_user",
      "consistency_score": 78.5,
      "perseverance_index": 82.2,
      "growth_mindset_score": 74.9,
      "intrinsic_motivation_score": 69.1,
      "effort_effectiveness_ratio": 0.86,
      "fake_effort_suspicion": 0.12
    }
  }
}
```

---

### 2.7 导出综合学习分析报告

**接口**: `GET /api/analytics/report/export`

**描述**: 导出当前用户的综合学习分析报告，返回一个可下载的 JSON 文件。

**请求参数**: 无

**返回说明**:
- 成功时返回 `application/json` 内容并带 `Content-Disposition: attachment` 下载头。
- 文件名格式为 `learning-analytics-report-YYYYMMDD-HHMMSS.json`。

**前端示例**:
```ts
const response = await fetch('/api/analytics/report/export');
const blob = await response.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'learning-analytics-report.json';
a.click();
URL.revokeObjectURL(url);
```

---

### 2.6 获取知识点推荐

**接口**: `GET /api/recommendations`

**描述**: 获取学习路径推荐

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| limit | number | 否 | 返回数量，默认 5 |
| type | string | 否 | 推荐类型: `next`/`weak`/`review` |

**返回格式**:
```json
{
  "success": true,
  "data": [
    {
      "id": "kn-003",
      "name": "快速排序",
      "difficulty": 6,
      "estimatedMinutes": 45,
      "reason": "基于当前进度推荐",
      "priority": 1
    }
  ]
}
```

---

### 2.7 获取学习趋势

**接口**: `GET /api/analytics/trend`

**描述**: 获取学习趋势数据

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| days | number | 否 | 统计天数，默认 7 |
| nodeId | string | 否 | 筛选特定节点 |

**返回格式**:
```json
{
  "success": true,
  "data": {
    "days": 7,
    "trend": [
      { "date": "2026-05-13", "mastery": 0.5, "studyMinutes": 45 },
      { "date": "2026-05-14", "mastery": 0.52, "studyMinutes": 60 },
      { "date": "2026-05-15", "mastery": 0.55, "studyMinutes": 30 },
      { "date": "2026-05-16", "mastery": 0.58, "studyMinutes": 50 },
      { "date": "2026-05-17", "mastery": 0.62, "studyMinutes": 40 },
      { "date": "2026-05-18", "mastery": 0.68, "studyMinutes": 55 },
      { "date": "2026-05-19", "mastery": 0.72, "studyMinutes": 35 }
    ],
    "summary": {
      "avgMastery": 0.595,
      "totalStudyMinutes": 315,
      "peakDate": "2026-05-18"
    }
  }
}
```

---

### 2.8 获取薄弱知识点

**接口**: `GET /api/analytics/weak`

**描述**: 获取需要加强的知识点

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| threshold | number | 否 | 掌握度阈值，默认 0.5 |

**返回格式**:
```json
{
  "success": true,
  "data": [
    {
      "nodeId": "kn-005",
      "name": "动态规划",
      "mastery": 0.35,
      "status": "weak",
      "reviewDueAt": "2026-05-20T00:00:00Z",
      "affectedNodes": ["kn-006", "kn-007"]
    }
  ]
}
```

---

### 2.9 获取综合学习报告

**接口**: `GET /api/analytics/report`

**描述**: 获取综合学习分析报告

**返回格式**:
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalNodes": 20,
      "mastered": 8,
      "learning": 7,
      "weak": 3,
      "notStarted": 2,
      "avgMastery": 0.65,
      "totalStudyMinutes": 450,
      "totalAttempts": 85,
      "totalErrors": 12
    },
    "cognitiveMastery": { ... },
    "propagationAnalyses": [ ... ],
    "behaviorAnalyses": { ... },
    "motivationIndex": { ... }
  }
}
```

---

## 三、前端组件数据需求

### 3.1 学习追踪页面 (LearningAnalyticsPage)

**Props**:
```typescript
interface LearningAnalyticsPageProps {
  nodes: KnowledgeNode[];              // 知识点列表
  edges?: KnowledgeEdge[];            // 知识边关系
  progress: Record<string, ProgressRecord>;  // 学习进度
  recommendations: KnowledgeNode[];   // 推荐路径
  onSelect: (nodeId: string) => void; // 选中节点回调
}
```

**所需接口**:
| 接口 | 用途 |
|------|------|
| GET /api/knowledge/nodes | 获取知识点 |
| GET /api/knowledge/edges | 获取知识边 |
| GET /api/progress | 获取学习进度 |
| GET /api/recommendations | 获取推荐 |

---

### 3.2 知识热力图 (KnowledgeHeatmap)

**Props**:
```typescript
interface KnowledgeHeatmapProps {
  nodes: KnowledgeNode[];
  edges: { source: string; target: string }[];
  progress: Record<string, ProgressRecord>;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
}
```

**所需数据**:
- nodes: 知识点列表（用于显示名称、难度）
- edges: 边关系（用于计算入度/出度）
- progress: 进度数据（用于显示掌握度）

---

### 3.3 学习趋势图 (LearningTrendChart)

**Props**: 无（使用模拟数据）

**所需接口**: `GET /api/analytics/trend`

---

### 3.4 环形进度分布图 (ProgressDistributionChart)

**Props**:
```typescript
interface ProgressDistributionChartProps {
  statusCounts: Array<{
    status: string;
    count: number;
    label: string;
    color: string;
  }>;
}
```

**所需数据**: 从 progress 数据统计各状态数量

---

### 3.5 效率仪表盘 (EfficiencyGauge)

**Props**:
```typescript
interface EfficiencyGaugeProps {
  gauges: Array<{
    label: string;
    value: number;
    max: number;
    unit: string;
    color: string;
    thresholds: { warning: number; danger: number };
  }>;
}
```

**所需计算**:
- 正确率: 来自 progress.metrics.correctRate
- 学习效率: 掌握提升 / 学习时间
- 日均时长: 总学习时长 / 7

---

### 3.6 认知雷达图 (CognitiveRadarChart)

**Props**:
```typescript
interface CognitiveRadarChartProps {
  cognitiveMastery: CognitiveMastery | null;
  nodeName: string;
  width?: number;
  height?: number;
}
```

**所需接口**: `GET /api/analytics/cognitive/:nodeId`

---

### 3.7 学习行为分析 (LearningBehaviorPanel)

**Props**:
```typescript
interface LearningBehaviorPanelProps {
  nodes: KnowledgeNode[];
  behaviorAnalyses: Record<string, BehaviorAnalysis>;
  questionDiscriminations: DiscriminationAnalysis[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}
```

**所需数据**: 来自综合报告中的 behaviorAnalyses

---

## 四、错误码说明

| 错误码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未登录 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 五、备注

1. 所有时间格式使用 ISO 8601 标准（UTC 时间）
2. 百分比/率的值统一使用 0-1 范围，前端负责转换为百分比显示
3. 分页参数使用 `page` 和 `pageSize`
4. 实时数据可使用 WebSocket 连接，路径 `/ws/progress`

---

## 六、智能掌握度计算

### 6.1 掌握度计算公式

```
mastery = 基础分 × 0.25 + 正确率分 × 0.35 + 稳定性分 × 0.25 + 时效分 × 0.15
```

**计算因子说明**:

| 因子 | 说明 | 权重 |
|------|------|------|
| 基础分 | 历史最高掌握度 | 25% |
| 正确率分 | 题目区分度加权的正确率 | 35% |
| 稳定性分 | 1 - (错题数 / (错题数 + 正确数 × 2)) | 25% |
| 时效分 | 最近表现与历史的综合分 | 15% |

### 6.2 题目区分度加权

不同难度题目的正确作答对掌握度贡献不同：

| 难度等级 | 权重 | 说明 |
|---------|------|------|
| 1-3 (简单) | 0.3-0.7 | 基础题，贡献较低 |
| 4-6 (中等) | 0.85-1.0 | 中等题，标准权重 |
| 7-10 (困难) | 1.15-1.8 | 难题，贡献更高 |

**区分度调整**:
- 区分度 ≥ 0.5: 权重 × 1.4
- 区分度 ≥ 0.3: 权重 × 1.2
- 区分度 < 0: 权重 × 0.5（负区分度题目降低权重）

### 6.3 遗忘曲线模型 (艾宾浩斯)

使用艾宾浩斯遗忘曲线调整复习时机：

```
current_mastery = initial_mastery × e^(-days_elapsed / stability)
```

**参数说明**:
- 基础衰减率: 0.15
- 稳定因子: 7.0（越大遗忘越慢）

**复习间隔策略**:

| 掌握度范围 | 推荐间隔 |
|-----------|---------|
| ≥ 0.9 | 60 天 |
| 0.7-0.9 | 15-30 天 |
| 0.5-0.7 | 7-15 天 |
| 0.3-0.5 | 3-7 天 |
| < 0.3 | 1 天 |

---

## 七、新增接口

### 7.1 提交练习结果 (智能计算)

**接口**: `POST /api/progress/submit`

**描述**: 提交练习结果，自动计算掌握度（使用遗忘曲线和区分度加权）

**请求体**:
```json
{
  "nodeId": "binary-search",
  "score": 85,
  "exercises": [
    {
      "correct": true,
      "difficulty": 4,
      "timeSpent": 45.5,
      "cognitiveLevel": "apply",
      "guess": false
    }
  ]
}
```

**返回格式**:
```json
{
  "success": true,
  "data": {
    "nodeId": "binary-search",
    "previousMastery": 0.65,
    "newMastery": 0.72,
    "status": "learning",
    "reviewDueAt": "2026-05-26T20:34:00Z",
    "breakdown": {
      "baseScore": 0.65,
      "correctRate": 0.85,
      "correctRateWeighted": 0.87,
      "stabilityScore": 0.78,
      "timeScore": 0.68,
      "errorCount": 1,
      "difficultyDistribution": { "4": 1, "6": 1 }
    },
    "message": "掌握度提升 7.0%，表现良好",
    "weightedStats": {
      "simple": { "correct": 1, "total": 1, "rate": 1.0 },
      "medium": { "correct": 1, "total": 1, "rate": 1.0 },
      "hard": { "correct": 0, "total": 0, "rate": 0 },
      "overall": { "correct": 2, "total": 2, "rate": 0.85, "weightedRate": 0.87 }
    }
  }
}
```

---

### 7.2 获取掌握度详细分析

**接口**: `GET /api/progress/analysis/:nodeId`

**描述**: 获取知识点掌握度的详细分析，包括遗忘曲线信息和复习建议

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| nodeId | string | 知识点 ID |

**返回格式**:
```json
{
  "success": true,
  "data": {
    "nodeId": "binary-search",
    "nodeName": "二分查找",
    "currentMastery": 0.72,
    "masteryAfterDecay": 0.68,
    "daysSinceLastStudy": 3,
    "optimalReviewIntervals": [1, 2, 4, 7, 15],
    "status": "learning",
    "score": 85,
    "metrics": { ... },
    "decayInfo": {
      "baseDecayRate": 0.15,
      "stabilityFactor": 7.0,
      "retentionRate": 0.94
    },
    "recommendations": [
      "建议定期复习",
      "下次复习时间: 2026-05-26T20:34:00Z",
      "当前复习间隔: 7 天"
    ]
  }
}
```

---

### 7.3 认知层级权重 (布鲁姆分类)

用于计算布鲁姆加权掌握度：

| 认知层级 | 权重 | 说明 |
|---------|------|------|
| remember (记忆) | 10% | 识记、理解概念 |
| understand (理解) | 15% | 解释、举例 |
| apply (应用) | 25% | 运用程序解决问题 |
| analyze (分析) | 25% | 区分、组织、归因 |
| evaluate (评价) | 15% | 检查、批判 |
| create (创造) | 10% | 假设、设计、构建 |

---

### 7.4 状态自动判断规则

| 条件 | 状态 |
|------|------|
| mastery ≥ 0.8 且正确率 ≥ 0.75 | mastered (已掌握) |
| mastery < 0.5 或错题数 ≥ 3 | weak (薄弱) |
| mastery ≥ 0.3 或学习时长 > 0 | learning (学习中) |
| 其他 | not_started (未开始) |

