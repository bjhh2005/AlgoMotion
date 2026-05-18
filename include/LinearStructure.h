#ifndef ALGOMOTION_LINEARSTRUCTURE_H
#define ALGOMOTION_LINEARSTRUCTURE_H

#include <optional>

#include "DataStructure.h"

// 线性结构中间抽象层。
// 统一数组、链表等线性表的通用操作，使 Algorithm 中的排序/查找
// 可通过该基类指针一致地操作所有线性结构。
class LinearStructure : public DataStructure {
public:
    std::string GetCategory() const override { return "linear"; }

    // 线性表通用操作接口
    virtual void Insert(int pos, int val) = 0;
    virtual void Delete(int pos) = 0;
    virtual std::optional<int> Search(int val) const = 0;
    virtual std::optional<int> Get(int pos) const = 0;
    virtual int  Length() const = 0;
    virtual bool IsEmpty() const = 0;

    // 排序 —— 子类可覆写以使用特定算法
    virtual void Sort() = 0;
};

#endif
