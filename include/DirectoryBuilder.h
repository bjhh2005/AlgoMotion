#ifndef ALGOMOTION_DIRECTORYBUILDER_H
#define ALGOMOTION_DIRECTORYBUILDER_H

#include "KnowledgeDB.h"
#include <string>

// 目录构建器 —— 从 KnowledgeDB 构建导航结构。
// - BuildTree(): 树状目录，用于主页，按类别分组
// - BuildGraph(): 图状目录，用于知识点页面，以指定 topic 为中心展示关联
class DirectoryBuilder {
public:
    explicit DirectoryBuilder(const KnowledgeDB& db);

    // 树状目录：按 category 分组，每组下列出知识点
    Json::Value BuildTree() const;

    // 图状目录：以 topicId 为中心，展开其关联知识点
    Json::Value BuildGraph(const std::string& topicId) const;

private:
    const KnowledgeDB& db_;
};

#endif
