import { useMemo } from "react";
import type { InvestmentEffectivenessAnalysis, EngagementCategory } from "../types";

interface Props {
  analyses: InvestmentEffectivenessAnalysis[];
  width?: number;
  height?: number;
}

// 学习投入-成效散点图组件 - 维度三：认知投入层级
export function InvestmentEffectivenessScatter({
  analyses,
  width = 500,
  height = 380,
}: Props) {
  const padding = { top: 40, right: 40, bottom: 60, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // 类别颜色和标签
  const categoryConfig: Record<EngagementCategory, { color: string; label: string; description: string }> = {
    efficient: {
      color: "#10b981",
      label: "高效型",
      description: "高投入，高产出",
    },
    inefficient: {
      color: "#ef4444",
      label: "低效型",
      description: "高投入，低产出",
    },
    diving: {
      color: "#3b82f6",
      label: "潜水型",
      description: "低投入，高产出",
    },
    dormant: {
      color: "#94a3b8",
      label: "待激活",
      description: "低投入，低产出",
    },
  };
  
  // 计算数据点位置
  const { points, axisConfig, quadrantLines } = useMemo(() => {
    if (analyses.length === 0) {
      return { points: [], axisConfig: { xMin: 0, xMax: 100, yMin: 0, yMax: 100 }, quadrantLines: [] };
    }
    
    // 计算投入和成效
    const dataWithCoords = analyses.map((a) => ({
      ...a,
      investment: a.investment.studyTimeMinutes + a.investment.practiceTimeMinutes,
      effectiveness: a.effectiveness.masteryGain * 100,
    }));
    
    // 归一化坐标
    const xMin = 0;
    const xMax = Math.max(...dataWithCoords.map((d) => d.investment), 100);
    const yMin = Math.min(...dataWithCoords.map((d) => d.effectiveness), 0);
    const yMax = Math.max(...dataWithCoords.map((d) => d.effectiveness), 100);
    
    const scaleX = (x: number) => padding.left + ((x - xMin) / (xMax - xMin)) * chartWidth;
    const scaleY = (y: number) => padding.top + chartHeight - ((y - yMin) / (yMax - yMin)) * chartHeight;
    
    const scaledPoints = dataWithCoords.map((d) => ({
      ...d,
      x: scaleX(d.investment),
      y: scaleY(d.effectiveness),
      scaledRadius: 8 + d.efficiencyScore * 0.15,
    }));
    
    // 象限分割线（中位数）
    const medianX = [...dataWithCoords].sort((a, b) => a.investment - b.investment)[
      Math.floor(dataWithCoords.length / 2)
    ].investment;
    const medianY = [...dataWithCoords].sort((a, b) => a.effectiveness - b.effectiveness)[
      Math.floor(dataWithCoords.length / 2)
    ].effectiveness;
    
    const quadrantLines = [
      { x: scaleX(medianX), type: "vertical" },
      { y: scaleY(medianY), type: "horizontal" },
    ];
    
    return {
      points: scaledPoints,
      axisConfig: { xMin, xMax, yMin, yMax },
      quadrantLines,
    };
  }, [analyses, chartWidth, chartHeight, padding]);
  
  // 生成坐标轴刻度
  const xTicks = useMemo(() => {
    const count = 5;
    const step = (axisConfig.xMax - axisConfig.xMin) / count;
    return Array.from({ length: count + 1 }, (_, i) => axisConfig.xMin + step * i);
  }, [axisConfig]);
  
  const yTicks = useMemo(() => {
    const count = 5;
    const step = (axisConfig.yMax - axisConfig.yMin) / count;
    return Array.from({ length: count + 1 }, (_, i) => axisConfig.yMin + step * i);
  }, [axisConfig]);
  
  return (
    <div className="investment-effectiveness-scatter">
      <div className="scatter-header">
        <h5>学习投入-成效分析</h5>
        <div className="quadrant-legend">
          <span className="legend-item">
            <span className="dot efficient" />高效型
          </span>
          <span className="legend-item">
            <span className="dot inefficient" />低效型
          </span>
          <span className="legend-item">
            <span className="dot diving" />潜水型
          </span>
          <span className="legend-item">
            <span className="dot dormant" />待激活
          </span>
        </div>
      </div>
      
      <svg width={width} height={height}>
        <defs>
          <filter id="scatter-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        {/* 背景网格 */}
        <g className="grid">
          {yTicks.map((tick) => (
            <line
              key={`y-grid-${tick}`}
              x1={padding.left}
              x2={width - padding.right}
              y1={padding.top + chartHeight - ((tick - axisConfig.yMin) / (axisConfig.yMax - axisConfig.yMin)) * chartHeight}
              y2={padding.top + chartHeight - ((tick - axisConfig.yMin) / (axisConfig.yMax - axisConfig.yMin)) * chartHeight}
              stroke="#e2e8f0"
              strokeDasharray="4,4"
            />
          ))}
          {xTicks.map((tick) => (
            <line
              key={`x-grid-${tick}`}
              x1={padding.left + ((tick - axisConfig.xMin) / (axisConfig.xMax - axisConfig.xMin)) * chartWidth}
              x2={padding.left + ((tick - axisConfig.xMin) / (axisConfig.xMax - axisConfig.xMin)) * chartWidth}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke="#e2e8f0"
              strokeDasharray="4,4"
            />
          ))}
        </g>
        
        {/* 象限分割线 */}
        {quadrantLines.map((line, idx) => (
          <line
            key={idx}
            x1={line.type === "vertical" ? line.x : padding.left}
            x2={line.type === "vertical" ? line.x : width - padding.right}
            y1={line.type === "horizontal" ? line.y : padding.top}
            y2={line.type === "horizontal" ? line.y : height - padding.bottom}
            stroke="#94a3b8"
            strokeWidth="2"
            strokeDasharray="8,4"
          />
        ))}
        
        {/* 象限标签 */}
        <g className="quadrant-labels">
          <text x={padding.left + 20} y={padding.top + 20} fill="#10b981" fontSize="12" fontWeight="600">
            高效型
          </text>
          <text x={width - padding.right - 60} y={padding.top + 20} fill="#ef4444" fontSize="12" fontWeight="600">
            低效型
          </text>
          <text x={padding.left + 20} y={height - padding.bottom - 20} fill="#3b82f6" fontSize="12" fontWeight="600">
            潜水型
          </text>
          <text x={width - padding.right - 60} y={height - padding.bottom - 20} fill="#94a3b8" fontSize="12" fontWeight="600">
            待激活
          </text>
        </g>
        
        {/* 坐标轴 */}
        <g className="axes">
          {/* X轴 */}
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={height - padding.bottom}
            y2={height - padding.bottom}
            stroke="#475569"
            strokeWidth="2"
          />
          {xTicks.map((tick) => (
            <g key={`x-tick-${tick}`}>
              <line
                x1={padding.left + ((tick - axisConfig.xMin) / (axisConfig.xMax - axisConfig.xMin)) * chartWidth}
                x2={padding.left + ((tick - axisConfig.xMin) / (axisConfig.xMax - axisConfig.xMin)) * chartWidth}
                y1={height - padding.bottom}
                y2={height - padding.bottom + 6}
                stroke="#475569"
                strokeWidth="2"
              />
              <text
                x={padding.left + ((tick - axisConfig.xMin) / (axisConfig.xMax - axisConfig.xMin)) * chartWidth}
                y={height - padding.bottom + 20}
                textAnchor="middle"
                fill="#475569"
                fontSize="11"
              >
                {Math.round(tick)}
              </text>
            </g>
          ))}
          <text
            x={padding.left + chartWidth / 2}
            y={height - 10}
            textAnchor="middle"
            fill="#475569"
            fontSize="12"
            fontWeight="600"
          >
            学习投入（分钟）
          </text>
          
          {/* Y轴 */}
          <line
            x1={padding.left}
            x2={padding.left}
            y1={padding.top}
            y2={height - padding.bottom}
            stroke="#475569"
            strokeWidth="2"
          />
          {yTicks.map((tick) => (
            <g key={`y-tick-${tick}`}>
              <line
                x1={padding.left - 6}
                x2={padding.left}
                y1={padding.top + chartHeight - ((tick - axisConfig.yMin) / (axisConfig.yMax - axisConfig.yMin)) * chartHeight}
                y2={padding.top + chartHeight - ((tick - axisConfig.yMin) / (axisConfig.yMax - axisConfig.yMin)) * chartHeight}
                stroke="#475569"
                strokeWidth="2"
              />
              <text
                x={padding.left - 10}
                y={padding.top + chartHeight - ((tick - axisConfig.yMin) / (axisConfig.yMax - axisConfig.yMin)) * chartHeight}
                textAnchor="end"
                dominantBaseline="middle"
                fill="#475569"
                fontSize="11"
              >
                {Math.round(tick)}
              </text>
            </g>
          ))}
          <text
            x={20}
            y={padding.top + chartHeight / 2}
            textAnchor="middle"
            fill="#475569"
            fontSize="12"
            fontWeight="600"
            transform={`rotate(-90, 20, ${padding.top + chartHeight / 2})`}
          >
            掌握度提升（%）
          </text>
        </g>
        
        {/* 数据点 */}
        <g className="data-points">
          {points.map((point, idx) => {
            const config = categoryConfig[point.category];
            const isSuspicious = point.flags.suspectedFakeEffort || point.flags.potentialMethodIssue;
            
            return (
              <g
                key={idx}
                className="scatter-point"
                transform={`translate(${point.x}, ${point.y})`}
              >
                {isSuspicious && (
                  <circle
                    r={point.scaledRadius + 6}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                    strokeDasharray="4,4"
                    opacity={0.6}
                  />
                )}
                <circle
                  r={point.scaledRadius}
                  fill={config.color}
                  stroke="#fff"
                  strokeWidth="2"
                  opacity={0.85}
                  filter={isSuspicious ? "url(#scatter-glow)" : undefined}
                />
                <title>
                  {`学生: ${point.studentId}
投入: ${Math.round(point.investment)}分钟
成效: ${Math.round(point.effectiveness)}%
类型: ${config.label}
效率: ${Math.round(point.efficiencyScore)}分
${isSuspicious ? "⚠️ 可疑学习" : ""}`}
                </title>
              </g>
            );
          })}
        </g>
      </svg>
      
      {/* 统计摘要 */}
      <div className="scatter-summary">
        <div className="summary-grid">
          {(["efficient", "inefficient", "diving", "dormant"] as EngagementCategory[]).map((cat) => {
            const config = categoryConfig[cat];
            const count = analyses.filter((a) => a.category === cat).length;
            const percentage = analyses.length > 0 ? Math.round((count / analyses.length) * 100) : 0;
            
            return (
              <div key={cat} className="summary-item">
                <span className="dot" style={{ backgroundColor: config.color }} />
                <span className="label">{config.label}</span>
                <span className="count">{count}人</span>
                <span className="percentage">({percentage}%)</span>
              </div>
            );
          })}
        </div>
        
        {/* 可疑学习提示 */}
        {analyses.some((a) => a.flags.suspectedFakeEffort) && (
          <div className="suspicious-warning">
            <span className="warning-icon">⚠️</span>
            <span>检测到 {analyses.filter((a) => a.flags.suspectedFakeEffort).length} 名学生存在"假努力"嫌疑</span>
          </div>
        )}
      </div>
    </div>
  );
}
