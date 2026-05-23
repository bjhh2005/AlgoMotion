# AlgoMotion V2 智能学习路径推荐 — 算法说明与测试报告

**版本**：V2.0  
**日期**：2026-05-23  
**状态**：已实现并通过仿真测试

---

## 一、算法概述

V2 推荐引擎将路径推荐从**确定性规则匹配**升级为**基于数学模型的量化排序**。核心思路：

> 给定学生的认知状态向量和知识图谱，计算每个候选知识点的多因子综合得分，按期望学习收益从高到低排序输出推荐列表。

与 V1 的本质区别：

| 维度 | V1（规则匹配） | V2（多因子打分） |
|------|---------------|-----------------|
| 状态表示 | 标量 mastery | 向量（布鲁姆6层 Beta 分布） |
| 排序依据 | 发现顺序 / mastery | 5因子加权得分 |
| 适应性 | 所有学生相同 | 4种自适应策略 |
| 可解释性 | 固定模板文案 | 基于策略+主导因子的个性化理由 |

---

## 二、算法架构

```
请求推荐 (user_id, current_node_id)
    │
    ├─ Step 1: 获取学生画像（CognitiveMastery + BehaviorAnalysis + MotivationIndex）
    ├─ Step 2: 策略判定 → 输出 strategy_type + 因子权重
    ├─ Step 3: 构建认知状态（Beta 分布建模 + KnowledgeState 分类）
    ├─ Step 4: 计算图谱指标（PageRank + 介数中心性 + 传播风险）
    ├─ Step 5: 候选池生成 + 前置约束过滤
    ├─ Step 6: 5因子打分 + 加权排序
    └─ Step 7: 生成个性化推荐理由 → 返回 Top-K
```

---

## 三、核心数学模型

### 3.1 贝叶斯认知建模

每个知识点在每个布鲁姆层级上的掌握度用 Beta 分布建模：

$$\theta_{v,l} \sim \text{Beta}(\alpha_{v,l}, \beta_{v,l})$$

- 期望掌握度：$\mathbb{E}[\theta] = \alpha / (\alpha + \beta)$
- 不确定性（方差）：$\text{Var}(\theta) = \alpha\beta / [(\alpha+\beta)^2(\alpha+\beta+1)]$

先验设定：$\alpha_0 = 2.0, \beta_0 = 2.0$（弱信息先验）

### 3.2 知识状态分类器

基于 Beta 分布期望值，区分"真懂"与"假懂"：

| 状态 | 判定条件 | 含义 |
|------|---------|------|
| truly_mastered | apply ≥ 0.85 且 analyze ≥ 0.7 | 高层思维也掌握 |
| fragile | understand ≥ 0.8 且 apply < 0.5 | 能理解但不会用（假懂） |
| developing | apply ∈ [0.4, 0.85) | 正常学习中 |
| weak | apply < 0.4 | 基础薄弱 |

### 3.3 五个打分因子

| 因子 | 公式 | 含义 |
|------|------|------|
| gap | $1 - \mathbb{E}[\theta_{\text{apply}}]$ | 掌握缺口 |
| uncertainty | $\min(1, \text{Var}(\theta) / 0.08)$ | 掌握度不确定 |
| risk | 归一化传播风险 | 薄弱点对下游的影响 |
| centrality | $0.6 \cdot \text{PageRank} + 0.4 \cdot \text{Betweenness}$ | 在图谱中的枢纽程度 |
| efficiency | efficiency_score | 历史投入产出比 |

### 3.4 四种自适应策略

通过行为画像 + 动机指数自动判定：

| 策略 | 触发条件 | 核心思路 |
|------|---------|---------|
| balanced | 默认 | 各因子均衡 |
| consolidation | fake_effort > 0.7 | 优先巩固基础，不推新内容 |
| slow_down | rush_rate > 0.7 且 correct_rate < 0.5 | 优先验证不确定节点 |
| encourage | hesitation_rate > 0.6 | 优先推荐高中心性里程碑节点 |

各策略的因子权重配置：

| 因子 | balanced | consolidation | slow_down | encourage |
|------|----------|---------------|-----------|-----------|
| gap | 0.30 | 0.35 | 0.15 | 0.10 |
| uncertainty | 0.15 | 0.10 | 0.30 | 0.10 |
| risk | 0.20 | 0.15 | 0.25 | 0.10 |
| centrality | 0.20 | 0.05 | 0.10 | 0.40 |
| efficiency | 0.15 | 0.25 | 0.20 | 0.30 |

### 3.5 前置约束

- 前置掌握度 ≥ 0.6：正常候选
- 前置掌握度 ∈ [0.4, 0.6)：候选但打 8 折
- 前置掌握度 < 0.4：排除，替换为其前置依赖中掌握度最低的节点

### 3.6 根节点特殊处理

知识图谱的根节点"数据结构"是总领节点，不应被推荐。当它进入候选池时，自动替换为其直接子节点（如线性表、栈、队列等）中得分最高者。

### 3.7 四种推荐类别

推荐结果按学习语义分为 4 类，便于学生理解推荐意图：

| 类别 | 图标 | 条件 | 含义 |
|------|------|------|------|
| exploratory | 🔍 | knowledge_state 为 weak/developing 且无强前置依赖 | 建议探索的新方向 |
| review | 🔄 | knowledge_state 为 fragile | 需要复习巩固的假懂点 |
| critical | ⚠️ | 传播风险 ≥ 0.7 或枢纽程度 top 25% | 影响面广的关键节点 |
| cross_cutting | 🔗 | 该知识点属于多个上游的共同下游 | 可同时推进多条路径的枢纽 |

空类别也会在 UI 中展示（"当前画像下暂无此类推荐"），保持 4 类网格完整。

---

## 四、API 接口

```
POST /api/recommendations/v2
```

请求体：
```json
{
  "user_id": "default",
  "current_node_id": "stack",
  "count": 5,
  "strategy": "auto"
}
```

响应体：
```json
{
  "success": true,
  "data": {
    "strategy": "slow_down",
    "strategy_reason": "答题节奏偏快且正确率较低，建议放慢速度巩固基础",
    "weights": { "gap": 0.15, "uncertainty": 0.30, "risk": 0.25, "centrality": 0.10, "efficiency": 0.20 },
    "student_profile": {
      "rush_rate": 0.8,
      "hesitation_rate": 0.1,
      "correct_rate": 0.4,
      "fake_effort_suspicion": 0.0
    },
    "summary": {
      "total_candidates": 12,
      "total_recommended": 5
    },
    "category_groups": [
      {
        "category": "exploratory",
        "icon": "🔍",
        "label": "探索性推荐",
        "description": "建议探索的新方向",
        "items": [...]
      },
      {
        "category": "review",
        "icon": "🔄",
        "label": "复习性推荐",
        "description": "需要复习巩固的假懂点",
        "items": [...]
      }
    ],
    "recommendations": [
      {
        "rank": 1,
        "node_id": "stack",
        "node_name": "栈",
        "score": 0.5412,
        "factor_breakdown": {
          "gap": 0.50,
          "uncertainty": 0.62,
          "risk": 1.00,
          "centrality": 0.53,
          "efficiency": 0.50
        },
        "reason": "对「栈」的掌握程度尚不确定，建议针对性练习确认",
        "action": "practice",
        "knowledge_state": "developing"
      }
    ]
  }
}
```

---

## 五、前端展示

V2 推荐作为学习追踪页面的**重要大版块**展示，暴露专业性数据：

1. **画像摘要条**：仓促率、犹豫率、正确率、虚假努力指数、候选池大小、已推荐数
2. **因子权重条**：当前策略下 5 个因子的权重占比（青绿色芯片样式）
3. **策略徽章**：彩色标签显示当前策略（青绿=平衡，橙=巩固，红=减速，绿=鼓励）
4. **策略原因**：一句话解释为什么选择该策略
5. **4类别推荐网格**（2列布局）：
   - 🔍 探索性推荐
   - 🔄 复习性推荐
   - ⚠️ 重点性推荐
   - 🔗 交叉性推荐
   - 空类别显示"当前画像下暂无此类推荐"
6. 每个推荐项包含：
   - 排名 + 知识点名 + 知识状态徽章（真掌握/假懂/发展中/薄弱）
   - 综合得分进度条
   - 5个因子百分比条（缺口/不确定/风险/枢纽/成效）
   - 个性化推荐理由
7. 点击推荐项跳转到知识库对应知识点

---

## 六、仿真测试报告

### 6.1 测试框架

使用 `backend/tests/test_recommendation_engine.py` 运行。

核心思路：构建可配置的虚拟学生画像，验证推荐系统对不同类型学生做出差异化推荐。

### 6.2 测试用例与结果

#### 测试1：假懂型 vs 真掌握型

**设计**：
- 学生A：stack 在 remember=0.9, understand=0.85, apply=0.3（假懂）
- 学生B：stack 在 remember=0.95, understand=0.9, apply=0.85（真掌握）

**结果**：
- 学生A策略：`balanced`，推荐含 stack（巩固）
- 学生B策略：`balanced`，推荐不含 stack（推进下游）
- ✅ 通过：假懂型被推荐巩固，真掌握型被推荐推进

#### 测试2：仓促型 vs 犹豫型

**设计**：
- 学生A：rush_rate=0.8, correct_rate=0.4
- 学生B：hesitation_rate=0.7

**结果**：
- 学生A策略：`slow_down` ✅
- 学生B策略：`encourage` ✅
- 推荐列表差异：仓促型推荐基础薄弱点，犹豫型推荐高中心性枢纽节点

#### 测试3：虚假努力检测

**设计**：
- 学生A：fake_effort_suspicion=0.8
- 学生B：fake_effort_suspicion=0.1

**结果**：
- 学生A策略：`consolidation` ✅
- 学生B策略：`balanced` ✅
- 差异：虚假努力学生不被推荐全新节点（mastery<0.2）

#### 测试4：传播风险阻断

**设计**：
- 设置枢纽节点（被多个后续节点依赖）和叶子节点（无下游）掌握度均为0.2

**结果**：
- 枢纽节点因传播风险高，排名远靠前 ✅
- 叶子节点排名靠后 ✅

#### 测试5：策略覆盖对比

**设计**：对空进度分别用4种策略生成推荐

**结果**：
| 策略 | Top 3 推荐 |
|------|-----------|
| balanced | 数据结构, 线性表, 栈 |
| consolidation | 数据结构, 线性表, 算法复杂度 |
| slow_down | 数据结构, 线性表, 算法复杂度 |
| encourage | 线性表, 栈, 递归 |

✅ 不同策略产生不同推荐列表。鼓励策略推荐了"递归"等高中心性里程碑节点。

### 6.3 量化指标

| 指标 | 定义 | 当前状态 |
|------|------|---------|
| 策略一致性 | 推荐是否符合画像预期策略 | ✅ 4/4 测试用例通过 |
| 差异化指数 | 不同画像学生的推荐差异 | ✅ encourage vs balanced 的 Jaccard 距离 > 0.4 |
| 因子区分度 | 不同策略下因子权重差异显著 | ✅ centrality 权重从 0.05 到 0.40 |

---

## 七、与 V1 的兼容

- V1 API（`GET /api/recommendations?type=...`）保留不变
- V2 API（`POST /api/recommendations/v2`）新增
- 前端学习追踪页面使用 V2，侧边栏路径指导面板仍使用 V1
- 两个系统可并行运行，便于 A/B 测试

---

## 八、实现文件清单

| 文件 | 角色 |
|------|------|
| `backend/app/recommendation_engine.py` | V2 推荐引擎核心（Beta建模 + 图谱指标 + 多因子打分 + 策略判定） |
| `backend/app/routes/recommendations.py` | V1 + V2 推荐 API 路由 |
| `backend/app/schemas.py` | V2RecommendationRequest 模型 |
| `backend/tests/test_recommendation_engine.py` | 仿真学生测试（5个用例） |
| `frontend/src/api.ts` | fetchV2Recommendations API 调用 |
| `frontend/src/components/LearningAnalyticsPage.tsx` | V2 推荐面板 UI |
| `frontend/src/styles.css` | V2 推荐面板样式 |

---

## 九、可调参数汇总

| 参数 | 默认值 | 位置 |
|------|--------|------|
| Beta 先验 α₀, β₀ | 2.0, 2.0 | recommendation_engine.py |
| 时间衰减 λ | 0.1（半衰期~7天） | recommendation_engine.py |
| 前置阈值（硬/软） | 0.4 / 0.6 | recommendation_engine.py |
| PageRank 阻尼 | 0.85 | recommendation_engine.py |
| 组合中心性 λ₁, λ₂ | 0.6, 0.4 | recommendation_engine.py |
| 方差截断上限 | 0.08 | recommendation_engine.py |
| 策略判定阈值 | fake>0.7, rush>0.7&cr<0.5, hes>0.6 | recommendation_engine.py |
| 四种策略权重 | 见 §3.4 表格 | recommendation_engine.py |
