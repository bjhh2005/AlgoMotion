interface GaugeData {
  label: string;
  value: number;
  max: number;
  unit: string;
  color: string;
  thresholds?: { warning: number; danger: number };
}

interface Props {
  gauges: GaugeData[];
  title?: string;
}

// 学习效率仪表盘
export function EfficiencyGauge({ gauges, title = "⚡ 学习效率指标" }: Props) {
  return (
    <div className="efficiency-gauge">
      <div className="gauge-header">
        <h5>{title}</h5>
      </div>
      
      <div className="gauge-grid">
        {gauges.map((gauge, i) => {
          const percentage = (gauge.value / gauge.max) * 100;
          const isWarning = gauge.thresholds && percentage < gauge.thresholds.warning;
          const isDanger = gauge.thresholds && percentage < gauge.thresholds.danger;
          const color = isDanger ? "#ef4444" : isWarning ? "#f59e0b" : gauge.color;
          
          // SVG圆弧计算
          const radius = 50;
          const circumference = 2 * Math.PI * radius;
          const strokeDashoffset = circumference - (percentage / 100) * circumference;
          
          return (
            <div key={i} className="gauge-item">
              <svg viewBox="0 0 120 120" className="gauge-svg">
                {/* 背景弧 */}
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke="#f1f5f9"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${circumference / 2} ${circumference}`}
                  transform="rotate(135 60 60)"
                />
                {/* 数值弧 */}
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke={color}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${circumference / 2} ${circumference}`}
                  strokeDashoffset={strokeDashoffset}
                  transform="rotate(135 60 60)"
                  className="gauge-progress"
                />
                {/* 中心值 */}
                <text x="60" y="55" textAnchor="middle" className="gauge-value" fill={color}>
                  {Math.round(gauge.value)}
                </text>
                <text x="60" y="72" textAnchor="middle" className="gauge-unit" fill="#94a3b8">
                  {gauge.unit}
                </text>
              </svg>
              <div className="gauge-label">{gauge.label}</div>
              {isDanger && <span className="gauge-alert">需关注</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
