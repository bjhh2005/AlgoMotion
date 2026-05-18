#include "Manager.h"
#include "LinkedList.h"
#include "BinaryTree.h"
#include "Graph.h"
#include "Algorithm.h"
#include <unordered_map>

// ========== 单例 ==========

Manager& Manager::Instance() {
    static Manager instance;
    return instance;
}

Manager::Manager()
    : knowledgeDB_()
    , directoryBuilder_(knowledgeDB_)
{
    // 注册所有具体数据结构实例
    RegisterDS("linked_list",  std::make_unique<LinkedList>());
    RegisterDS("binary_tree", std::make_unique<BinaryTree>());
    RegisterDS("graph",       std::make_unique<Graph>());

    // 为演示预先填充一些数据
    auto* list = dynamic_cast<LinkedList*>(GetDS("linked_list"));
    if (list) {
        list->InsertTail(10);
        list->InsertTail(25);
        list->InsertTail(7);
        list->InsertTail(42);
        list->InsertTail(18);
    }

    auto* tree = dynamic_cast<BinaryTree*>(GetDS("binary_tree"));
    if (tree) {
        tree->Insert(50);
        tree->Insert(30);
        tree->Insert(70);
        tree->Insert(20);
        tree->Insert(40);
        tree->Insert(60);
        tree->Insert(80);
    }

    auto* graph = dynamic_cast<Graph*>(GetDS("graph"));
    if (graph) {
        graph->AddEdge(1, 2);
        graph->AddEdge(1, 3);
        graph->AddEdge(2, 4);
        graph->AddEdge(3, 5);
        graph->AddEdge(4, 5);
        graph->AddEdge(2, 5);
    }
}

Manager::~Manager() = default;

void Manager::RegisterDS(const std::string& id, std::unique_ptr<DataStructure> ds) {
    dsInstances_[id] = std::move(ds);
}

DataStructure* Manager::GetDS(const std::string& id) {
    auto it = dsInstances_.find(id);
    return (it != dsInstances_.end()) ? it->second.get() : nullptr;
}

// ========== JSON 转换辅助 ==========

Json::Value Manager::GraphNodesToJson(const std::vector<GraphNode>& nodes) const {
    Json::Value arr;
    for (const auto& n : nodes) {
        Json::Value obj;
        obj["x"]     = n.x;
        obj["y"]     = n.y;
        obj["shape"] = n.shape;
        obj["value"] = n.value;
        arr.append(obj);
    }
    return arr;
}

Json::Value Manager::OperationsToJson(const std::vector<Operation>& ops) const {
    Json::Value arr;
    for (const auto& op : ops) {
        Json::Value obj;
        obj["name"]        = op.name;
        obj["description"] = op.description;
        obj["complexity"]  = op.complexity;
        obj["code"]        = op.code;
        arr.append(obj);
    }
    return arr;
}

// ========== 目录 API ==========

std::string Manager::GetDirectoryTree() {
    Json::Value result;
    result["type"] = "tree";
    result["data"] = directoryBuilder_.BuildTree();
    return ToJsonString(result);
}

std::string Manager::GetDirectoryGraph(const std::string& topicId) {
    Json::Value result;
    result["type"]  = "graph";
    result["topic"] = topicId;
    result["data"]  = directoryBuilder_.BuildGraph(topicId);
    return ToJsonString(result);
}

// ========== 知识点 API ==========

std::string Manager::GetTopic(const std::string& topicId) {
    Json::Value result;

    const KnowledgeItem* item = knowledgeDB_.GetById(topicId);
    if (!item) {
        result["error"] = "Topic not found: " + topicId;
        return ToJsonString(result);
    }

    result["id"]          = item->id;
    result["name"]        = item->name;
    result["category"]    = item->category;
    result["description"] = item->description;

    // 关联知识点
    Json::Value relArr;
    for (const auto& r : item->related) relArr.append(r);
    result["related"] = relArr;

    // 复杂度
    Json::Value compObj;
    for (const auto& [k, v] : item->complexity) compObj[k] = v;
    result["complexity"] = compObj;

    // 如果存在对应的 DS 实例，添加操作列表和图数据
    DataStructure* ds = GetDS(topicId);
    if (ds) {
        result["operations"] = OperationsToJson(ds->GetOperations());
        result["graphNodes"] = GraphNodesToJson(ds->GetAsGraph());
    }

    return ToJsonString(result);
}

std::string Manager::GetGraph(const std::string& topicId) {
    Json::Value result;

    DataStructure* ds = GetDS(topicId);
    const KnowledgeItem* item = knowledgeDB_.GetById(topicId);

    if (!item) {
        result["error"] = "Topic not found: " + topicId;
        return ToJsonString(result);
    }

    result["id"]   = item->id;
    result["name"] = item->name;

    if (ds) {
        result["nodes"] = GraphNodesToJson(ds->GetAsGraph());
    } else {
        result["nodes"] = Json::Value(Json::arrayValue);  // 空数组
    }

    return ToJsonString(result);
}

// ========== 学习报告 ==========

std::string Manager::GetLearningReport() {
    Json::Value result;
    result["type"] = "learning_report";

    // 骨架数据 —— 后续接入真实学习追踪
    Json::Value progress;
    auto categories = knowledgeDB_.GetCategories();
    for (const auto& cat : categories) {
        auto items = knowledgeDB_.GetByCategory(cat);
        Json::Value catProgress;
        catProgress["total"]     = static_cast<int>(items.size());
        catProgress["completed"] = 0;  // TODO: 接入真实数据
        catProgress["percentage"] = 0.0;
        progress[cat] = catProgress;
    }
    result["progress"] = progress;

    result["totalTopics"]      = static_cast<int>(knowledgeDB_.GetAll().size());
    result["completedTopics"]  = 0;
    result["overallPercentage"] = 0.0;
    result["lastStudyDate"]    = "N/A";
    result["studyStreak"]      = 0;

    return ToJsonString(result);
}

// ========== AI 辅助（接口占位）==========

std::string Manager::AskAI(const std::string& question) {
    Json::Value result;
    result["type"]   = "ai_answer";
    result["status"] = "not_implemented";
    result["message"] = "AI 问答功能尚未实现，已收到您的问题：";
    result["received"] = question;
    result["hint"]    = "此接口预留给后续 AI 集成使用。";
    return ToJsonString(result);
}

std::string Manager::AnalyzeCode(const std::string& code) {
    Json::Value result;
    result["type"]   = "code_analysis";
    result["status"] = "not_implemented";
    result["message"] = "代码分析功能尚未实现，已收到您的代码片段。";
    result["received"] = code;
    result["hint"]    = "此接口预留给后续 AI 集成使用。";
    return ToJsonString(result);
}
