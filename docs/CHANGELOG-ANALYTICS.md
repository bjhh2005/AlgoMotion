# 学习追踪高级分析模块 - 修改文档

## 概述

本次更新为 AlgoMotion 智慧学习平台的学习统计页面添加了三大维度的专业可视化分析和衡量标准，旨在更深入地刻画每个知识点的学习情况，区分"真懂"与"假努力"。

---

## 新增文件清单

### 可视化组件
| 文件路径 | 说明 |
|---------|------|
| `frontend/src/components/KnowledgeHeatmap.tsx` | 知识掌握热力图 |
| `frontend/src/components/LearningTrendChart.tsx` | 学习趋势折线图 |
| `frontend/src/components/ProgressDistributionChart.tsx` | 环形进度分布图 |
| `frontend/src/components/EfficiencyGauge.tsx` | 效率仪表盘 |
| `frontend/src/components/CognitiveRadarChart.tsx` | 认知层级雷达图（高级分析） |
| `frontend/src/components/KnowledgePropagationGraph.tsx` | 知识传播图（高级分析） |
| `frontend/src/components/InvestmentEffectivenessScatter.tsx` | 投入成效散点图（高级分析） |
| `frontend/src/components/LearningBehaviorPanel.tsx` | 学习行为分析面板（高级分析） |
| `frontend/src/components/AdvancedAnalyticsDashboard.tsx` | 综合仪表盘（高级分析） |

---

## 一、修改的文件

### 1. 前端类型定义
**文件**: `frontend/src/types.ts`

**新增类型定义**:
- `CognitiveLevel`: 认知层级类型（记忆、理解、应用、分析、评价、创造）
- `COGNITIVE_LEVELS`: 认知层级配置常量
- `CognitiveMastery`: 知识点认知层级掌握度
- `PropagationAnalysis`: 知识传播影响分析
- `BehaviorAnalysis`: 学习行为分析结果
- `DiscriminationAnalysis`: 题目区分度分析
- `LearningInvestment`: 学习投入类型
- `InvestmentEffectivenessAnalysis`: 投入-成效分析结果
- `MotivationIndex`: 驱动力与毅力指数
- `ComprehensiveLearningReport`: 综合学习分析报告

### 2. 后端数据模型
**文件**: `backend/app/schemas.py`

**新增 Pydantic 模型**:
- `CognitiveLevelStats`: 认知层级统计
- `CognitiveMastery`: 认知掌握度
- `PropagationAnalysis`: 传播分析
- `BehaviorAnalysis`: 行为分析
- `DiscriminationAnalysis`: 区分度分析
- `LearningInvestment`: 学习投入
- `InvestmentEffectivenessAnalysis`: 投入成效
- `MotivationIndex`: 动机指数
- `ComprehensiveLearningReport`: 综合报告

### 3. 核心组件

#### 3.1 CognitiveRadarChart 组件
**文件**: `frontend/src/components/CognitiveRadarChart.tsx`

**功能**: 基于布鲁姆认知目标分类学的雷达图可视化
- 展示六个认知层级的掌握情况（记忆、理解、应用、分析、评价、创造）
- 计算布鲁姆加权综合掌握度
- 显示各层级详细数据（正确率、平均耗时、蒙猜嫌疑率）
- 支持颜色编码和交互提示

#### 3.2 KnowledgePropagationGraph 组件
**文件**: `frontend/src/components/KnowledgePropagationGraph.tsx`

**功能**: 知识图谱动态传播图
- 可视化薄弱知识点对下游知识的影响传播
- 按类别分组展示知识节点
- 区分边的类型（前置依赖、应用关系、相关）
- 显示传播风险等级和影响强度
- 支持点击查看详细传播影响分析

#### 3.3 InvestmentEffectivenessScatter 组件
**文件**: `frontend/src/components/InvestmentEffectivenessScatter.tsx`

**功能**: 学习投入-成效散点图
- 将学生分为四个象限（高效型、低效型、潜水型、待激活）
- 展示投入（学习时长）与成效（掌握度提升）的关系
- 标记"假努力"嫌疑学生
- 提供统计摘要和风险预警

#### 3.4 LearningBehaviorPanel 组件
**文件**: `frontend/src/components/LearningBehaviorPanel.tsx`

**功能**: 学习行为与题目分析面板
- 展示答题行为分析（平均耗时、仓促率、蒙猜率、一致性）
- 识别可疑学习行为并提供原因说明
- 分析题目区分度，评估题目有效性
- 提供区分度解读指南

#### 3.5 AdvancedAnalyticsDashboard 组件
**文件**: `frontend/src/components/AdvancedAnalyticsDashboard.tsx`

**功能**: 高级学习分析综合仪表盘
- 整合三个维度的所有分析组件
- 提供维度切换标签（知识关联结构、学习质量深度、认知投入层级）
- 计算并展示综合评分
- 响应式布局设计

### 4. 学习追踪页面更新
**文件**: `frontend/src/components/LearningAnalyticsPage.tsx`

**更新内容**:
- 添加视图切换功能（基础视图/高级分析）
- 集成 AdvancedAnalyticsDashboard 组件
- 数据生成逻辑适配新的分析数据结构
- 保持原有基础视图的兼容性

### 5. 样式更新
**文件**: `frontend/src/styles.css`

**新增样式类**:
- `.title-actions`: 标题操作区域
- `.view-toggle`: 视图切换按钮组
- `.advanced-analytics-dashboard`: 高级分析仪表盘
- `.dimension-tabs`: 维度切换标签
- `.overall-scores`: 综合评分卡片
- `.score-card`: 评分卡片样式
- `.dimension-content`: 维度内容区域
- `.knowledge-propagation-graph`: 知识传播图
- `.cognitive-radar-chart`: 认知雷达图
- `.learning-behavior-panel`: 行为分析面板
- `.investment-effectiveness-scatter`: 投入成效散点图
- `.motivation-section`: 动机指数面板
- 各类图表的动画效果和响应式布局

---

## 二、三维度核心指标体系

### 维度一：知识关联结构

| 指标名称 | 说明 | 可视化呈现 |
|---------|------|-----------|
| 薄弱节点识别 | 识别掌握度低于阈值的知识点 | 知识传播图节点颜色 |
| 传播影响分析 | 薄弱向上游传播的路径和强度 | 虚线箭头 + 影响强度条 |
| 传播风险等级 | low/medium/high/critical 四级 | 风险徽章颜色 |
| 根本原因定位 | 追溯到最初的前置知识缺陷 | 根因标记 |
| 动态掌握概率 | 综合历史答题序列的掌握概率 | 颜色深浅渐变 |

### 维度二：学习质量深度

| 指标名称 | 说明 | 可视化呈现 |
|---------|------|-----------|
| 认知层级掌握度 | 六个层级的分别掌握率 | 雷达图 |
| 布鲁姆加权综合 | 综合各层级权重的掌握度 | 中心百分比 |
| 答题时间分析 | 平均耗时、方差、仓促率 | 指标卡片 |
| 蒙猜嫌疑检测 | 答题时间异常短的比率 | 警告标记 |
| 学习一致性 | 表现稳定性评分 | 百分比显示 |
| 题目区分度 | 区分学霸和学渣的能力 | 区分度条形图 |

### 维度三：认知投入层级

| 指标名称 | 说明 | 可视化呈现 |
|---------|------|-----------|
| 学习投入量 | 学习时长、练习时长、互动次数 | 散点图X轴 |
| 掌握度提升 | 知识点掌握度的增值 | 散点图Y轴 |
| 学生类型分类 | 高效型/低效型/潜水型/待激活 | 四象限散点图 |
| 效率评分 | 0-100分的综合效率评分 | 数值显示 |
| 假努力嫌疑 | 投入高但成效低的比率 | 警告提示 |
| 学习驱动力指数 | 一致性、毅力、成长型思维等 | 动机卡片 |
| 毅力指数 | 学习持续性和抗挫能力 | 数值评分 |

---

## 三、使用说明

### 切换视图
1. 在学习追踪分析页面，点击右上角的"基础视图"/"高级分析"切换按钮
2. 基础视图保持原有的简单统计展示
3. 高级分析视图提供三大维度的深度分析

### 查看认知层级分析
1. 在高级分析视图，选择"学习质量深度"维度
2. 点击左侧雷达图选择一个知识点（也可以从图谱点击选择）
3. 查看该知识点在六个认知层级的掌握情况
4. 参考表格中的详细数据（正确率、耗时、蒙猜率）

### 查看知识传播影响
1. 在高级分析视图，选择"知识关联结构"维度
2. 观察知识图谱中的红色/橙色节点（薄弱节点）
3. 点击薄弱节点查看其影响的上下游知识点
4. 了解传播路径类型（前置依赖/应用关系/相关）

### 查看投入成效分析
1. 在高级分析视图，选择"认知投入层级"维度
2. 观察散点图中的学生分布
3. 参考四象限分类识别不同类型学生
4. 查看动机指数面板了解学习驱动力状态

---

## 四、技术实现亮点

---

## 四、新增可视化组件详解

### 4.1 知识掌握热力图 (KnowledgeHeatmap)
**文件**: `frontend/src/components/KnowledgeHeatmap.tsx`

基于知识图谱结构的掌握度热力图：
- 颜色渐变展示掌握程度（绿→蓝→黄→橙→红）
- 显示每个知识点的入度和出度（前置/下游依赖数量）
- 点击节点显示详细的前置知识和下游知识关联
- 直观识别知识链中的薄弱环节

### 4.2 学习趋势折线图 (LearningTrendChart)
**文件**: `frontend/src/components/LearningTrendChart.tsx`

学习进展的时间序列可视化：
- 双轴图表同时展示掌握度变化和学习时长
- 虚线标注平均掌握度基准线
- 显示趋势方向（上升/下降）和幅度
- 统计摘要：趋势、峰值日、总尝试次数

### 4.3 环形进度分布图 (ProgressDistributionChart)
**文件**: `frontend/src/components/ProgressDistributionChart.tsx`

学习状态分布的环形图：
- 展示已掌握/学习中/需巩固/未开始的比例
- 中心显示知识点总数
- 悬停显示详细百分比
- 颜色编码各状态

### 4.4 效率仪表盘 (EfficiencyGauge)
**文件**: `frontend/src/components/EfficiencyGauge.tsx`

关键效率指标的半圆仪表盘：
- 正确率：答题正确百分比
- 学习效率：掌握度提升/学习时间
- 日均时长：平均每日学习时间
- 连续学习：连续学习天数
- 低于阈值自动变红预警

---

### 模块化设计
- 每个可视化组件独立封装，可单独使用
- 类型定义集中管理，便于扩展
- 样式使用 BEM 命名规范，避免冲突

### 性能优化
- 使用 `useMemo` 缓存计算结果
- SVG 图表使用虚拟 DOM 高效渲染
- 延迟加载高级分析数据

### 可访问性
- 支持键盘导航
- 颜色对比度符合 WCAG 标准
- 提供 ARIA 标签和标题提示

### 响应式设计
- 适配桌面、平板、手机三种屏幕尺寸
- 图表尺寸自适应容器
- 移动端布局自动调整

---

## 五、未来扩展方向

1. **后端数据接入**: 当前使用模拟数据，后续可接入真实的后端 API
2. **实时更新**: 支持 WebSocket 实时推送学习数据变化
3. **导出功能**: 支持导出分析报告为 PDF/Excel
4. **个性化推荐**: 基于分析结果提供更精准的学习路径推荐
5. **班级对比**: 支持班级/年级维度的横向对比分析
6. **预警系统**: 设置阈值自动触发学习预警通知

---

## 六、版本信息

- **更新日期**: 2026-05-19
- **版本号**: v2.0.0
- **更新内容**: 新增三大维度高级学习分析模块
