import { useMemo } from "react";
import type { ProgressStatus } from "../types";

interface StatusCount {
  status: ProgressStatus;
  count: number;
  label: string;
  color: string;
}

interface Props {
  statusCounts: StatusCount[];
  title?: string;
}

// 环形进度/分布图
export function ProgressDistributionChart({ statusCounts, title = "📊 学习进度分布" }: Props) {
  const total = useMemo(() => statusCounts.reduce((sum, s) => sum + s.count, 0), [statusCounts]);
  
  // 计算每段弧形的起止角度
  const arcs = useMemo(() => {
    let currentAngle = -90; // 从顶部开始
    return statusCounts.map((item) => {
      const percentage = total > 0 ? item.count / total : 0;
      const angle = percentage * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;
      
      // 计算SVG弧形路径
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      
      const radius = 70;
      const cx = 100;
      const cy = 100;
      
      const x1 = cx + radius * Math.cos(startRad);
      const y1 = cy + radius * Math.sin(startRad);
      const x2 = cx + radius * Math.cos(endRad);
      const y2 = cy + radius * Math.sin(endRad);
      
      const largeArc = angle > 180 ? 1 : 0;
      
      const path = angle >= 360
        ? `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} Z`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      
      return { ...item, percentage, path };
    });
  }, [statusCounts, total]);
  
  return (
    <div className="progress-distribution-chart">
      <div className="chart-header">
        <h5>{title}</h5>
      </div>
      
      <div className="chart-content">
        <svg viewBox="0 0 200 200" className="donut-svg">
          {/* 背景圈 */}
          <circle cx="100" cy="100" r="70" fill="none" stroke="#f1f5f9" strokeWidth="20" />
          
          {/* 数据弧 */}
          {arcs.map((arc, i) => (
            <path
              key={i}
              d={arc.path}
              fill={arc.color}
              className="donut-arc"
              style={{ opacity: arc.count > 0 ? 1 : 0.3 }}
            >
              <title>{`${arc.label}: ${arc.count}个 (${Math.round(arc.percentage * 100)}%)`}</title>
            </path>
          ))}
          
          {/* 中心文字 */}
          <text x="100" y="95" textAnchor="middle" className="donut-center-value">{total}</text>
          <text x="100" y="115" textAnchor="middle" className="donut-center-label">知识点</text>
        </svg>
        
        {/* 图例 */}
        <div className="donut-legend">
          {arcs.map((arc, i) => (
            <div key={i} className="legend-row">
              <span className="legend-color" style={{ backgroundColor: arc.color }} />
              <span className="legend-label">{arc.label}</span>
              <span className="legend-count">{arc.count}</span>
              <span className="legend-percent" style={{ color: arc.color }}>
                {Math.round(arc.percentage * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
