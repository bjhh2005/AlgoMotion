# AlgoMotion

《数据结构》智慧学习平台 —— C++ 后端。

## 项目结构

```
AlgoMotion/
├── external/json/          # jsoncpp 库（头文件 + libjsoncpp.a）
├── include/
│   ├── Types.h              # 公共类型（含 jsoncpp 头文件 + ToJsonString 辅助）
│   ├── DataStructure.h      # 抽象基类（所有数据结构的统一接口）
│   ├── LinearStructure.h    # 线性结构中抽象层
│   ├── LinkedList.h         # 单链表（线性表典型实现）
│   ├── BinaryTree.h         # 二叉搜索树（树典型实现）
│   ├── Graph.h              # 图 - 邻接表（图典型实现）
│   ├── Algorithm.h          # 算法工具（BubbleSort, BinarySearch）
│   ├── Manager.h            # API 管理器（单例）
│   ├── KnowledgeDB.h        # 知识数据库
│   └── DirectoryBuilder.h   # 目录构建器（树状/图状导航）
├── src/                     # 对应 .cpp 实现
├── data/
│   └── knowledge.json       # 知识数据库 JSON 参考格式
├── CMakeLists.txt
└── .gitignore
```

## 架构

```
                   ┌─────────────┐
  Web Frontend ←→  │   Manager   │  (JSON API 入口)
                   └──┬───┬───┬──┘
         ┌────────────┤   │   ├──────────┐
         ▼            ▼   ▼              ▼
  DirectoryBuilder  DataStructure   KnowledgeDB
                      /   |   \
                  Linear  Tree  Graph
                    |
               LinkedList
```

- **Manager** 持有 KnowledgeDB + DirectoryBuilder + 所有 DS 实例，前端请求到此 → 路由到具体类 → 序列化为 JSON 返回
- **DataStructure** 抽象基类定义 6 个纯虚方法，所有 DS 必须实现
- **LinearStructure** 中间抽象层统一线性表的 Insert/Delete/Search/Sort，使算法可跨线性结构复用
- 新增 DS：继承对应基类 → 实现虚方法 → Manager 中注册 → KnowledgeDB 添加条目

## API

所有方法返回 JSON 字符串。

| 方法 | 说明 | 状态 |
|------|------|------|
| `GetDirectoryTree()` | 树状目录（主页导航，按类别分组） | done |
| `GetDirectoryGraph(topicId)` | 图状目录（知识点关联图） | done |
| `GetTopic(topicId)` | 知识点详情（定义+操作+代码+复杂度+图数据） | done |
| `GetGraph(topicId)` | 可视化数据（坐标+形状+值数组） | done |
| `GetLearningReport()` | 学习进度报告 | 骨架 |
| `AskAI(question)` | AI 问答 | 接口占位 |
| `AnalyzeCode(code)` | 代码分析纠错 | 接口占位 |

### GetAsGraph 形状编码

| 编码 | 含义 |
|------|------|
| `Circle` | 圆形节点 |
| `Arrow` | 箭头/连线 |
| `##0001` | 标签/指针 |
| `##0002` | 空节点(NULL) |
| `##0003` | 图的边 |

`##xxxx` 为占位编码，后续统一替换为前端渲染标识。

## 构建

依赖：g++ (C++17) + CMake 3.10+ + jsoncpp（MinGW 静态库 `libjsoncpp.a`）

```bash
cd AlgoMotion
mkdir -p build && cd build
cmake -G "MinGW Makefiles" ..
cmake --build .
./algomotion
```

## 扩展指南

1. `include/` 中新建头文件，继承对应基类
2. `src/` 中实现 .cpp
3. `Manager::Manager()` 中 `RegisterDS` 注册
4. `KnowledgeDB::InitData()` 添加知识条目
5. `CMakeLists.txt` 自动 GLOB `src/*.cpp`，无需手动修改
