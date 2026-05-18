#ifndef ALGOMOTION_DATASTRUCTURE_H
#define ALGOMOTION_DATASTRUCTURE_H

#include "Types.h"

// 所有数据结构的抽象基类。
// Manager 通过此接口统一操作各具体数据结构。
class DataStructure {
public:
    virtual ~DataStructure() = default;

    virtual std::string GetName() const = 0;
    virtual std::string GetDescription() const = 0;
    virtual std::string GetCategory() const = 0;

    // 返回用于前端可视化的节点坐标数组
    virtual std::vector<GraphNode> GetAsGraph() const = 0;

    // 返回该结构支持的操作列表（含 C++ 代码）
    virtual std::vector<Operation> GetOperations() const = 0;

    // 返回各操作的时间/空间复杂度
    virtual std::map<std::string, std::string> GetComplexity() const = 0;

    // 返回关联知识点的 ID 列表
    virtual std::vector<std::string> GetRelatedTopics() const = 0;
};

#endif
