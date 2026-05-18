#include "LinkedList.h"
#include "Algorithm.h"
#include <cmath>
#include <sstream>

// ========== 构造 / 析构 ==========

LinkedList::LinkedList() : head_(nullptr), length_(0) {}

LinkedList::~LinkedList() {
    Node* cur = head_;
    while (cur) {
        Node* nxt = cur->next;
        delete cur;
        cur = nxt;
    }
}

// ========== DataStructure 接口 ==========

std::string LinkedList::GetName() const {
    return "链表 (Linked List)";
}

std::string LinkedList::GetDescription() const {
    return "链表是一种线性数据结构，由一系列节点组成，"
           "每个节点包含数据域和指向下一个节点的指针。"
           "单链表是最基本的链式存储结构，支持动态内存分配，"
           "插入和删除操作不需要移动大量元素。";
}

std::vector<GraphNode> LinkedList::GetAsGraph() const {
    std::vector<GraphNode> nodes;
    const double startX  = 80.0;
    const double startY  = 200.0;
    const double spacing = 120.0;
    const double radius  = 25.0;

    // 头指针标签
    nodes.push_back({startX - 40, startY, "##0001", "head"});

    Node* cur = head_;
    int idx = 0;
    while (cur) {
        double cx = startX + idx * spacing;
        double cy = startY;

        // 节点圆圈
        nodes.push_back({cx, cy, "Circle", std::to_string(cur->data)});

        // 箭头到下一个节点
        if (cur->next) {
            double nx = startX + (idx + 1) * spacing;
            nodes.push_back({(cx + nx) / 2, cy, "Arrow", ""});
        } else {
            // 最后一个节点指向 nullptr
            nodes.push_back({cx + spacing - 20, cy, "##0002", "NULL"});
        }
        cur = cur->next;
        ++idx;
    }

    if (!head_) {
        nodes.push_back({startX, startY, "##0002", "NULL"});
    }

    return nodes;
}

std::vector<Operation> LinkedList::GetOperations() const {
    return {
        {"头插 (InsertHead)",
         "在链表头部插入新节点，时间复杂度 O(1)。",
         "O(1)",
         "void InsertHead(int val) {\n"
         "    Node* node = new Node(val, head_);\n"
         "    head_ = node;\n"
         "    length_++;\n"
         "}"},

        {"尾插 (InsertTail)",
         "在链表尾部插入新节点，时间复杂度 O(n)。",
         "O(n)",
         "void InsertTail(int val) {\n"
         "    Node* node = new Node(val);\n"
         "    if (!head_) { head_ = node; return; }\n"
         "    Node* cur = head_;\n"
         "    while (cur->next) cur = cur->next;\n"
         "    cur->next = node;\n"
         "    length_++;\n"
         "}"},

        {"删除 (Delete)",
         "删除指定位置的节点，时间复杂度 O(n)。",
         "O(n)",
         "void Delete(int pos) {\n"
         "    if (pos < 0 || pos >= length_) return;\n"
         "    if (pos == 0) { DeleteHead(); return; }\n"
         "    Node* cur = head_;\n"
         "    for (int i = 0; i < pos - 1; i++) cur = cur->next;\n"
         "    Node* del = cur->next;\n"
         "    cur->next = del->next;\n"
         "    delete del;\n"
         "    length_--;\n"
         "}"},

        {"查找 (Search)",
         "按值查找节点位置，时间复杂度 O(n)。",
         "O(n)",
         "std::optional<int> Search(int val) const {\n"
         "    Node* cur = head_;\n"
         "    int pos = 0;\n"
         "    while (cur) {\n"
         "        if (cur->data == val) return pos;\n"
         "        cur = cur->next;\n"
         "        pos++;\n"
         "    }\n"
         "    return std::nullopt;\n"
         "}"},

        {"排序 (Sort)",
         "使用冒泡排序对链表进行升序排序，时间复杂度 O(n²)。",
         "O(n²)",
         "void Sort() {\n"
         "    Algorithm::BubbleSort(this);\n"
         "}"}
    };
}

std::map<std::string, std::string> LinkedList::GetComplexity() const {
    return {
        {"头插",    "O(1)"},
        {"尾插",    "O(n)"},
        {"删除",    "O(n)"},
        {"查找",    "O(n)"},
        {"随机访问", "O(n)"},
        {"空间",    "O(n)"}
    };
}

std::vector<std::string> LinkedList::GetRelatedTopics() const {
    return {"array", "stack", "queue", "doubly_linked_list"};
}

// ========== LinearStructure 接口 ==========

void LinkedList::Insert(int pos, int val) {
    if (pos < 0 || pos > length_) return;
    if (pos == 0) { InsertHead(val); return; }
    Node* cur = head_;
    for (int i = 0; i < pos - 1; ++i) cur = cur->next;
    cur->next = new Node(val, cur->next);
    length_++;
}

void LinkedList::Delete(int pos) {
    if (pos < 0 || pos >= length_) return;
    if (pos == 0) { DeleteHead(); return; }
    Node* cur = head_;
    for (int i = 0; i < pos - 1; ++i) cur = cur->next;
    Node* del = cur->next;
    cur->next = del->next;
    delete del;
    length_--;
}

std::optional<int> LinkedList::Search(int val) const {
    Node* cur = head_;
    int pos = 0;
    while (cur) {
        if (cur->data == val) return pos;
        cur = cur->next;
        ++pos;
    }
    return std::nullopt;
}

std::optional<int> LinkedList::Get(int pos) const {
    if (pos < 0 || pos >= length_) return std::nullopt;
    Node* cur = head_;
    for (int i = 0; i < pos; ++i) cur = cur->next;
    return cur->data;
}

int LinkedList::Length() const { return length_; }
bool LinkedList::IsEmpty() const { return head_ == nullptr; }

void LinkedList::Sort() {
    Algorithm::BubbleSort(this);
}

// ========== 链表特有操作 ==========

void LinkedList::InsertHead(int val) {
    head_ = new Node(val, head_);
    length_++;
}

void LinkedList::InsertTail(int val) {
    Node* node = new Node(val);
    if (!head_) { head_ = node; length_++; return; }
    Node* cur = head_;
    while (cur->next) cur = cur->next;
    cur->next = node;
    length_++;
}

std::optional<int> LinkedList::DeleteHead() {
    if (!head_) return std::nullopt;
    Node* del = head_;
    int val = del->data;
    head_ = head_->next;
    delete del;
    length_--;
    return val;
}
