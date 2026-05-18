#include "DirectoryBuilder.h"

DirectoryBuilder::DirectoryBuilder(const KnowledgeDB& db) : db_(db) {}

Json::Value DirectoryBuilder::BuildTree() const {
    Json::Value root;
    root["name"] = "数据结构与算法";

    Json::Value children;
    auto categories = db_.GetCategories();
    for (const auto& cat : categories) {
        Json::Value catNode;
        // 类别名映射
        std::string catName = cat;
        if (cat == "linear")     catName = "线性结构";
        else if (cat == "tree")  catName = "树结构";
        else if (cat == "graph") catName = "图结构";
        else if (cat == "algorithm") catName = "算法";

        catNode["name"] = catName;
        catNode["id"]   = cat;

        auto items = db_.GetByCategory(cat);
        Json::Value itemList;
        for (const auto* item : items) {
            Json::Value itemNode;
            itemNode["id"]   = item->id;
            itemNode["name"] = item->name;
            itemList.append(itemNode);
        }
        catNode["children"] = itemList;
        children.append(catNode);
    }
    root["children"] = children;

    return root;
}

Json::Value DirectoryBuilder::BuildGraph(const std::string& topicId) const {
    const KnowledgeItem* center = db_.GetById(topicId);
    Json::Value result;

    if (!center) {
        result["error"] = "Topic not found: " + topicId;
        return result;
    }

    // 中心节点
    result["center"] = center->id;
    result["centerName"] = center->name;

    // 关联节点
    Json::Value relatedNodes;
    for (const auto& relId : center->related) {
        const KnowledgeItem* rel = db_.GetById(relId);
        if (rel) {
            Json::Value node;
            node["id"]       = rel->id;
            node["name"]     = rel->name;
            node["category"] = rel->category;
            relatedNodes.append(node);
        }
    }
    result["related"] = relatedNodes;

    // 关联边（中心 → 每个关联节点）
    Json::Value edges;
    for (const auto& relId : center->related) {
        if (db_.GetById(relId)) {
            Json::Value edge;
            edge["from"] = center->id;
            edge["to"]   = relId;
            edges.append(edge);
        }
    }
    result["edges"] = edges;

    return result;
}
