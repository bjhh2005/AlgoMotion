import { useMemo } from "react";
import type { SVGProps } from "react";
import type { CognitiveLevel, CognitiveMastery } from "../types";

interface Props {
  cognitiveMastery: CognitiveMastery | null;
  nodeName: string;
  width?: number;
  height?: number;
  isEmpty?: boolean;
}

// 认知层级雷达图组件 - 维度二：学习质量深度
export function CognitiveRadarChart({ cognitiveMastery, nodeName, width = 320, height = 320, isEmpty = false }: Props) {
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(centerX, centerY) - 50;

  // 默认示例数据（无真实数据时展示）
  const defaultMastery: CognitiveMastery = {
    nodeId: "default",
    levelMastery: {
      remember: 0.85,
      understand: 0.72,
      apply: 0.58,
      analyze: 0.45,
      evaluate: 0.32,
      create: 0.20,
    },
    bloomWeightedMastery: 0.52,
    questionAttemptStats: {
      remember: { total: 20, correct: 17, avgTimeSpent: 15, guessRate: 0.1 },
      understand: { total: 15, correct: 11, avgTimeSpent: 28, guessRate: 0.15 },
      apply: { total: 12, correct: 7, avgTimeSpent: 45, guessRate: 0.25 },
      analyze: { total: 8, correct: 4, avgTimeSpent: 60, guessRate: 0.3 },
      evaluate: { total: 5, correct: 2, avgTimeSpent: 75, guessRate: 0.35 },
      create: { total: 3, correct: 1, avgTimeSpent: 90, guessRate: 0.4 },
    },
  };

  // 根据是否有数据决定使用哪个
  const displayMastery = cognitiveMastery ?? (isEmpty ? defaultMastery : null);
  
  const levels: Array<{ level: CognitiveLevel; label: string; color: string }> = [
    { level: "remember", label: "记忆", color: "#4facfe" },
    { level: "understand", label: "理解", color: "#43e97b" },
    { level: "apply", label: "应用", color: "#fa709a" },
    { level: "analyze", label: "分析", color: "#f0abfc" },
    { level: "evaluate", label: "评价", color: "#fbbf24" },
    { level: "create", label: "创造", color: "#a78bfa" },
  ];
  
  const { dataPoints, polygonPath, labels, gridPaths } = useMemo(() => {
    const n = levels.length;
    const angleStep = (Math.PI * 2) / n;
    const startAngle = -Math.PI / 2;
    
    // 计算各层级网格线和数据点
    const gridCount = 5;
    const gridPathsArr: string[] = [];
    
    // 绘制同心多边形网格
    for (let i = 1; i <= gridCount; i++) {
      const gridRadius = (maxRadius * i) / gridCount;
      const gridPointsArr = levels.map((_, idx) => {
        const angle = startAngle + idx * angleStep;
        return {
          x: centerX + gridRadius * Math.cos(angle),
          y: centerY + gridRadius * Math.sin(angle),
        };
      });
      const path = gridPointsArr.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
      gridPathsArr.push(path);
    }
    
    // 绘制轴线
    const axisLines = levels.map((_, idx) => {
      const angle = startAngle + idx * angleStep;
      return `M ${centerX} ${centerY} L ${centerX + maxRadius * Math.cos(angle)} ${centerY + maxRadius * Math.sin(angle)}`;
    });
    
    // 数据点和标签（使用 displayMastery）
    const dataPointsArr = levels.map((item, idx) => {
      const angle = startAngle + idx * angleStep;
      const value = displayMastery?.levelMastery[item.level] ?? 0;
      const radius = maxRadius * value;
      return {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        value: Math.round(value * 100),
      };
    });
    
    const labelsArr = levels.map((item, idx) => {
      const angle = startAngle + idx * angleStep;
      const labelRadius = maxRadius + 30;
      const x = centerX + labelRadius * Math.cos(angle);
      const y = centerY + labelRadius * Math.sin(angle);
      const anchor: SVGProps<SVGTextElement>["textAnchor"] =
        x < centerX - 10 ? "end" : x > centerX + 10 ? "start" : "middle";
      return { ...item, x, y, anchor };
    });
    
    // 数据多边形路径
    const polygon = dataPointsArr.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
    
    return {
      dataPoints: dataPointsArr,
      polygonPath: polygon,
      labels: labelsArr,
      gridPaths: gridPathsArr,
      axisLines,
    };
  }, [levels, maxRadius, centerX, centerY, displayMastery]);
  
  // 计算布鲁姆加权掌握度
  const bloomWeighted = displayMastery?.bloomWeightedMastery ?? 0;
  
  // 计算综合评级
  const getRating = (value: number) => {
    if (value >= 0.8) return { text: "优秀", color: "#10b981" };
    if (value >= 0.6) return { text: "良好", color: "#3b82f6" };
    if (value >= 0.4) return { text: "一般", color: "#f59e0b" };
    return { text: "薄弱", color: "#ef4444" };
  };
  
  const rating = getRating(bloomWeighted);
  
  return (
    <div className="cognitive-radar-chart">
      <div className="radar-header">
        <h5>{nodeName}</h5>
        <div className="radar-summary">
          <span className="bloom-score" style={{ color: rating.color }}>
            {Math.round(bloomWeighted * 100)}%
          </span>
          <span className="bloom-label">{rating.text}</span>
        </div>
      </div>
      
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* 网格背景 */}
        <g className="radar-grid">
          {gridPaths.map((path, idx) => (
            <path key={idx} d={path} fill="none" stroke="#e2e8f0" strokeWidth="1" />
          ))}
          {/* 轴线 */}
          {levels.map((_, idx) => {
            const angle = (-Math.PI / 2) + idx * (Math.PI * 2 / levels.length);
            return (
              <line
                key={idx}
                x1={centerX}
                y1={centerY}
                x2={centerX + maxRadius * Math.cos(angle)}
                y2={centerY + maxRadius * Math.sin(angle)}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
            );
          })}
        </g>
        
        {/* 数据区域 */}
        <path
          d={polygonPath}
          fill={rating.color}
          fillOpacity={isEmpty ? 0.15 : 0.25}
          stroke={rating.color}
          strokeWidth="2"
          strokeDasharray={isEmpty ? "5,5" : "none"}
        />
        
        {/* 数据点 */}
        {dataPoints.map((point, idx) => (
          <g key={idx}>
            <circle
              cx={point.x}
              cy={point.y}
              r={isEmpty ? 3 : 5}
              fill={levels[idx].color}
              stroke="#fff"
              strokeWidth="2"
            />
            <title>{levels[idx].label}: {point.value}%</title>
          </g>
        ))}
        
        {/* 标签 */}
        {labels.map((label, idx) => (
          <g key={idx}>
            <text
              x={label.x}
              y={label.y}
              textAnchor={label.anchor}
              dominantBaseline="middle"
              fill="#475569"
              fontSize="12"
              fontWeight="600"
            >
              {label.label}
            </text>
            <text
              x={label.x}
              y={label.y + 14}
              textAnchor={label.anchor}
              dominantBaseline="middle"
              fill={levels[idx].color}
              fontSize="10"
              fontWeight="700"
            >
              {dataPoints[idx].value}%
            </text>
          </g>
        ))}
      </svg>
      
      {/* 图例 */}
      <div className="radar-legend">
        {levels.map((level, idx) => (
          <div key={idx} className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: level.color }} />
            <span className="legend-label">{level.label}</span>
          </div>
        ))}
      </div>
      
      {/* 详细数据表格 */}
      {displayMastery && (
        <div className={`radar-detail-table ${isEmpty ? "is-demo" : ""}`}>
          {isEmpty && <div className="demo-badge">示例数据</div>}
          <table>
            <thead>
              <tr>
                <th>层级</th>
                <th>正确率</th>
                <th>平均耗时</th>
                <th>蒙猜嫌疑</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((level) => {
                const stats = displayMastery.questionAttemptStats[level.level];
                return (
                  <tr key={level.level}>
                    <td>
                      <span className="level-dot" style={{ backgroundColor: level.color }} />
                      {level.label}
                    </td>
                    <td>{stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}%</td>
                    <td>{stats.avgTimeSpent > 0 ? `${Math.round(stats.avgTimeSpent)}s` : "-"}</td>
                    <td className={stats.guessRate > 0.3 ? "warning" : ""}>
                      {Math.round(stats.guessRate * 100)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
