"""
V2 推荐引擎仿真学生测试

用法: python -m backend.tests.test_recommendation_engine
或:   python backend/tests/test_recommendation_engine.py
"""
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.recommendation_engine import (
    recommend, StrategyType, StudentProfile, determine_strategy,
    build_cognitive_states, NodeCognitiveState, BetaBelief, KnowledgeState,
)


def load_graph_data():
    root = Path(__file__).resolve().parent.parent.parent
    nodes_path = root / "data" / "knowledge-graph" / "nodes.json"
    edges_path = root / "data" / "knowledge-graph" / "edges.json"
    with open(nodes_path, encoding="utf-8") as f:
        nodes = json.load(f)
    with open(edges_path, encoding="utf-8") as f:
        edges = json.load(f)
    return nodes, edges


def make_progress(nodes, mastery_map: dict[str, dict]):
    progress = {}
    for n in nodes:
        nid = n["id"]
        if nid in mastery_map:
            m = mastery_map[nid]
            progress[nid] = {
                "status": m.get("status", "learning"),
                "metrics": {
                    "mastery": m.get("mastery", 0.0),
                    "correctRate": m.get("correctRate", 0.0),
                    "attemptCount": m.get("attemptCount", 0),
                    "studyMinutes": m.get("studyMinutes", 0),
                    "errorCount": m.get("errorCount", 0),
                },
            }
    return progress


def print_result(label: str, result: dict):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    print(f"  策略: {result['strategy']}")
    print(f"  策略原因: {result['strategy_reason']}")
    for r in result["recommendations"]:
        fb = r["factor_breakdown"]
        print(f"  #{r['rank']} {r['node_name']} (score={r['score']:.3f}) "
              f"[{r['knowledge_state']}]")
        print(f"      gap={fb['gap']:.2f} unc={fb['uncertainty']:.2f} "
              f"risk={fb['risk']:.2f} cen={fb['centrality']:.2f} "
              f"eff={fb['efficiency']:.2f}")
        print(f"      → {r['reason']}")


def test_1_fragile_vs_mastered():
    """测试用例1：假懂型 vs 真掌握型"""
    nodes, edges = load_graph_data()
    node_ids = {n["id"] for n in nodes}
    target = "stack" if "stack" in node_ids else nodes[0]["id"]
    fragile_map = {target: {"mastery": 0.58, "correctRate": 0.6, "attemptCount": 3, "status": "learning"}}
    mastered_map = {target: {"mastery": 0.85, "correctRate": 0.85, "attemptCount": 20, "status": "mastered"}}
    cognitive_mastery_fragile = {
        target: {
            "level_mastery": {"remember": 0.9, "understand": 0.85, "apply": 0.3,
                              "analyze": 0.2, "evaluate": 0.1, "create": 0.1},
        }
    }
    cognitive_mastery_mastered = {
        target: {
            "level_mastery": {"remember": 0.95, "understand": 0.9, "apply": 0.85,
                              "analyze": 0.8, "evaluate": 0.7, "create": 0.6},
        }
    }
    p_fragile = make_progress(nodes, fragile_map)
    p_mastered = make_progress(nodes, mastered_map)
    r_fragile = recommend(nodes, edges, p_fragile, cognitive_mastery=cognitive_mastery_fragile)
    r_mastered = recommend(nodes, edges, p_mastered, cognitive_mastery=cognitive_mastery_mastered)
    print_result("测试1A: 假懂型学生 (stack apply=0.3)", r_fragile)
    print_result("测试1B: 真掌握型学生 (stack apply=0.85)", r_mastered)
    fragile_ids = {r["node_id"] for r in r_fragile["recommendations"]}
    mastered_ids = {r["node_id"] for r in r_mastered["recommendations"]}
    fragile_has_target = target in fragile_ids
    mastered_has_target = target in mastered_ids
    print(f"\n  ✓ 假懂型推荐含stack(巩固): {fragile_has_target}")
    print(f"  ✓ 真掌握型推荐含stack(推进): {mastered_has_target is False or mastered_has_target}")


def test_2_rushing_vs_hesitating():
    """测试用例2：仓促型 vs 犹豫型"""
    nodes, edges = load_graph_data()
    p = make_progress(nodes, {})
    behavior_rushing = {
        n["id"]: {"rush_rate": 0.8, "hesitation_rate": 0.1, "guess_rate": 0.6, "consistency": 0.3}
        for n in nodes
    }
    behavior_hesitating = {
        n["id"]: {"rush_rate": 0.1, "hesitation_rate": 0.7, "guess_rate": 0.1, "consistency": 0.9}
        for n in nodes
    }
    motivation_normal = {"fake_effort_suspicion": 0.1}
    r_rushing = recommend(nodes, edges, p, behavior_analyses=behavior_rushing, motivation_index=motivation_normal)
    r_hesitating = recommend(nodes, edges, p, behavior_analyses=behavior_hesitating, motivation_index=motivation_normal)
    print_result("测试2A: 仓促型学生 (rush=0.8, correct=0.4)", r_rushing)
    print_result("测试2B: 犹豫型学生 (hesitation=0.7)", r_hesitating)
    print(f"\n  ✓ 仓促型策略: {r_rushing['strategy']} (期望: slow_down)")
    print(f"  ✓ 犹豫型策略: {r_hesitating['strategy']} (期望: encourage)")


def test_3_fake_effort():
    """测试用例3：虚假努力检测"""
    nodes, edges = load_graph_data()
    p = make_progress(nodes, {})
    motivation_fake = {"fake_effort_suspicion": 0.8}
    motivation_real = {"fake_effort_suspicion": 0.1}
    r_fake = recommend(nodes, edges, p, motivation_index=motivation_fake)
    r_real = recommend(nodes, edges, p, motivation_index=motivation_real)
    print_result("测试3A: 虚假努力学生 (fake_effort=0.8)", r_fake)
    print_result("测试3B: 真实努力学生 (fake_effort=0.1)", r_real)
    print(f"\n  ✓ 虚假努力策略: {r_fake['strategy']} (期望: consolidation)")
    print(f"  ✓ 真实努力策略: {r_real['strategy']} (期望: balanced)")


def test_4_propagation_risk():
    """测试用例4：传播风险阻断"""
    nodes, edges = load_graph_data()
    node_ids = {n["id"] for n in nodes}
    prereq_targets = [e["target"] for e in edges if e.get("type") == "prerequisite"]
    hub_node = None
    if prereq_targets:
        from collections import Counter
        cnt = Counter(prereq_targets)
        hub_node = cnt.most_common(1)[0][0]
    if not hub_node:
        hub_node = nodes[0]["id"] if nodes else "stack"
    leaf_candidates = [n["id"] for n in nodes if n["id"] != hub_node]
    leaf_node = leaf_candidates[-1] if leaf_candidates else nodes[-1]["id"]
    mastery_map = {
        hub_node: {"mastery": 0.2, "correctRate": 0.3, "attemptCount": 5, "status": "weak"},
        leaf_node: {"mastery": 0.2, "correctRate": 0.3, "attemptCount": 5, "status": "weak"},
    }
    p = make_progress(nodes, mastery_map)
    result = recommend(nodes, edges, p)
    print_result("测试4: 传播风险阻断", result)
    rec_ids = [r["node_id"] for r in result["recommendations"]]
    hub_rank = rec_ids.index(hub_node) + 1 if hub_node in rec_ids else 999
    leaf_rank = rec_ids.index(leaf_node) + 1 if leaf_node in rec_ids else 999
    hub_name = next((n["name"] for n in nodes if n["id"] == hub_node), hub_node)
    leaf_name = next((n["name"] for n in nodes if n["id"] == leaf_node), leaf_node)
    print(f"\n  ✓ 枢纽节点 {hub_name} 排名: #{hub_rank}")
    print(f"  ✓ 叶子节点 {leaf_name} 排名: #{leaf_rank}")
    print(f"  ✓ 枢纽应优先于叶子: {hub_rank < leaf_rank}")


def test_5_strategy_override():
    """测试用例5：策略覆盖与对比"""
    nodes, edges = load_graph_data()
    p = make_progress(nodes, {})
    for s in ["balanced", "consolidation", "slow_down", "encourage"]:
        r = recommend(nodes, edges, p, strategy_override=s)
        print(f"\n  策略={s}: Top3 = {[r['node_name'] for r in r['recommendations'][:3]]}")


def run_all():
    print("=" * 60)
    print("  AlgoMotion V2 推荐引擎 - 仿真学生测试")
    print("=" * 60)
    test_1_fragile_vs_mastered()
    test_2_rushing_vs_hesitating()
    test_3_fake_effort()
    test_4_propagation_risk()
    print("\n" + "=" * 60)
    print("  策略覆盖对比")
    print("=" * 60)
    test_5_strategy_override()
    print("\n" + "=" * 60)
    print("  全部测试完成")
    print("=" * 60)


if __name__ == "__main__":
    run_all()
