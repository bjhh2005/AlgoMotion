#include "Manager.h"
#include <iostream>
#include <string>

// 辅助：打印分隔线
static void PrintSeparator(const std::string& title) {
    std::cout << "\n========== " << title << " ==========\n";
}

int main() {
    Manager& mgr = Manager::Instance();

    // 1. 树状目录
    PrintSeparator("1. 树状目录 (GetDirectoryTree)");
    std::cout << mgr.GetDirectoryTree() << "\n";

    // 2. 图状目录（以 linked_list 为中心）
    PrintSeparator("2. 图状目录 (GetDirectoryGraph: linked_list)");
    std::cout << mgr.GetDirectoryGraph("linked_list") << "\n";

    // 3. 知识点详情 —— 链表
    PrintSeparator("3. 知识点详情 (GetTopic: linked_list)");
    std::cout << mgr.GetTopic("linked_list") << "\n";

    // 4. 知识点详情 —— 二叉树
    PrintSeparator("4. 知识点详情 (GetTopic: binary_tree)");
    std::cout << mgr.GetTopic("binary_tree") << "\n";

    // 5. 知识点详情 —— 图
    PrintSeparator("5. 知识点详情 (GetTopic: graph)");
    std::cout << mgr.GetTopic("graph") << "\n";

    // 6. 可视化数据
    PrintSeparator("6. 可视化数据 (GetGraph: linked_list)");
    std::cout << mgr.GetGraph("linked_list") << "\n";

    PrintSeparator("7. 可视化数据 (GetGraph: binary_tree)");
    std::cout << mgr.GetGraph("binary_tree") << "\n";

    PrintSeparator("8. 可视化数据 (GetGraph: graph)");
    std::cout << mgr.GetGraph("graph") << "\n";

    // 9. 算法知识点
    PrintSeparator("9. 算法知识点 (GetTopic: bubble_sort)");
    std::cout << mgr.GetTopic("bubble_sort") << "\n";

    // 10. 学习报告
    PrintSeparator("10. 学习报告 (GetLearningReport)");
    std::cout << mgr.GetLearningReport() << "\n";

    // 11. AI 占位接口
    PrintSeparator("11. AI 问答 (AskAI)");
    std::cout << mgr.AskAI("什么是二叉树的平衡因子？") << "\n";

    PrintSeparator("12. 代码分析 (AnalyzeCode)");
    std::cout << mgr.AnalyzeCode("int main() { return 0; }") << "\n";

    std::cout << "\nAll API demos completed.\n";
    return 0;
}
