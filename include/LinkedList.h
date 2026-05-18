#ifndef ALGOMOTION_LINKEDLIST_H
#define ALGOMOTION_LINKEDLIST_H

#include "LinearStructure.h"

// 单链表 —— 线性表的典型实现
class LinkedList : public LinearStructure {
public:
    LinkedList();
    ~LinkedList() override;

    // --- DataStructure 接口 ---
    std::string GetName() const override;
    std::string GetDescription() const override;
    std::vector<GraphNode> GetAsGraph() const override;
    std::vector<Operation> GetOperations() const override;
    std::map<std::string, std::string> GetComplexity() const override;
    std::vector<std::string> GetRelatedTopics() const override;

    // --- LinearStructure 接口 ---
    void Insert(int pos, int val) override;
    void Delete(int pos) override;
    std::optional<int> Search(int val) const override;
    std::optional<int> Get(int pos) const override;
    int  Length() const override;
    bool IsEmpty() const override;
    void Sort() override;

    // 链表特有操作（也会出现在 GetOperations 中）
    void InsertHead(int val);
    void InsertTail(int val);
    std::optional<int> DeleteHead();

private:
    struct Node {
        int  data;
        Node* next;
        Node(int d, Node* n = nullptr) : data(d), next(n) {}
    };

    Node* head_;
    int   length_;
};

#endif
