"""
验证工具模块
提供输入验证和安全检查函数
"""
import re
from typing import Any


def validate_node_id(node_id: str) -> bool:
    """验证知识点 ID 格式"""
    if not node_id:
        return False
    # 允许字母、数字、短横线、下划线
    return bool(re.match(r"^[a-zA-Z0-9_-]+$", node_id))


def validate_score(score: int | float) -> bool:
    """验证分数范围"""
    return 0 <= score <= 100


def validate_mastery(mastery: float) -> bool:
    """验证掌握度范围"""
    return 0 <= mastery <= 1


def validate_cognitive_level(level: str) -> bool:
    """验证认知层级"""
    valid_levels = {"remember", "understand", "apply", "analyze", "evaluate", "create"}
    return level in valid_levels


def sanitize_string(value: str, max_length: int = 1000) -> str:
    """清理字符串输入，防止 XSS"""
    if not value:
        return ""
    # 移除危险字符，限制长度
    sanitized = value.strip()[:max_length]
    return sanitized


def validate_pagination(page: int | None, page_size: int | None) -> tuple[int, int]:
    """验证并规范化分页参数"""
    page = max(1, page or 1)
    page_size = min(100, max(1, page_size or 20))
    return page, page_size
