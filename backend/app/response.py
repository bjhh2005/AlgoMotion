"""
统一响应格式模块
提供一致的 API 响应结构和错误处理
"""
from typing import Any, Generic, TypeVar
from pydantic import BaseModel


T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """统一 API 响应格式"""
    success: bool
    data: T | None = None
    error: str | None = None


class ErrorResponse(BaseModel):
    """错误响应格式"""
    success: bool = False
    error: str
    detail: str | None = None


def success_response(data: T) -> dict[str, Any]:
    """成功响应"""
    return {"success": True, "data": data}


def error_response(error: str, detail: str | None = None) -> dict[str, Any]:
    """错误响应"""
    return {"success": False, "error": error, "detail": detail}
