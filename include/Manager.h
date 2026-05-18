#ifndef ALGOMOTION_MANAGER_H
#define ALGOMOTION_MANAGER_H

#include "DataStructure.h"
#include "KnowledgeDB.h"
#include "DirectoryBuilder.h"
#include <string>
#include <unordered_map>
#include <memory>

// API 管理器（单例）—— 前端所有调用的统一入口。
// 每个方法返回 JSON 字符串，可直接通过 HTTP/WebSocket 发送给前端。
class Manager {
public:
    static Manager& Instance();

    // ---- 目录相关 ----
    std::string GetDirectoryTree();                     // 树状目录（主页）
    std::string GetDirectoryGraph(const std::string& topicId); // 图状目录（知识点页）

    // ---- 知识点相关 ----
    std::string GetTopic(const std::string& topicId);   // 知识点详情（定义+操作+代码+复杂度）
    std::string GetGraph(const std::string& topicId);   // 可视化数据（坐标+形状+值）

    // ---- 学习报告 ----
    std::string GetLearningReport();                    // 学习进度（当前为骨架）

    // ---- AI 辅助（接口占位）----
    std::string AskAI(const std::string& question);     // AI 问答
    std::string AnalyzeCode(const std::string& code);   // 代码分析纠错

    // 获取 DS 实例（内部使用）
    DataStructure* GetDS(const std::string& id);

private:
    Manager();
    ~Manager();
    Manager(const Manager&) = delete;
    Manager& operator=(const Manager&) = delete;

    KnowledgeDB                         knowledgeDB_;
    DirectoryBuilder                    directoryBuilder_;
    std::unordered_map<std::string, std::unique_ptr<DataStructure>> dsInstances_;

    void RegisterDS(const std::string& id, std::unique_ptr<DataStructure> ds);

    // 将 GraphNode 数组转为 JSON
    Json::Value GraphNodesToJson(const std::vector<GraphNode>& nodes) const;

    // 将 Operation 数组转为 JSON
    Json::Value OperationsToJson(const std::vector<Operation>& ops) const;
};

#endif
