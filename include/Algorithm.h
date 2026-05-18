#ifndef ALGOMOTION_ALGORITHM_H
#define ALGOMOTION_ALGORITHM_H

#include "LinearStructure.h"
#include <optional>
#include <string>
#include <string_view>
#include <map>
#include <vector>

// 算法工具 —— 对 LinearStructure 基类操作的通用算法。
// 图/树特定算法直接作为对应类的方法。
namespace Algorithm {

// 冒泡排序（O(n²)，稳定）
void BubbleSort(LinearStructure* ls);

// 二分查找（要求已排序，O(log n)）
std::optional<int> BinarySearch(LinearStructure* ls, int target);

// 获取算法的介绍信息
std::string GetAlgorithmName(std::string_view algoId);
std::string GetAlgorithmDescription(std::string_view algoId);
std::string GetAlgorithmComplexity(std::string_view algoId);
std::string GetAlgorithmCode(std::string_view algoId);

} // namespace Algorithm

#endif
