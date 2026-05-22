from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    nodeId: str | None = None
    history: list[ChatMessage] = Field(default_factory=list)


class CodeAnalysisRequest(BaseModel):
    code: str
    problem: str | None = None


class StudyArtifactRequest(BaseModel):
    sourceText: str
    title: str | None = None
    nodeId: str | None = None


class CodeGenerationRequest(BaseModel):
    prompt: str
    nodeId: str | None = None
    history: list[ChatMessage] = Field(default_factory=list)
