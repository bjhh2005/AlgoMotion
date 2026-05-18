#include "Algorithm.h"

namespace Algorithm {

void BubbleSort(LinearStructure* ls) {
    int n = ls->Length();
    for (int i = 0; i < n - 1; ++i) {
        bool swapped = false;
        for (int j = 0; j < n - 1 - i; ++j) {
            int a = ls->Get(j).value();
            int b = ls->Get(j + 1).value();
            if (a > b) {
                ls->Delete(j + 1);
                ls->Delete(j);
                ls->Insert(j, b);
                ls->Insert(j + 1, a);
                swapped = true;
            }
        }
        if (!swapped) break;
    }
}

std::optional<int> BinarySearch(LinearStructure* ls, int target) {
    int left = 0, right = ls->Length() - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        int midVal = ls->Get(mid).value();
        if (midVal == target) return mid;
        if (midVal < target)
            left = mid + 1;
        else
            right = mid - 1;
    }
    return std::nullopt;
}

std::string GetAlgorithmName(std::string_view algoId) {
    if (algoId == "bubble_sort")    return "冒泡排序 (Bubble Sort)";
    if (algoId == "binary_search")  return "二分查找 (Binary Search)";
    return "";
}

std::string GetAlgorithmDescription(std::string_view algoId) {
    if (algoId == "bubble_sort") {
        return "冒泡排序重复地遍历待排序序列，比较相邻元素并交换顺序错误的元素。"
               "时间复杂度 O(n²)，空间复杂度 O(1)，是稳定的排序算法。";
    }
    if (algoId == "binary_search") {
        return "二分查找在有序序列中通过反复将查找区间减半来定位目标值。"
               "时间复杂度 O(log n)，空间复杂度 O(1)。要求序列已排序。";
    }
    return "";
}

std::string GetAlgorithmComplexity(std::string_view algoId) {
    if (algoId == "bubble_sort")    return "时间 O(n²)，空间 O(1)，稳定";
    if (algoId == "binary_search")  return "时间 O(log n)，空间 O(1)";
    return "";
}

std::string GetAlgorithmCode(std::string_view algoId) {
    if (algoId == "bubble_sort") {
        return
        "void BubbleSort(int arr[], int n) {\n"
        "    for (int i = 0; i < n - 1; i++) {\n"
        "        bool swapped = false;\n"
        "        for (int j = 0; j < n - 1 - i; j++) {\n"
        "            if (arr[j] > arr[j + 1]) {\n"
        "                std::swap(arr[j], arr[j + 1]);\n"
        "                swapped = true;\n"
        "            }\n"
        "        }\n"
        "        if (!swapped) break;\n"
        "    }\n"
        "}";
    }
    if (algoId == "binary_search") {
        return
        "int BinarySearch(int arr[], int n, int target) {\n"
        "    int left = 0, right = n - 1;\n"
        "    while (left <= right) {\n"
        "        int mid = left + (right - left) / 2;\n"
        "        if (arr[mid] == target) return mid;\n"
        "        if (arr[mid] < target)\n"
        "            left = mid + 1;\n"
        "        else\n"
        "            right = mid - 1;\n"
        "    }\n"
        "    return -1;\n"
        "}";
    }
    return "";
}

} // namespace Algorithm
