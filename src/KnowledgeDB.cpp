#include "KnowledgeDB.h"
#include <algorithm>
#include <set>

KnowledgeDB::KnowledgeDB() {
    InitData();
}

void KnowledgeDB::InitData() {
    // TODO: 后续改为从 data/knowledge.json 加载（使用 jsoncpp）
    items_ = {
        // ---- 线性结构 ----
        {"linked_list",
         "链表 (Linked List)",
         "linear",
         "链表是一种线性数据结构，由一系列节点组成，每个节点包含数据域"
         "和指向下一个节点的指针。支持 O(1) 头插/头删，O(n) 随机访问。",
         {"array", "stack", "queue", "doubly_linked_list"},
         {{"头插", "O(1)"}, {"尾插", "O(n)"}, {"删除", "O(n)"},
          {"查找", "O(n)"}, {"空间", "O(n)"}}},

        {"array",
         "数组 (Array)",
         "linear",
         "数组是最基本的线性结构，元素在内存中连续存储，支持 O(1) 随机访问。",
         {"linked_list", "stack", "queue"},
         {{"访问", "O(1)"}, {"插入", "O(n)"}, {"删除", "O(n)"}, {"空间", "O(n)"}}},

        {"stack",
         "栈 (Stack)",
         "linear",
         "栈是一种后进先出 (LIFO) 的线性结构，只允许在栈顶进行插入和删除操作。",
         {"linked_list", "array", "queue"},
         {{"入栈", "O(1)"}, {"出栈", "O(1)"}, {"查看栈顶", "O(1)"}, {"空间", "O(n)"}}},

        {"queue",
         "队列 (Queue)",
         "linear",
         "队列是一种先进先出 (FIFO) 的线性结构，在队尾插入、队头删除。",
         {"linked_list", "array", "stack"},
         {{"入队", "O(1)"}, {"出队", "O(1)"}, {"查看队头", "O(1)"}, {"空间", "O(n)"}}},

        // ---- 树结构 ----
        {"binary_tree",
         "二叉搜索树 (BST)",
         "tree",
         "BST 的每个节点左子树值小于根节点，右子树值大于根节点。"
         "平均操作复杂度 O(log n)。",
         {"avl_tree", "red_black_tree", "heap", "tree_traversal"},
         {{"插入", "O(log n) avg"}, {"查找", "O(log n) avg"},
          {"删除", "O(log n) avg"}, {"遍历", "O(n)"}}},

        {"avl_tree",
         "AVL 树",
         "tree",
         "AVL 树是自平衡二叉搜索树，任意节点左右子树高度差不超过 1。",
         {"binary_tree", "red_black_tree"},
         {{"插入", "O(log n)"}, {"查找", "O(log n)"},
          {"删除", "O(log n)"}, {"空间", "O(n)"}}},

        {"red_black_tree",
         "红黑树",
         "tree",
         "红黑树是自平衡二叉搜索树，通过节点颜色维护近似平衡，C++ std::map 的底层实现。",
         {"binary_tree", "avl_tree"},
         {{"插入", "O(log n)"}, {"查找", "O(log n)"},
          {"删除", "O(log n)"}, {"空间", "O(n)"}}},

        {"heap",
         "堆 (Heap)",
         "tree",
         "堆是一种完全二叉树，满足堆序性质（大顶堆/小顶堆），常用于优先队列。",
         {"binary_tree", "priority_queue"},
         {{"插入", "O(log n)"}, {"取最值", "O(1)"},
          {"删除最值", "O(log n)"}, {"建堆", "O(n)"}}},

        // ---- 图结构 ----
        {"graph",
         "图 (Graph)",
         "graph",
         "图由顶点集和边集组成，用于表示多对多关系。邻接表是常用存储方式。",
         {"adjacency_matrix", "directed_graph", "mst", "shortest_path"},
         {{"添加顶点", "O(1)"}, {"添加边", "O(log V)"},
          {"BFS", "O(V+E)"}, {"DFS", "O(V+E)"}}},

        {"adjacency_matrix",
         "邻接矩阵",
         "graph",
         "使用 V×V 矩阵存储图，适合稠密图，O(1) 判断边是否存在。",
         {"graph", "weighted_graph"},
         {{"添加边", "O(1)"}, {"判断邻接", "O(1)"},
          {"空间", "O(V²)"}}},

        // ---- 算法 ----
        {"bubble_sort",
         "冒泡排序 (Bubble Sort)",
         "algorithm",
         "重复比较相邻元素并交换，每次遍历将最大元素冒泡到末尾。O(n²)，稳定排序。",
         {"linked_list", "array", "selection_sort", "insertion_sort"},
         {{"时间", "O(n²)"}, {"空间", "O(1)"}, {"稳定性", "稳定"}}},

        {"binary_search",
         "二分查找 (Binary Search)",
         "algorithm",
         "在有序序列中反复将查找区间减半定位目标。O(log n)。要求序列支持随机访问且已排序。",
         {"array", "bubble_sort"},
         {{"时间", "O(log n)"}, {"空间", "O(1)"}}},

        // ---- 遍历 ----
        {"tree_traversal",
         "树的遍历",
         "algorithm",
         "二叉树的三种深度优先遍历：前序(根左右)、中序(左根右)、后序(左右根)。",
         {"binary_tree", "graph"},
         {{"InOrder", "O(n)"}, {"PreOrder", "O(n)"}, {"PostOrder", "O(n)"}}},

        {"mst",
         "最小生成树 (MST)",
         "algorithm",
         "在连通带权无向图中找一棵边权和最小的生成树，常用 Prim 和 Kruskal 算法。",
         {"graph", "shortest_path"},
         {{"Prim", "O(V²) / O(E log V)"}, {"Kruskal", "O(E log E)"}}},

        {"shortest_path",
         "最短路径",
         "algorithm",
         "求图中两顶点间的最短路径，经典算法有 Dijkstra、Bellman-Ford、Floyd-Warshall。",
         {"graph", "mst"},
         {{"Dijkstra", "O(V²) / O(E log V)"}, {"Bellman-Ford", "O(VE)"}}}
    };
}

const KnowledgeItem* KnowledgeDB::GetById(const std::string& id) const {
    for (const auto& item : items_) {
        if (item.id == id) return &item;
    }
    return nullptr;
}

std::vector<const KnowledgeItem*> KnowledgeDB::GetByCategory(
        const std::string& category) const {
    std::vector<const KnowledgeItem*> result;
    for (const auto& item : items_) {
        if (item.category == category) result.push_back(&item);
    }
    return result;
}

std::vector<const KnowledgeItem*> KnowledgeDB::Search(
        const std::string& keyword) const {
    std::vector<const KnowledgeItem*> result;
    std::string kw = keyword;
    for (const auto& item : items_) {
        if (item.name.find(kw) != std::string::npos ||
            item.description.find(kw) != std::string::npos) {
            result.push_back(&item);
        }
    }
    return result;
}

Json::Value KnowledgeDB::ToJson() const {
    Json::Value arr;
    for (const auto& item : items_) {
        Json::Value obj;
        obj["id"]          = item.id;
        obj["name"]        = item.name;
        obj["category"]    = item.category;
        obj["description"] = item.description;

        Json::Value relArr;
        for (const auto& r : item.related) relArr.append(r);
        obj["related"] = relArr;

        Json::Value compObj;
        for (const auto& [k, v] : item.complexity) compObj[k] = v;
        obj["complexity"] = compObj;

        arr.append(obj);
    }
    return arr;
}

std::vector<std::string> KnowledgeDB::GetCategories() const {
    std::set<std::string> cats;
    for (const auto& item : items_) cats.insert(item.category);
    return std::vector<std::string>(cats.begin(), cats.end());
}
