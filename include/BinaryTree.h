#ifndef ALGOMOTION_BINARYTREE_H
#define ALGOMOTION_BINARYTREE_H

#include "DataStructure.h"
#include <functional>

// 二叉搜索树 (BST) —— 树结构的典型实现
class BinaryTree : public DataStructure {
public:
    BinaryTree();
    ~BinaryTree() override;

    // --- DataStructure 接口 ---
    std::string GetName() const override;
    std::string GetDescription() const override;
    std::string GetCategory() const override;
    std::vector<GraphNode> GetAsGraph() const override;
    std::vector<Operation> GetOperations() const override;
    std::map<std::string, std::string> GetComplexity() const override;
    std::vector<std::string> GetRelatedTopics() const override;

    // BST 操作
    void Insert(int val);
    bool Search(int val) const;
    void Delete(int val);

    // 遍历（以数组形式返回结果）
    std::vector<int> InOrder() const;
    std::vector<int> PreOrder() const;
    std::vector<int> PostOrder() const;

    int  Size() const { return size_; }
    bool IsEmpty() const { return size_ == 0; }

private:
    struct Node {
        int   data;
        Node* left;
        Node* right;
        Node(int d, Node* l = nullptr, Node* r = nullptr)
            : data(d), left(l), right(r) {}
    };

    Node* root_;
    int   size_;

    // 递归辅助
    void   Destroy(Node* node);
    Node*  InsertRec(Node* node, int val);
    Node*  DeleteRec(Node* node, int val);
    Node*  FindMin(Node* node) const;
    bool   SearchRec(Node* node, int val) const;
    void   InOrderRec(Node* node, std::vector<int>& out) const;
    void   PreOrderRec(Node* node, std::vector<int>& out) const;
    void   PostOrderRec(Node* node, std::vector<int>& out) const;

    // GetAsGraph 辅助：获取树的高度和宽度布局
    int    GetHeight(Node* node) const;
    void   CollectNodes(Node* node, int depth, int& x, int yBase,
                        std::vector<GraphNode>& out) const;
};

#endif
