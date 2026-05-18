#include "BinaryTree.h"
#include <algorithm>
#include <cmath>
#include <sstream>

// ========== 构造 / 析构 ==========

BinaryTree::BinaryTree() : root_(nullptr), size_(0) {}

BinaryTree::~BinaryTree() {
    Destroy(root_);
}

void BinaryTree::Destroy(Node* node) {
    if (!node) return;
    Destroy(node->left);
    Destroy(node->right);
    delete node;
}

// ========== DataStructure 接口 ==========

std::string BinaryTree::GetName() const {
    return "二叉搜索树 (Binary Search Tree)";
}

std::string BinaryTree::GetDescription() const {
    return "二叉搜索树 (BST) 是一种特殊的二叉树，"
           "每个节点的左子树所有节点值小于根节点，"
           "右子树所有节点值大于根节点。"
           "支持 O(log n) 的平均插入、查找、删除操作。";
}

std::string BinaryTree::GetCategory() const {
    return "tree";
}

std::vector<GraphNode> BinaryTree::GetAsGraph() const {
    std::vector<GraphNode> nodes;
    if (!root_) return nodes;
    int h = GetHeight(root_);
    int x = 0;
    int yBase = 80;
    int yStep = 80;
    CollectNodes(root_, 0, x, yBase, nodes);
    return nodes;
}

std::vector<Operation> BinaryTree::GetOperations() const {
    return {
        {"插入 (Insert)",
         "将新值插入 BST 中，保持 BST 性质，平均时间 O(log n)。",
         "O(log n) avg / O(n) worst",
         "void Insert(int val) {\n"
         "    root_ = InsertRec(root_, val);\n"
         "}"},

        {"查找 (Search)",
         "在 BST 中查找指定值，平均时间 O(log n)。",
         "O(log n) avg / O(n) worst",
         "bool Search(int val) const {\n"
         "    return SearchRec(root_, val);\n"
         "}"},

        {"删除 (Delete)",
         "从 BST 中删除指定值，平均时间 O(log n)。",
         "O(log n) avg / O(n) worst",
         "void Delete(int val) {\n"
         "    root_ = DeleteRec(root_, val);\n"
         "}"},

        {"中序遍历 (InOrder)",
         "按左-根-右顺序遍历，得到升序序列。",
         "O(n)",
         "std::vector<int> InOrder() const;\n"
         "// 递归实现：\n"
         "// InOrder(left), visit(root), InOrder(right)"},

        {"前序遍历 (PreOrder)",
         "按根-左-右顺序遍历，用于树的拷贝和序列化。",
         "O(n)",
         "std::vector<int> PreOrder() const;\n"
         "// visit(root), PreOrder(left), PreOrder(right)"},

        {"后序遍历 (PostOrder)",
         "按左-右-根顺序遍历，用于树的删除释放。",
         "O(n)",
         "std::vector<int> PostOrder() const;\n"
         "// PostOrder(left), PostOrder(right), visit(root)"}
    };
}

std::map<std::string, std::string> BinaryTree::GetComplexity() const {
    return {
        {"插入", "O(log n) avg, O(n) worst"},
        {"查找", "O(log n) avg, O(n) worst"},
        {"删除", "O(log n) avg, O(n) worst"},
        {"遍历", "O(n)"},
        {"空间",  "O(n)"}
    };
}

std::vector<std::string> BinaryTree::GetRelatedTopics() const {
    return {"avl_tree", "red_black_tree", "heap", "tree_traversal"};
}

// ========== BST 操作 ==========

void BinaryTree::Insert(int val) {
    root_ = InsertRec(root_, val);
}

bool BinaryTree::Search(int val) const {
    return SearchRec(root_, val);
}

void BinaryTree::Delete(int val) {
    root_ = DeleteRec(root_, val);
}

// ========== 遍历 ==========

std::vector<int> BinaryTree::InOrder() const {
    std::vector<int> result;
    InOrderRec(root_, result);
    return result;
}

std::vector<int> BinaryTree::PreOrder() const {
    std::vector<int> result;
    PreOrderRec(root_, result);
    return result;
}

std::vector<int> BinaryTree::PostOrder() const {
    std::vector<int> result;
    PostOrderRec(root_, result);
    return result;
}

// ========== 递归辅助 ==========

BinaryTree::Node* BinaryTree::InsertRec(Node* node, int val) {
    if (!node) { size_++; return new Node(val); }
    if (val < node->data)
        node->left = InsertRec(node->left, val);
    else if (val > node->data)
        node->right = InsertRec(node->right, val);
    return node;
}

bool BinaryTree::SearchRec(Node* node, int val) const {
    if (!node) return false;
    if (val == node->data) return true;
    if (val < node->data) return SearchRec(node->left, val);
    return SearchRec(node->right, val);
}

BinaryTree::Node* BinaryTree::DeleteRec(Node* node, int val) {
    if (!node) return nullptr;
    if (val < node->data)
        node->left = DeleteRec(node->left, val);
    else if (val > node->data)
        node->right = DeleteRec(node->right, val);
    else {
        // 找到要删除的节点
        if (!node->left) {
            Node* tmp = node->right;
            delete node;
            size_--;
            return tmp;
        }
        if (!node->right) {
            Node* tmp = node->left;
            delete node;
            size_--;
            return tmp;
        }
        // 有两个子节点：用右子树最小值替换
        Node* minNode = FindMin(node->right);
        node->data = minNode->data;
        node->right = DeleteRec(node->right, minNode->data);
    }
    return node;
}

BinaryTree::Node* BinaryTree::FindMin(Node* node) const {
    while (node && node->left) node = node->left;
    return node;
}

void BinaryTree::InOrderRec(Node* node, std::vector<int>& out) const {
    if (!node) return;
    InOrderRec(node->left, out);
    out.push_back(node->data);
    InOrderRec(node->right, out);
}

void BinaryTree::PreOrderRec(Node* node, std::vector<int>& out) const {
    if (!node) return;
    out.push_back(node->data);
    PreOrderRec(node->left, out);
    PreOrderRec(node->right, out);
}

void BinaryTree::PostOrderRec(Node* node, std::vector<int>& out) const {
    if (!node) return;
    PostOrderRec(node->left, out);
    PostOrderRec(node->right, out);
    out.push_back(node->data);
}

// ========== GetAsGraph 辅助 ==========

int BinaryTree::GetHeight(Node* node) const {
    if (!node) return 0;
    return 1 + std::max(GetHeight(node->left), GetHeight(node->right));
}

void BinaryTree::CollectNodes(Node* node, int depth, int& x, int yBase,
                               std::vector<GraphNode>& out) const {
    if (!node) return;
    int yStep = 80;
    // 先处理左子树
    CollectNodes(node->left, depth + 1, x, yBase, out);

    double cx = 100.0 + x * 60.0;
    double cy = yBase + depth * yStep;
    x++;  // 中序遍历递增 x 序号

    out.push_back({cx, cy, "Circle", std::to_string(node->data)});

    // 再处理右子树
    CollectNodes(node->right, depth + 1, x, yBase, out);
}
