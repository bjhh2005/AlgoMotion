import { useState } from "react";
import { analyzeCode, askAi } from "../api";
import type { KnowledgeNode } from "../types";

interface Props {
  selectedNode: KnowledgeNode;
  nodeById: Record<string, KnowledgeNode>;
  onSelect: (nodeId: string) => void;
}

export function AiPanel({ selectedNode, nodeById, onSelect }: Props) {
  const [code, setCode] = useState("stack<int> s;\ns.pop();");
  const [message, setMessage] = useState("为什么栈可以用于递归？");
  const [reply, setReply] = useState(`可以结合 ${selectedNode.name} 的定义、操作和复杂度进行解释。`);
  const [linkedNodes, setLinkedNodes] = useState<string[]>([selectedNode.id]);
  const [suggestions, setSuggestions] = useState<string[]>(["点击分析会调用 FastAPI 的 AI 代码分析接口。"]);
  const [status, setStatus] = useState("等待调用后端接口");

  function handleChat() {
    setStatus("正在请求 /api/ai/chat");
    askAi(message, selectedNode.id)
      .then((result) => {
        setReply(result.answer);
        setLinkedNodes(result.linkedNodes.length > 0 ? result.linkedNodes : [selectedNode.id]);
        setStatus("问答接口调用成功");
      })
      .catch((error: Error) => {
        setStatus(`问答接口调用失败：${error.message}`);
      });
  }

  function handleAnalyze() {
    setStatus("正在请求 /api/ai/code-analysis");
    analyzeCode(code, message)
      .then((result) => {
        setReply(result.summary);
        setLinkedNodes(result.linkedNodes.length > 0 ? result.linkedNodes : [selectedNode.id]);
        setSuggestions(result.suggestions);
        setStatus("代码分析接口调用成功");
      })
      .catch((error: Error) => {
        setStatus(`代码分析接口调用失败：${error.message}`);
      });
  }

  return (
    <section className="ai-panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">AI Assistant</span>
          <h3>问答与代码分析</h3>
        </div>
      </div>

      <label>
        多轮问答
        <input value={message} onChange={(event) => setMessage(event.target.value)} />
      </label>
      <div className="status-actions">
        <button onClick={handleChat}>发送问题</button>
      </div>
      <p className="assistant-reply">{reply}</p>

      <label>
        C++ 代码分析
        <textarea value={code} onChange={(event) => setCode(event.target.value)} rows={5} />
      </label>
      <div className="status-actions">
        <button onClick={handleAnalyze}>分析代码</button>
        <span className="inline-status">{status}</span>
      </div>

      <div className="relation-list">
        {linkedNodes.map((nodeId) => (
          <button key={nodeId} onClick={() => onSelect(nodeId)}>
            跳转: {nodeById[nodeId]?.name ?? nodeId}
          </button>
        ))}
      </div>
      <ul className="content-list">
        {suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
      </ul>
    </section>
  );
}
