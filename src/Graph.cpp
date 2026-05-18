#include "Graph.h"
#include <queue>
#include <cmath>
#include <sstream>

// ========== 构造 / 析构 ==========

Graph::Graph() : edgeCount_(0) {}
Graph::~Graph() = default;

// ========== DataStructure 接口 ==========

std::string Graph::GetName() const {
    return "图 (Graph)";
}

std::string Graph::GetDescription() const {
    return "图是由顶点集合 V 和边集合 E 组成的数据结构，"
           "用于表示对象之间的多对多关系。"
           "本实现使用邻接表存储，支持无向图的基本操作"
           "和 BFS/DFS 遍历。";
}

std::string Graph::GetCategory() const {
    return "graph";
}

std::vector<GraphNode> Graph::GetAsGraph() const {
    std::vector<GraphNode> nodes;
    CircularLayout(nodes);

    // 添加边信息（在节点之间的中点标注）
    for (const auto& [vertex, neighbors] : adj_) {
        for (int neighbor : neighbors) {
            if (vertex < neighbor) {  // 每条无向边只画一次
                // 边用占位形状表示，实际前端会渲染连线
                nodes.push_back({0, 0, "##0003",
                                 std::to_string(vertex) + "-" +
                                 std::to_string(neighbor)});
            }
        }
    }
    return nodes;
}

std::vector<Operation> Graph::GetOperations() const {
    return {
        {"添加顶点 (AddVertex)",
         "向图中添加一个新顶点，O(1)。",
         "O(1)",
         "void AddVertex(int v) {\n"
         "    if (adj_.count(v)) return;\n"
         "    adj_[v] = std::set<int>();\n"
         "}"},

        {"添加边 (AddEdge)",
         "在 u 和 v 之间添加无向边，O(log V)。",
         "O(log V)",
         "void AddEdge(int u, int v) {\n"
         "    AddVertex(u); AddVertex(v);\n"
         "    adj_[u].insert(v);\n"
         "    adj_[v].insert(u);\n"
         "    edgeCount_++;\n"
         "}"},

        {"BFS",
         "广度优先遍历，使用队列实现，时间 O(V+E)。",
         "O(V+E)",
         "std::vector<int> BFS(int start) const;\n"
         "// 使用队列，按层遍历"},

        {"DFS",
         "深度优先遍历，使用递归/栈实现，时间 O(V+E)。",
         "O(V+E)",
         "std::vector<int> DFS(int start) const;\n"
         "// 递归深入，标记已访问节点"}
    };
}

std::map<std::string, std::string> Graph::GetComplexity() const {
    return {
        {"添加顶点", "O(1)"},
        {"添加边",     "O(log V)"},
        {"BFS",           "O(V+E)"},
        {"DFS",           "O(V+E)"},
        {"空间",         "O(V+E)"}
    };
}

std::vector<std::string> Graph::GetRelatedTopics() const {
    return {"adjacency_matrix", "directed_graph", "weighted_graph",
            "mst", "shortest_path"};
}

// ========== 图操作 ==========

void Graph::AddVertex(int v) {
    if (adj_.count(v)) return;
    adj_[v] = std::set<int>();
}

void Graph::AddEdge(int u, int v) {
    AddVertex(u);
    AddVertex(v);
    if (adj_[u].insert(v).second) {
        adj_[v].insert(u);
        edgeCount_++;
    }
}

bool Graph::HasVertex(int v) const {
    return adj_.count(v) > 0;
}

bool Graph::HasEdge(int u, int v) const {
    auto it = adj_.find(u);
    if (it == adj_.end()) return false;
    return it->second.count(v) > 0;
}

std::vector<int> Graph::BFS(int start) const {
    std::vector<int> result;
    if (!adj_.count(start)) return result;
    std::set<int> visited;
    std::queue<int> q;
    visited.insert(start);
    q.push(start);
    while (!q.empty()) {
        int v = q.front(); q.pop();
        result.push_back(v);
        for (int nxt : adj_.at(v)) {
            if (!visited.count(nxt)) {
                visited.insert(nxt);
                q.push(nxt);
            }
        }
    }
    return result;
}

std::vector<int> Graph::DFS(int start) const {
    std::vector<int> result;
    if (!adj_.count(start)) return result;
    std::set<int> visited;
    DFSRec(start, visited, result);
    return result;
}

void Graph::DFSRec(int v, std::set<int>& visited, std::vector<int>& out) const {
    visited.insert(v);
    out.push_back(v);
    for (int nxt : adj_.at(v)) {
        if (!visited.count(nxt)) {
            DFSRec(nxt, visited, out);
        }
    }
}

// ========== 圆形布局 ==========

void Graph::CircularLayout(std::vector<GraphNode>& out) const {
    int n = static_cast<int>(adj_.size());
    if (n == 0) return;
    double cx = 350.0, cy = 250.0, r = 180.0;
    int idx = 0;
    for (const auto& [vertex, _] : adj_) {
        double angle = 2.0 * 3.1415926535 * idx / n - 3.1415926535 / 2.0;
        double x = cx + r * std::cos(angle);
        double y = cy + r * std::sin(angle);
        out.push_back({x, y, "Circle", std::to_string(vertex)});
        ++idx;
    }
}
