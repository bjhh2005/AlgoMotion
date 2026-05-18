#ifndef ALGOMOTION_TYPES_H
#define ALGOMOTION_TYPES_H

#include <string>
#include <vector>
#include <map>
#include <json/json.h>

// JSON 序列化辅助
inline std::string ToJsonString(const Json::Value& v) {
    Json::StreamWriterBuilder builder;
    builder["indentation"] = "";
    return Json::writeString(builder, v);
}

// 可视化节点：用于 GetAsGraph 返回的数组元素
struct GraphNode {
    double x;
    double y;
    std::string shape;   // "Circle", "Rectangle", "Diamond" 或占位 "##0001"
    std::string value;   // 显示的文本（节点值）
};

// 数据结构操作描述
struct Operation {
    std::string name;         // 操作名称，如 "插入"
    std::string description;  // 操作说明
    std::string complexity;   // 时间复杂度，如 "O(1)"
    std::string code;         // C++ 实现代码
};

// 知识点条目（对应 knowledge.json 中的一项）
struct KnowledgeItem {
    std::string id;
    std::string name;
    std::string category;           // "linear", "tree", "graph", "set", "algorithm"
    std::string description;
    std::vector<std::string> related;  // 关联知识点 ID
    std::map<std::string, std::string> complexity;
};

// 目录节点（树状或图状目录的节点）
struct DirNode {
    std::string id;
    std::string name;
    std::string category;
    std::vector<std::string> children;  // 子节点 ID（树状）或邻接节点 ID（图状）
};

#endif
