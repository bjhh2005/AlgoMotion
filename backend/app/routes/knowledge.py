"""
知识图谱相关路由
"""
from fastapi import APIRouter, HTTPException

from ..schemas import KnowledgeNode, KnowledgeEdge
from ..response import success_response
from ..validators import validate_node_id

router = APIRouter(prefix="/api/knowledge", tags=["知识图谱"])


def get_nodes_data():
    """获取知识点数据"""
    from ..storage import nodes
    return nodes()


def get_edges_data():
    """获取边数据"""
    from ..storage import edges
    return edges()


@router.get("/nodes", response_model=dict)
async def get_nodes():
    """
    获取知识点列表
    
    返回当前用户的所有知识点
    """
    node_list = get_nodes_data()
    return success_response(node_list)


@router.get("/edges", response_model=dict)
async def get_edges(node_id: str | None = None):
    """
    获取知识边关系
    
    - **node_id**: 可选，筛选特定节点的所有边
    """
    edge_list = get_edges_data()
    
    if node_id:
        if not validate_node_id(node_id):
            raise HTTPException(status_code=400, detail="Invalid node ID format")
        edge_list = [
            edge for edge in edge_list
            if edge.get("source") == node_id or edge.get("target") == node_id
        ]
    
    return success_response(edge_list)


@router.get("/graph", response_model=dict)
async def get_graph():
    """获取完整知识图谱（节点和边）"""
    return success_response({
        "nodes": get_nodes_data(),
        "edges": get_edges_data()
    })


@router.get("/{node_id}", response_model=dict)
async def get_node_detail(node_id: str):
    """
    获取知识点详情
    
    - **node_id**: 知识点 ID
    """
    if not validate_node_id(node_id):
        raise HTTPException(status_code=400, detail="Invalid node ID format")
    
    from ..storage import contents, code_examples, exercises
    
    node = next((item for item in get_nodes_data() if item.get("id") == node_id), None)
    if not node:
        raise HTTPException(status_code=404, detail="Knowledge node not found")
    
    related_edges = [
        edge for edge in get_edges_data()
        if edge.get("source") == node_id or edge.get("target") == node_id
    ]
    related_exercises = [
        item for item in exercises() if item.get("nodeId") == node_id
    ]
    content = next((item for item in contents() if item.get("nodeId") == node_id), None)
    examples = [item for item in code_examples() if item.get("nodeId") == node_id]
    
    return success_response({
        "node": node,
        "content": content,
        "codeExamples": examples,
        "relations": related_edges,
        "exercises": related_exercises
    })
