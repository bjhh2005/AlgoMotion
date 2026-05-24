"""
Backend API regression tests.

Run from the repository root:
    python -m unittest discover -s backend/tests -p "test_*.py"

The tests keep progress and learning-record writes in memory, so they do not
modify the demo data under data/learning-content.
"""
from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from app import learning_records, storage  # noqa: E402
from app.main import app  # noqa: E402


def _success_payload(response):
    data = response.json()
    assert data.get("success") is True, data
    return data["data"]


class BackendApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.nodes = storage.nodes()
        cls.edges = storage.edges()
        cls.exercises = storage.exercises()
        cls.node_ids = {node["id"] for node in cls.nodes}
        cls.primary_node_id = "stack" if "stack" in cls.node_ids else cls.nodes[0]["id"]
        cls.choice_problem_id = "ex-stack-choice-001"
        cls.programming_problem_id = "ex-stack-001"

    def setUp(self):
        self._progress_snapshot = copy.deepcopy(storage.progress_store)
        self._exercise_log_snapshot = copy.deepcopy(learning_records.exercise_log)
        self._daily_snapshots_snapshot = copy.deepcopy(learning_records.daily_snapshots)

        self._patches = [
            patch("app.storage.write_json_atomic", lambda *args, **kwargs: None),
            patch("app.learning_records._write_json_safe", lambda *args, **kwargs: None),
            patch("app.ai_assistant.ai_settings", lambda: None),
        ]
        for item in self._patches:
            item.start()

        storage.progress_store.clear()
        storage.progress_store.update(copy.deepcopy(self._progress_snapshot))
        learning_records.exercise_log = copy.deepcopy(self._exercise_log_snapshot)
        learning_records.daily_snapshots = copy.deepcopy(self._daily_snapshots_snapshot)

    def tearDown(self):
        storage.progress_store.clear()
        storage.progress_store.update(self._progress_snapshot)
        learning_records.exercise_log = self._exercise_log_snapshot
        learning_records.daily_snapshots = self._daily_snapshots_snapshot

        for item in reversed(self._patches):
            item.stop()

    def test_health_bootstrap_and_exercises(self):
        health = self.client.get("/api/health")
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.json()["status"], "ok")

        bootstrap = self.client.get("/api/bootstrap")
        self.assertEqual(bootstrap.status_code, 200)
        payload = bootstrap.json()
        for key in [
            "nodes",
            "edges",
            "contents",
            "codeExamples",
            "exercises",
            "progress",
            "analysisRules",
            "recommendationConfig",
            "exerciseLog",
            "dailySnapshots",
        ]:
            self.assertIn(key, payload)
        self.assertGreater(len(payload["nodes"]), 0)
        self.assertGreater(len(payload["exercises"]), 0)

        exercises = self.client.get("/api/exercises")
        self.assertEqual(exercises.status_code, 200)
        self.assertEqual(len(exercises.json()), len(payload["exercises"]))

    def test_knowledge_legacy_endpoints(self):
        nodes = self.client.get("/api/knowledge/nodes")
        self.assertEqual(nodes.status_code, 200)
        self.assertIsInstance(nodes.json(), list)
        self.assertTrue(any(node["id"] == self.primary_node_id for node in nodes.json()))

        edges = self.client.get("/api/knowledge/edges")
        self.assertEqual(edges.status_code, 200)
        self.assertIsInstance(edges.json(), list)

        graph = self.client.get("/api/knowledge/graph")
        self.assertEqual(graph.status_code, 200)
        self.assertIn("nodes", graph.json())
        self.assertIn("edges", graph.json())

        detail = self.client.get(f"/api/knowledge/{self.primary_node_id}")
        self.assertEqual(detail.status_code, 200)
        body = detail.json()
        self.assertEqual(body["node"]["id"], self.primary_node_id)
        self.assertIn("content", body)
        self.assertIn("codeExamples", body)
        self.assertIn("relations", body)
        self.assertIn("exercises", body)

        missing = self.client.get("/api/knowledge/not-a-real-node")
        self.assertEqual(missing.status_code, 404)

    def test_progress_update_submit_and_analysis(self):
        metrics = {
            "mastery": 0.72,
            "confidence": 0.68,
            "studyMinutes": 35,
            "attemptCount": 4,
            "correctRate": 0.75,
            "errorCount": 1,
            "streakDays": 2,
        }
        update = self.client.post(
            f"/api/progress/{self.primary_node_id}",
            json={"nodeId": self.primary_node_id, "status": "learning", "score": 78, "metrics": metrics},
        )
        self.assertEqual(update.status_code, 200)
        data = _success_payload(update)
        self.assertTrue(data["updated"])
        self.assertEqual(data["nodeId"], self.primary_node_id)
        self.assertIn("reviewDueAt", data)

        current = _success_payload(self.client.get(f"/api/progress/{self.primary_node_id}"))
        self.assertEqual(current[self.primary_node_id]["score"], 78)

        submit = self.client.post(
            "/api/progress/submit",
            json={
                "node_id": self.primary_node_id,
                "score": 88,
                "exercises": [
                    {"correct": True, "difficulty": 4, "time_spent": 42, "cognitive_level": "apply", "guess": False},
                    {"correct": False, "difficulty": 6, "time_spent": 120, "cognitive_level": "analyze", "guess": False},
                ],
            },
        )
        self.assertEqual(submit.status_code, 200)
        submission_data = _success_payload(submit)
        self.assertEqual(submission_data["nodeId"], self.primary_node_id)
        self.assertIn("newMastery", submission_data)
        self.assertIn("weightedStats", submission_data)
        self.assertEqual(len(learning_records.exercise_log), len(self._exercise_log_snapshot) + 2)

        analysis = _success_payload(self.client.get(f"/api/progress/analysis/{self.primary_node_id}"))
        self.assertEqual(analysis["nodeId"], self.primary_node_id)
        self.assertIn("masteryAfterDecay", analysis)
        self.assertIn("optimalReviewIntervals", analysis)

    def test_progress_validation_errors(self):
        bad_id = self.client.get("/api/progress/bad id")
        self.assertEqual(bad_id.status_code, 400)

        missing = self.client.get("/api/progress/not-a-real-node")
        self.assertEqual(missing.status_code, 404)

        invalid_body = self.client.post(
            f"/api/progress/{self.primary_node_id}",
            json={"nodeId": self.primary_node_id, "status": "done", "score": 120, "metrics": {}},
        )
        self.assertEqual(invalid_body.status_code, 422)

    def test_recommendation_endpoints(self):
        response = self.client.get("/api/recommendations", params={"type": "path", "node_id": self.primary_node_id, "limit": 4})
        self.assertEqual(response.status_code, 200)
        path_items = _success_payload(response)
        self.assertGreater(len(path_items), 0)
        self.assertLessEqual(len(path_items), 4)
        self.assertIn("id", path_items[0])
        self.assertIn("priority", path_items[0])

        next_items = _success_payload(
            self.client.get("/api/recommendations", params={"type": "next", "node_id": self.primary_node_id, "limit": 5})
        )
        self.assertGreater(len(next_items), 0)

        invalid = self.client.get("/api/recommendations", params={"type": "unknown"})
        self.assertEqual(invalid.status_code, 400)

        legacy = self.client.get("/api/recommendations/me")
        self.assertEqual(legacy.status_code, 200)
        self.assertIn("recommended", legacy.json())

        v2 = self.client.post("/api/recommendations/v2", json={"current_node_id": self.primary_node_id, "count": 3})
        self.assertEqual(v2.status_code, 200)
        v2_data = _success_payload(v2)
        self.assertIn("recommendations", v2_data)
        self.assertLessEqual(len(v2_data["recommendations"]), 3)

    def test_analytics_endpoints_and_exports(self):
        report = _success_payload(self.client.get("/api/analytics/report"))
        self.assertIn("overview", report)
        self.assertIn("cognitive_mastery", report)
        self.assertIn("behavior_analyses", report)
        self.assertIn("motivation_index", report)

        trend = _success_payload(self.client.get("/api/analytics/trend", params={"days": 5}))
        self.assertEqual(trend["days"], 5)
        self.assertEqual(len(trend["trend"]), 5)
        self.assertIn("summary", trend)

        cognitive = _success_payload(self.client.get(f"/api/analytics/cognitive/{self.primary_node_id}"))
        self.assertEqual(cognitive["node_id"], self.primary_node_id)
        self.assertIn("level_mastery", cognitive)

        weak = _success_payload(self.client.get("/api/analytics/weak", params={"threshold": 1}))
        self.assertIsInstance(weak, list)

        export_json = self.client.get("/api/analytics/report/export", params={"format": "json"})
        self.assertEqual(export_json.status_code, 200)
        self.assertIn("attachment", export_json.headers["content-disposition"])
        self.assertIn("overview", json.loads(export_json.text))

        export_md = self.client.get("/api/analytics/report/export", params={"format": "markdown"})
        self.assertEqual(export_md.status_code, 200)
        self.assertIn("text/markdown", export_md.headers["content-type"])

        export_html = self.client.get("/api/analytics/report/export", params={"format": "html"})
        self.assertEqual(export_html.status_code, 200)
        self.assertIn("text/html", export_html.headers["content-type"])
        self.assertIn("<html", export_html.text.lower())

    def test_ai_fallback_endpoints(self):
        chat = self.client.post(
            "/api/ai/chat",
            json={"message": "stack 的典型应用是什么？", "nodeId": self.primary_node_id, "history": []},
        )
        self.assertEqual(chat.status_code, 200)
        chat_data = chat.json()
        self.assertIn("answer", chat_data)
        self.assertIn("linkedNodes", chat_data)
        self.assertIn("nodeCards", chat_data)
        self.assertIn("learningActions", chat_data)

        empty_chat = self.client.post("/api/ai/chat", json={"message": "   "})
        self.assertEqual(empty_chat.status_code, 400)

        analysis = self.client.post(
            "/api/ai/code-analysis",
            json={"code": "#include <stack>\nstd::stack<int> s; s.push(1);", "problem": "括号匹配"},
        )
        self.assertEqual(analysis.status_code, 200)
        analysis_data = analysis.json()
        self.assertIn("summary", analysis_data)
        self.assertIn("linkedNodes", analysis_data)
        self.assertGreater(len(analysis_data["linkedNodes"]), 0)

        artifacts = self.client.post(
            "/api/ai/study-artifacts",
            json={"sourceText": "栈是后进先出的线性结构，常用于递归和括号匹配。", "nodeId": self.primary_node_id},
        )
        self.assertEqual(artifacts.status_code, 200)
        self.assertIn("quiz", artifacts.json())

        code = self.client.post(
            "/api/ai/code-generation",
            json={"prompt": "生成括号匹配的 C++ 代码", "nodeId": self.primary_node_id, "history": []},
        )
        self.assertEqual(code.status_code, 200)
        code_data = code.json()
        self.assertEqual(code_data["language"], "cpp")
        self.assertIn("code", code_data)

    def test_oj_problem_choice_tag_and_judge_interfaces(self):
        tags = self.client.get("/api/git_tag")
        self.assertEqual(tags.status_code, 200)
        self.assertIn("stack", tags.json())

        tag_search = self.client.get("/api/search_tag", params={"tag": "stack"})
        self.assertEqual(tag_search.status_code, 200)
        self.assertTrue(any(item["id"] == self.programming_problem_id for item in tag_search.json()["problems"]))

        problem = self.client.get(f"/api/get_problem_data/{self.choice_problem_id}")
        self.assertEqual(problem.status_code, 200)
        problem_data = problem.json()
        self.assertEqual(problem_data["id"], self.choice_problem_id)
        self.assertEqual(problem_data["type"], "choice")

        correct = self.client.post(
            f"/api/check_S&C_ans/{self.choice_problem_id}",
            json={"problem_id": self.choice_problem_id, "answer": "B"},
        )
        self.assertEqual(correct.status_code, 200)
        self.assertTrue(correct.json()["status"])

        wrong_problem_id = self.client.post(
            f"/api/check_S&C_ans/{self.choice_problem_id}",
            json={"problem_id": "other-id", "answer": "B"},
        )
        self.assertEqual(wrong_problem_id.status_code, 200)
        self.assertEqual(wrong_problem_id.json()["id"], "Error")

        def fake_run(args, **kwargs):
            if any(str(arg).endswith("judge.sh") for arg in args):
                return SimpleNamespace(
                    stdout='{"status":"Accepted","total_cases":1,"passed_cases":1,"details":[{"status":"Accepted","time":0.001}]}',
                    stderr="",
                    returncode=0,
                )
            return SimpleNamespace(stdout="", stderr="", returncode=0)

        with patch("app.routes.oj.subprocess.run", side_effect=fake_run):
            judge = self.client.post(
                "/api/judge",
                json={
                    "submission_id": "sub-test",
                    "problem_id": "stack-001",
                    "code": "int main(){return 0;}",
                    "time_limit": 2,
                    "mem_limit": 256,
                },
            )
        self.assertEqual(judge.status_code, 200)
        self.assertEqual(judge.json()["status"], "Accepted")


class BackendUtilityTestCase(unittest.TestCase):
    def test_data_files_have_cross_reference_integrity(self):
        node_ids = {node["id"] for node in storage.nodes()}

        for edge in storage.edges():
            self.assertIn(edge["source"], node_ids)
            self.assertIn(edge["target"], node_ids)

        for content in storage.contents():
            self.assertIn(content["nodeId"], node_ids)

        for example in storage.code_examples():
            self.assertIn(example["nodeId"], node_ids)

        for exercise in storage.exercises():
            self.assertIn(exercise["nodeId"], node_ids)
            for linked_id in exercise.get("linkedNodeIds", []):
                self.assertIn(linked_id, node_ids)

    def test_validator_helpers(self):
        from app.validators import validate_cognitive_level, validate_mastery, validate_node_id, validate_score

        self.assertTrue(validate_node_id("binary-search"))
        self.assertTrue(validate_node_id("stack_01"))
        self.assertFalse(validate_node_id("bad id"))
        self.assertFalse(validate_node_id(""))

        self.assertTrue(validate_score(0))
        self.assertTrue(validate_score(100))
        self.assertFalse(validate_score(101))

        self.assertTrue(validate_mastery(0.5))
        self.assertFalse(validate_mastery(-0.1))
        self.assertFalse(validate_mastery(1.1))

        self.assertTrue(validate_cognitive_level("apply"))
        self.assertFalse(validate_cognitive_level("memorize"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
