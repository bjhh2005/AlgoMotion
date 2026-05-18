#ifndef ALGOMOTION_KNOWLEDGEDB_H
#define ALGOMOTION_KNOWLEDGEDB_H

#include "Types.h"
#include <vector>
#include <string>

// 知识数据库 —— 管理所有知识点的元数据。
// 当前版本将数据硬编码在 C++ 中（方便无外部依赖启动），
// 后续可改为从 data/knowledge.json 加载。
class KnowledgeDB {
public:
    KnowledgeDB();

    // 按 ID 查找
    const KnowledgeItem* GetById(const std::string& id) const;

    // 按类别查找
    std::vector<const KnowledgeItem*> GetByCategory(const std::string& category) const;

    // 按关键词搜索（在名称和描述中匹配）
    std::vector<const KnowledgeItem*> Search(const std::string& keyword) const;

    // 获取全部条目
    const std::vector<KnowledgeItem>& GetAll() const { return items_; }

    // 导出为 JSON（供前端使用）
    Json::Value ToJson() const;

    // 获取所有类别
    std::vector<std::string> GetCategories() const;

private:
    std::vector<KnowledgeItem> items_;
    void InitData();
};

#endif
