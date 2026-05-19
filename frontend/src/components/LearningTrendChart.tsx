import { useMemo } from "react";

interface DataPoint {
  date: string;
  mastery: number;
  studyTime: number;
  attempts: number;
}

interface Props {
  title?: string;
}

// 学习趋势折线图（用纯CSS/SVG实现）
export function LearningTrendChart({ title = "📈 学习趋势" }: Props) {
  // 生成示例趋势数据（最近7天）
  const trendData: DataPoint[] = useMemo(() => {
    const data: DataPoint[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      data.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        mastery: 0.3 + Math.random() * 0.4 + (6 - i) * 0.05,
        studyTime: Math.floor(Math.random() * 120 + 30),
        attempts: Math.floor(Math.random() * 10 + 2),
      });
    }
    return data;
  }, []);
  
  const maxMastery = 1;
  const maxTime = Math.max(...trendData.map((d) => d.studyTime));
  const maxAttempts = Math.max(...trendData.map((d) => d.attempts));
  
  // 计算平均线
  const avgMastery = trendData.reduce((sum, d) => sum + d.mastery, 0) / trendData.length;
  
  // 生成SVG路径
  const masteryPath = trendData
    .map((d, i) => {
      const x = 60 + (i / (trendData.length - 1)) * 340;
      const y = 180 - (d.mastery / maxMastery) * 140;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  
  const timePath = trendData
    .map((d, i) => {
      const x = 60 + (i / (trendData.length - 1)) * 340;
      const y = 180 - (d.studyTime / maxTime) * 140;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  
  return (
    <div className="learning-trend-chart">
      <div className="chart-header">
        <h5>{title}</h5>
        <div className="chart-legend">
          <span className="legend-item"><span className="line" style={{ borderColor: "#3b82f6" }} /> 掌握度</span>
          <span className="legend-item"><span className="line" style={{ borderColor: "#10b981" }} /> 学习时长</span>
          <span className="legend-item"><span className="dashed" style={{ borderColor: "#f59e0b" }} /> 平均线</span>
        </div>
      </div>
      
      <svg viewBox="0 0 420 220" className="trend-svg">
        {/* 网格线 */}
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1="50"
            y1={40 + i * 35}
            x2="400"
            y2={40 + i * 35}
            stroke="#e2e8f0"
            strokeDasharray="4,4"
          />
        ))}
        
        {/* Y轴标签 */}
        <text x="45" y="45" textAnchor="end" className="axis-label">100%</text>
        <text x="45" y="80" textAnchor="end" className="axis-label">75%</text>
        <text x="45" y="115" textAnchor="end" className="axis-label">50%</text>
        <text x="45" y="150" textAnchor="end" className="axis-label">25%</text>
        <text x="45" y="185" textAnchor="end" className="axis-label">0%</text>
        
        {/* X轴标签 */}
        {trendData.map((d, i) => (
          <text
            key={i}
            x={60 + (i / (trendData.length - 1)) * 340}
            y="205"
            textAnchor="middle"
            className="axis-label"
          >
            {d.date}
          </text>
        ))}
        
        {/* 平均线 */}
        <line
          x1="60"
          y1={180 - avgMastery * 140}
          x2="400"
          y2={180 - avgMastery * 140}
          stroke="#f59e0b"
          strokeDasharray="6,3"
          strokeWidth="2"
        />
        
        {/* 掌握度曲线 */}
        <path d={masteryPath} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
        
        {/* 学习时长曲线 */}
        <path d={timePath} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="4,2" strokeLinecap="round" />
        
        {/* 数据点 */}
        {trendData.map((d, i) => {
          const x = 60 + (i / (trendData.length - 1)) * 340;
          const y = 180 - (d.mastery / maxMastery) * 140;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="6" fill="#3b82f6" stroke="#fff" strokeWidth="2" />
              <title>{`${d.date}: 掌握度 ${Math.round(d.mastery * 100)}%, 学习 ${d.studyTime}分钟, 尝试 ${d.attempts}次`}</title>
            </g>
          );
        })}
      </svg>
      
      {/* 统计摘要 */}
      <div className="trend-stats">
        <div className="stat-item">
          <span className="stat-label">趋势</span>
          <span className="stat-value" style={{ color: trendData[6].mastery > trendData[0].mastery ? "#10b981" : "#ef4444" }}>
            {trendData[6].mastery > trendData[0].mastery ? "↑" : "↓"} {Math.abs(Math.round((trendData[6].mastery - trendData[0].mastery) * 100))}%
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">平均时长</span>
          <span className="stat-value">{Math.round(trendData.reduce((s, d) => s + d.studyTime, 0) / trendData.length)}分钟</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">本周尝试</span>
          <span className="stat-value">{trendData.reduce((s, d) => s + d.attempts, 0)}次</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">峰值日</span>
          <span className="stat-value">{trendData.reduce((max, d) => d.mastery > max.mastery ? d : max, trendData[0]).date}</span>
        </div>
      </div>
    </div>
  );
}
