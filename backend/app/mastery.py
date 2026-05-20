"""
掌握度计算模块

提供智能掌握度计算、遗忘曲线模型、题目区分度加权等功能
"""
import math
import random
from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass

from .schemas import LearningMetrics


# ============================================
# 遗忘曲线常数 (艾宾浩斯模型)
# ============================================

# 遗忘曲线参数: mastery(t) = mastery_initial * e^(-t/S) where S is stability
EBBINGHAUS_DECAY_BASE = 0.15  # 基础衰减率
STABILITY_FACTOR = 7.0  # 稳定因子（数值越大遗忘越慢）

# 复习间隔天数（基于艾宾浩斯研究）
REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30, 60, 90]


# ============================================
# 难度权重配置
# ============================================

# 题目难度权重 - 难题正确作答贡献更高
DIFFICULTY_WEIGHTS = {
    1: 0.3,   # 简单题
    2: 0.5,
    3: 0.7,
    4: 0.85,
    5: 1.0,  # 中等题
    6: 1.15,
    7: 1.3,
    8: 1.45,
    9: 1.6,
    10: 1.8,  # 困难题
}

# 认知层级权重 (布鲁姆分类)
COGNITIVE_WEIGHTS = {
    "remember": 0.10,      # 记忆
    "understand": 0.15,    # 理解
    "apply": 0.25,         # 应用
    "analyze": 0.25,       # 分析
    "evaluate": 0.15,      # 评价
    "create": 0.10,        # 创造
}


@dataclass
class ExerciseResult:
    """单次练习结果"""
    correct: bool
    difficulty: int = 5          # 1-10
    time_spent: float = 60.0     # 秒
    cognitive_level: str = "apply"  # 布鲁姆层级
    guess_flag: bool = False     # 是否猜题


@dataclass
class MasteryCalculation:
    """掌握度计算结果"""
    new_mastery: float
    status: str
    review_due_at: str
    mastery_breakdown: dict
    message: str


# ============================================
# 一、智能掌握度计算
# ============================================

def calculate_mastery(
    current_mastery: float,
    exercise_results: list[ExerciseResult],
    study_minutes: int,
    attempt_count: int,
) -> float:
    """
    综合计算掌握度
    
    公式: mastery = 基础分 * 0.25 + 正确率分 * 0.35 + 稳定性分 * 0.25 + 时效分 * 0.15
    
    Args:
        current_mastery: 当前掌握度
        exercise_results: 练习结果列表
        study_minutes: 学习时长（分钟）
        attempt_count: 尝试次数
    
    Returns:
        计算后的新掌握度 (0-1)
    """
    if not exercise_results:
        # 无练习时，基于学习时长微弱提升
        time_factor = min(study_minutes / 120, 1.0)  # 最多120分钟
        return min(1.0, current_mastery + time_factor * 0.05)
    
    # 1. 基础分 - 基于历史最高分
    base_score = current_mastery
    
    # 2. 正确率分 - 使用区分度加权
    weighted_correct = 0.0
    weighted_total = 0.0
    for result in exercise_results:
        weight = DIFFICULTY_WEIGHTS.get(result.difficulty, 1.0)
        if result.guess_flag:
            weight *= 0.5  # 猜题权重减半
        weighted_total += weight
        if result.correct:
            weighted_correct += weight
    
    correct_rate = weighted_correct / weighted_total if weighted_total > 0 else 0
    
    # 3. 稳定性分 - 正确/错误比例
    correct_count = sum(1 for r in exercise_results if r.correct)
    total_count = len(exercise_results)
    error_count = total_count - correct_count
    
    if error_count == 0:
        stability_score = 1.0
    else:
        # 错题越少越稳定
        stability_score = 1.0 - (error_count / (error_count + correct_count * 2))
    
    # 4. 时效分 - 最近表现权重更高
    recent_weight = 0.6  # 最近练习权重
    time_score = correct_rate * recent_weight + (base_score * (1 - recent_weight) if total_count > 1 else 0)
    
    # 综合计算
    mastery = (
        base_score * 0.25 +
        correct_rate * 0.35 +
        stability_score * 0.25 +
        time_score * 0.15
    )
    
    # 限制范围
    return max(0.0, min(1.0, mastery))


def calculate_mastery_with_breakdown(
    current_mastery: float,
    exercise_results: list[ExerciseResult],
    study_minutes: int,
    attempt_count: int,
    last_mastery: float,
    last_studied_at: Optional[str] = None,
) -> MasteryCalculation:
    """
    带详细分解的掌握度计算
    
    Returns:
        MasteryCalculation 包含分解信息和状态判断
    """
    # 计算各项分数
    base_score = current_mastery
    
    if exercise_results:
        weighted_correct = sum(
            DIFFICULTY_WEIGHTS.get(r.difficulty, 1.0) * (0.5 if r.guess_flag else 1.0)
            for r in exercise_results if r.correct
        )
        weighted_total = sum(
            DIFFICULTY_WEIGHTS.get(r.difficulty, 1.0)
            for r in exercise_results
        )
        correct_rate = weighted_correct / weighted_total if weighted_total > 0 else 0
        
        correct_count = sum(1 for r in exercise_results if r.correct)
        error_count = len(exercise_results) - correct_count
        stability_score = 1.0 if error_count == 0 else max(0, 1.0 - error_count / (error_count + correct_count * 2))
    else:
        correct_rate = 0
        stability_score = 0
        error_count = 0
    
    time_factor = min(study_minutes / 120, 1.0)
    time_score = current_mastery + time_factor * 0.05
    
    # 综合计算
    new_mastery = (
        base_score * 0.25 +
        correct_rate * 0.35 +
        stability_score * 0.25 +
        time_score * 0.15
    )
    new_mastery = max(0.0, min(1.0, new_mastery))
    
    # 状态判断
    if new_mastery >= 0.8 and correct_rate >= 0.75:
        status = "mastered"
    elif new_mastery < 0.5 or error_count >= 3:
        status = "weak"
    elif new_mastery >= 0.3 or study_minutes > 0:
        status = "learning"
    else:
        status = "not_started"
    
    # 复习时间计算（考虑遗忘曲线）
    review_due_at = calculate_review_due_with_decay(new_mastery, last_mastery, last_studied_at)
    
    # 分解信息
    breakdown = {
        "base_score": round(base_score, 3),
        "correct_rate": round(correct_rate, 3),
        "correct_rate_weighted": round(correct_rate, 3),
        "stability_score": round(stability_score, 3),
        "time_score": round(time_score, 3),
        "error_count": error_count,
        "difficulty_distribution": {
            d: sum(1 for r in exercise_results if r.difficulty == d)
            for d in range(1, 11)
        } if exercise_results else {}
    }
    
    # 生成消息
    if new_mastery > current_mastery:
        delta = new_mastery - current_mastery
        message = f"掌握度提升 {delta:.1%}"
    elif new_mastery < current_mastery:
        delta = current_mastery - new_mastery
        message = f"掌握度下降 {delta:.1%}"
    else:
        message = "掌握度保持稳定"
    
    if error_count >= 3:
        message += "，建议加强练习"
    elif correct_rate >= 0.9:
        message += "，表现优秀"
    
    return MasteryCalculation(
        new_mastery=round(new_mastery, 3),
        status=status,
        review_due_at=review_due_at,
        mastery_breakdown=breakdown,
        message=message
    )


# ============================================
# 二、遗忘曲线模型
# ============================================

def ebbinghaus_decay(initial_mastery: float, days_elapsed: float, stability: float = STABILITY_FACTOR) -> float:
    """
    艾宾浩斯遗忘曲线计算
    
    公式: current_mastery = initial_mastery * e^(-days_elapsed / (stability * constant))
    
    Args:
        initial_mastery: 初始掌握度（上一次复习时的掌握度）
        days_elapsed: 距离上次复习的天数
        stability: 稳定因子 (默认 7.0, 越大遗忘越慢)
    
    Returns:
        当前应该有的掌握度
    """
    if days_elapsed <= 0:
        return initial_mastery
    
    # 衰减率随稳定因子调整
    decay_rate = EBBINGHAUS_DECAY_BASE / (stability / STABILITY_FACTOR)
    
    # 遗忘曲线
    current_mastery = initial_mastery * math.exp(-decay_rate * days_elapsed / stability)
    
    return max(0.0, current_mastery)


def calculate_decay_from_last_study(
    current_mastery: float,
    last_studied_at: Optional[str],
) -> float:
    """
    计算基于学习时间的遗忘调整
    
    Returns:
        调整后的掌握度
    """
    if not last_studied_at:
        return current_mastery
    
    try:
        last_time = datetime.fromisoformat(last_studied_at.replace("Z", "+00:00"))
        days_elapsed = (datetime.now() - last_time).total_seconds() / 86400
        days_elapsed = max(0, days_elapsed)
    except (ValueError, TypeError):
        return current_mastery
    
    # 使用遗忘曲线计算当前掌握度
    return ebbinghaus_decay(current_mastery, days_elapsed)


def calculate_review_due_with_decay(
    mastery: float,
    last_mastery: float,
    last_studied_at: Optional[str],
) -> str:
    """
    计算下次复习时间（基于遗忘曲线）
    
    复习时机: 当当前掌握度 < 初始掌握度 * 0.7 时需要复习
    """
    # 计算遗忘后的掌握度
    if last_studied_at:
        try:
            last_time = datetime.fromisoformat(last_studied_at.replace("Z", "+00:00"))
            days_elapsed = (datetime.now() - last_time).total_seconds() / 86400
            days_elapsed = max(0, days_elapsed)
            mastery_after_decay = ebbinghaus_decay(last_mastery, days_elapsed)
        except (ValueError, TypeError):
            mastery_after_decay = last_mastery
    else:
        mastery_after_decay = mastery
    
    # 确定复习间隔
    if mastery >= 0.9:
        interval_days = 60  # 掌握好，间隔长
    elif mastery >= 0.8:
        interval_days = 30
    elif mastery >= 0.7:
        interval_days = 15
    elif mastery >= 0.5:
        interval_days = 7
    elif mastery >= 0.3:
        interval_days = 3
    else:
        interval_days = 1  # 掌握差，频繁复习
    
    # 如果遗忘后低于 70%，提前复习
    if mastery_after_decay < last_mastery * 0.7:
        interval_days = max(1, interval_days // 2)
    
    due_date = datetime.now() + timedelta(days=interval_days)
    return due_date.isoformat() + "Z"


def get_optimal_review_intervals(mastery: float) -> list[int]:
    """
    获取最佳复习间隔序列（基于艾宾浩斯）
    
    Returns:
        [1, 2, 4, 7, 15, 30, 60, 90] 等间隔序列
    """
    if mastery >= 0.9:
        return REVIEW_INTERVALS[-4:]  # 长间隔
    elif mastery >= 0.7:
        return REVIEW_INTERVALS[-6:]
    elif mastery >= 0.5:
        return REVIEW_INTERVALS[-5:]
    else:
        return REVIEW_INTERVALS[:5]  # 短间隔


# ============================================
# 三、题目区分度加权计算
# ============================================

def calculate_difficulty_weight(difficulty: int) -> float:
    """
    计算题目难度权重
    
    公式: weight = base_weight * (1 + (difficulty - 5) * 0.1)
    """
    base = DIFFICULTY_WEIGHTS.get(difficulty, 1.0)
    return base


def calculate_discrimination_weight(
    question_discrimination: float,
    difficulty: int,
) -> float:
    """
    计算区分度权重
    
    区分度高的题目更能区分学习者水平
    区分度范围: -1 到 1, 通常 0.3 以上为良好
    
    Args:
        question_discrimination: 题目区分度指数
        difficulty: 题目难度 (1-10)
    
    Returns:
        加权后的权重
    """
    # 基础难度权重
    base_weight = calculate_difficulty_weight(difficulty)
    
    # 区分度调整因子
    # 区分度 > 0.3: 权重 * 1.2
    # 区分度 > 0.5: 权重 * 1.4
    # 区分度 < 0: 可能存在问题，权重 * 0.5
    if question_discrimination >= 0.5:
        discrimination_factor = 1.4
    elif question_discrimination >= 0.3:
        discrimination_factor = 1.2
    elif question_discrimination >= 0:
        discrimination_factor = 1.0
    else:
        discrimination_factor = 0.5  # 负区分度题目降低权重
    
    return base_weight * discrimination_factor


def calculate_weighted_correct_rate(exercise_results: list[ExerciseResult]) -> dict:
    """
    计算加权正确率及详细统计
    
    Returns:
        包含多种统计的字典
    """
    if not exercise_results:
        return {
            "simple": {"correct": 0, "total": 0, "rate": 0},
            "medium": {"correct": 0, "total": 0, "rate": 0},
            "hard": {"correct": 0, "total": 0, "rate": 0},
            "overall": {"correct": 0, "total": 0, "rate": 0, "weighted_rate": 0}
        }
    
    simple = [r for r in exercise_results if r.difficulty <= 3]
    medium = [r for r in exercise_results if 4 <= r.difficulty <= 6]
    hard = [r for r in exercise_results if r.difficulty >= 7]
    
    def calc_stats(results):
        if not results:
            return {"correct": 0, "total": 0, "rate": 0}
        c = sum(1 for r in results if r.correct)
        return {"correct": c, "total": len(results), "rate": c / len(results)}
    
    # 加权正确率
    weighted_correct = sum(
        calculate_discrimination_weight(r.correct, r.difficulty)
        for r in exercise_results if r.correct
    )
    weighted_total = sum(
        calculate_discrimination_weight(0.5, r.difficulty)  # 用中等区分度作为基准
        for r in exercise_results
    )
    
    return {
        "simple": calc_stats(simple),
        "medium": calc_stats(medium),
        "hard": calc_stats(hard),
        "overall": {
            "correct": sum(1 for r in exercise_results if r.correct),
            "total": len(exercise_results),
            "rate": sum(1 for r in exercise_results if r.correct) / len(exercise_results),
            "weighted_rate": weighted_correct / weighted_total if weighted_total > 0 else 0
        }
    }


def calculate_cognitive_level_mastery(
    cognitive_results: dict[str, list[ExerciseResult]]
) -> dict[str, float]:
    """
    计算各认知层级的掌握度
    
    Args:
        cognitive_results: { "remember": [...], "understand": [...], ... }
    
    Returns:
        各层级掌握度字典
    """
    level_mastery = {}
    
    for level, results in cognitive_results.items():
        if not results:
            level_mastery[level] = 0.0
            continue
        
        correct_count = sum(1 for r in results if r.correct)
        rate = correct_count / len(results)
        
        # 考虑时间效率（正常速度作答更有说服力）
        avg_time = sum(r.time_spent for r in results) / len(results)
        if avg_time < 10:  # 太快，可能是猜题
            rate *= 0.8
        elif avg_time > 600:  # 太慢，可能不理解
            rate *= 0.9
        
        level_mastery[level] = round(min(1.0, rate), 3)
    
    return level_mastery


def calculate_bloom_weighted_mastery(cognitive_results: dict[str, list[ExerciseResult]]) -> float:
    """
    计算布鲁姆加权掌握度
    
    高阶认知能力（分析、评价、创造）权重更高
    """
    level_mastery = calculate_cognitive_level_mastery(cognitive_results)
    
    weighted_sum = sum(
        level_mastery.get(level, 0) * weight
        for level, weight in COGNITIVE_WEIGHTS.items()
    )
    
    return round(weighted_sum, 3)


# ============================================
# 四、便捷函数
# ============================================

def estimate_mastery_from_exercises(
    exercises: list[dict],
    attempts: list[dict],
) -> float:
    """
    从练习数据估算掌握度（简化接口）
    
    Args:
        exercises: 练习题列表，每项包含 difficulty
        attempts: 尝试记录，每项包含 is_correct, difficulty, time_spent
    
    Returns:
        估算的掌握度
    """
    if not attempts:
        return 0.0
    
    results = [
        ExerciseResult(
            correct=a.get("is_correct", False),
            difficulty=a.get("difficulty", exercises[0].get("difficulty", 5) if exercises else 5),
            time_spent=a.get("time_spent", 60),
        )
        for a in attempts
    ]
    
    return calculate_mastery(
        current_mastery=0.0,
        exercise_results=results,
        study_minutes=sum(r.time_spent for r in results) / 60,
        attempt_count=len(attempts)
    )


def simulate_learning_session(
    initial_mastery: float,
    exercises_count: int = 10,
    difficulty: int = 5,
) -> MasteryCalculation:
    """
    模拟一次学习会话（用于测试）
    """
    # 模拟练习结果
    results = []
    for _ in range(exercises_count):
        # 基于初始掌握度生成正确率
        prob_correct = initial_mastery + random.uniform(-0.2, 0.2)
        prob_correct = max(0.1, min(0.95, prob_correct))
        
        results.append(ExerciseResult(
            correct=random.random() < prob_correct,
            difficulty=difficulty + random.randint(-1, 1),
            time_spent=random.uniform(30, 180),
            guess_flag=random.random() < 0.1
        ))
    
    return calculate_mastery_with_breakdown(
        current_mastery=initial_mastery,
        exercise_results=results,
        study_minutes=sum(r.time_spent for r in results) / 60,
        attempt_count=len(results),
        last_mastery=initial_mastery,
        last_studied_at=datetime.now().isoformat() + "Z"
    )
