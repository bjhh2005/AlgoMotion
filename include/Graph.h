#ifndef ALGOMOTION_GRAPH_H
#define ALGOMOTION_GRAPH_H

#include "DataStructure.h"
#include <set>

// 图 —— 邻接表实现（无向图），图结构的典型实现
class Graph : public DataStructure {
public:
    Graph();
    ~Graph() override;

    // --- DataStructure 接口 ---
    std::string GetName() const override;
    std::string GetDescription() const override;
    std::string GetCategory() const override;
    std::vector<GraphNode> GetAsGraph() const override;
    std::vector<Operation> GetOperations() const override;
    std::map<std::string, std::string> GetComplexity() const override;
    std::vector<std::string> GetRelatedTopics() const override;

    // 图操作
    void AddVertex(int v);
    void AddEdge(int u, int v);
    bool HasVertex(int v) const;
    bool HasEdge(int u, int v) const;

    // 遍历
    std::vector<int> BFS(int start) const;
    std::vector<int> DFS(int start) const;

    int  VertexCount() const { return static_cast<int>(adj_.size()); }
    int  EdgeCount() const { return edgeCount_; }

private:
    std::map<int, std::set<int>> adj_;
    int edgeCount_;

    void  DFSRec(int v, std::set<int>& visited, std::vector<int>& out) const;

    // GetAsGraph 辅助：将顶点排成圆形布局
    void  CircularLayout(std::vector<GraphNode>& out) const;
};

#endif
