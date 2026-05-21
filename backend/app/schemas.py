from typing import Literal

from pydantic import BaseModel, Field


ProgressStatus = Literal["not_started", "learning", "mastered", "weak"]


class KnowledgeNode(BaseModel):
    id: str
    name: str
    category: str
    description: str
    difficulty: int = Field(ge=1, le=5)
    tags: list[str] = []


class KnowledgeEdge(BaseModel):
    source: str
    target: str
    type: Literal["contains", "prerequisite", "related", "used_in", "error_caused_by"]
    label: str


class LearningMetrics(BaseModel):
    mastery: float = Field(default=0, ge=0, le=1)
    confidence: float = Field(default=0, ge=0, le=1)
    studyMinutes: int = Field(default=0, ge=0)
    attemptCount: int = Field(default=0, ge=0)
    correctRate: float = Field(default=0, ge=0, le=1)
    errorCount: int = Field(default=0, ge=0)
    streakDays: int = Field(default=0, ge=0)
    lastActivityAt: str | None = None
    reviewDueAt: str | None = None


class ProgressUpdate(BaseModel):
    nodeId: str
    status: ProgressStatus
    score: int = Field(default=0, ge=0, le=100)
    metrics: LearningMetrics = Field(default_factory=LearningMetrics)
