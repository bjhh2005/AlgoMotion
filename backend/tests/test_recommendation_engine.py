"""
V2 recommendation engine tests.

Run from the repository root:
    python -m unittest backend.tests.test_recommendation_engine
"""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.recommendation_engine import (  # noqa: E402
    BetaBelief,
    KnowledgeState,
    NodeCognitiveState,
    StrategyType,
    StudentProfile,
    build_cognitive_states,
    determine_strategy,
    recommend,
)


def load_graph_data():
    nodes_path = ROOT_DIR / "data" / "knowledge-graph" / "nodes.json"
    edges_path = ROOT_DIR / "data" / "knowledge-graph" / "edges.json"
    with nodes_path.open(encoding="utf-8") as file:
        nodes = json.load(file)
    with edges_path.open(encoding="utf-8") as file:
        edges = json.load(file)
    return nodes, edges


def make_progress(nodes, mastery_map: dict[str, dict]):
    progress = {}
    for node in nodes:
        node_id = node["id"]
        if node_id not in mastery_map:
            continue
        metrics = mastery_map[node_id]
        progress[node_id] = {
            "status": metrics.get("status", "learning"),
            "metrics": {
                "mastery": metrics.get("mastery", 0.0),
                "confidence": metrics.get("confidence", metrics.get("mastery", 0.0)),
                "correctRate": metrics.get("correctRate", 0.0),
                "attemptCount": metrics.get("attemptCount", 0),
                "studyMinutes": metrics.get("studyMinutes", 0),
                "errorCount": metrics.get("errorCount", 0),
            },
        }
    return progress


class RecommendationEngineTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.nodes, cls.edges = load_graph_data()
        cls.node_ids = {node["id"] for node in cls.nodes}
        cls.target = "stack" if "stack" in cls.node_ids else cls.nodes[0]["id"]

    def test_beta_belief_and_knowledge_state_classification(self):
        belief = BetaBelief(alpha=9, beta=3)
        self.assertAlmostEqual(belief.expected, 0.75)
        self.assertGreater(belief.variance, 0)

        fragile = NodeCognitiveState()
        fragile.bloom_beliefs["understand"] = BetaBelief(alpha=11, beta=1)
        fragile.bloom_beliefs["apply"] = BetaBelief(alpha=2, beta=10)
        self.assertEqual(fragile.classify(), KnowledgeState.FRAGILE)

        mastered = NodeCognitiveState()
        mastered.bloom_beliefs["apply"] = BetaBelief(alpha=18, beta=2)
        mastered.bloom_beliefs["analyze"] = BetaBelief(alpha=14, beta=4)
        self.assertEqual(mastered.classify(), KnowledgeState.TRULY_MASTERED)

    def test_build_cognitive_states_uses_bloom_mastery_when_available(self):
        progress = make_progress(
            self.nodes,
            {self.target: {"mastery": 0.5, "correctRate": 0.5, "attemptCount": 4}},
        )
        cognitive_mastery = {
            self.target: {
                "level_mastery": {
                    "remember": 0.9,
                    "understand": 0.85,
                    "apply": 0.25,
                    "analyze": 0.2,
                    "evaluate": 0.1,
                    "create": 0.1,
                }
            }
        }

        states = build_cognitive_states(progress, cognitive_mastery)
        self.assertIn(self.target, states)
        self.assertLess(states[self.target].apply_expected, states[self.target].understand_expected)
        self.assertIn(states[self.target].classify(), {KnowledgeState.WEAK, KnowledgeState.FRAGILE})

    def test_determine_strategy_rules_and_override(self):
        self.assertEqual(
            determine_strategy(StudentProfile(fake_effort_suspicion=0.8)),
            StrategyType.CONSOLIDATION,
        )
        self.assertEqual(
            determine_strategy(StudentProfile(rush_rate=0.8, correct_rate=0.4)),
            StrategyType.SLOW_DOWN,
        )
        self.assertEqual(
            determine_strategy(StudentProfile(hesitation_rate=0.7, correct_rate=0.8)),
            StrategyType.ENCOURAGE,
        )
        self.assertEqual(
            determine_strategy(StudentProfile(), override="consolidation"),
            StrategyType.CONSOLIDATION,
        )

    def test_recommend_returns_ranked_items_with_expected_shape(self):
        progress = make_progress(
            self.nodes,
            {
                self.target: {
                    "mastery": 0.58,
                    "correctRate": 0.6,
                    "attemptCount": 3,
                    "status": "learning",
                }
            },
        )
        result = recommend(self.nodes, self.edges, progress, count=5)

        self.assertEqual(result["strategy"], "balanced")
        self.assertIn("student_profile", result)
        self.assertIn("category_groups", result)
        self.assertLessEqual(len(result["recommendations"]), 5)
        self.assertGreater(len(result["recommendations"]), 0)

        scores = [item["score"] for item in result["recommendations"]]
        self.assertEqual(scores, sorted(scores, reverse=True))
        first = result["recommendations"][0]
        for key in ["rank", "node_id", "node_name", "score", "factor_breakdown", "reason", "knowledge_state"]:
            self.assertIn(key, first)

    def test_recommend_strategy_inputs_change_strategy(self):
        progress = make_progress(self.nodes, {})
        behavior_rushing = {
            node["id"]: {"rush_rate": 0.8, "hesitation_rate": 0.1, "guess_rate": 0.6, "consistency": 0.3}
            for node in self.nodes
        }
        low_correct_progress = make_progress(
            self.nodes,
            {
                node["id"]: {
                    "mastery": 0.2,
                    "correctRate": 0.4,
                    "attemptCount": 5,
                    "status": "weak",
                }
                for node in self.nodes[:3]
            },
        )
        rushing = recommend(
            self.nodes,
            self.edges,
            low_correct_progress,
            behavior_analyses=behavior_rushing,
        )
        self.assertEqual(rushing["strategy"], "slow_down")

        behavior_hesitating = {
            node["id"]: {"rush_rate": 0.1, "hesitation_rate": 0.7, "guess_rate": 0.1, "consistency": 0.9}
            for node in self.nodes
        }
        hesitating = recommend(
            self.nodes,
            self.edges,
            progress,
            behavior_analyses=behavior_hesitating,
            motivation_index={"fake_effort_suspicion": 0.1},
        )
        self.assertEqual(hesitating["strategy"], "encourage")

        fake_effort = recommend(
            self.nodes,
            self.edges,
            progress,
            motivation_index={"fake_effort_suspicion": 0.8},
        )
        self.assertEqual(fake_effort["strategy"], "consolidation")

    def test_strategy_override_is_reflected_in_response(self):
        progress = make_progress(self.nodes, {})
        for strategy in ["balanced", "consolidation", "slow_down", "encourage"]:
            result = recommend(self.nodes, self.edges, progress, strategy_override=strategy)
            self.assertEqual(result["strategy"], strategy)

    def test_current_node_neighbors_can_be_recommended(self):
        progress = make_progress(
            self.nodes,
            {
                self.target: {
                    "mastery": 0.85,
                    "correctRate": 0.9,
                    "attemptCount": 12,
                    "status": "mastered",
                }
            },
        )
        outgoing_targets = [
            edge["target"]
            for edge in self.edges
            if edge.get("source") == self.target and edge.get("target") in self.node_ids
        ]
        if not outgoing_targets:
            self.skipTest(f"{self.target} has no outgoing graph neighbors")

        result = recommend(self.nodes, self.edges, progress, current_node_id=self.target, count=10)
        recommended_ids = {item["node_id"] for item in result["recommendations"]}
        self.assertTrue(recommended_ids & set(outgoing_targets))


if __name__ == "__main__":
    unittest.main(verbosity=2)
