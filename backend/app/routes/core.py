from fastapi import APIRouter

from ..storage import (
    code_analysis_rules,
    code_examples,
    contents,
    edges,
    exercises,
    nodes,
    progress_store,
    recommendation_seeds,
)

router = APIRouter(tags=["基础接口"])


@router.get("/api/health")
def health():
    return {"status": "ok", "service": "AlgoMotion API"}


@router.get("/api/bootstrap")
def bootstrap():
    return {
        "nodes": nodes(),
        "edges": edges(),
        "contents": contents(),
        "codeExamples": code_examples(),
        "exercises": exercises(),
        "progress": progress_store,
        "analysisRules": code_analysis_rules(),
        "recommendationConfig": recommendation_seeds(),
    }


@router.get("/api/exercises")
def get_exercises():
    return exercises()
