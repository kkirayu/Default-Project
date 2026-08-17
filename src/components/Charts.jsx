export function TrendChart({ data }) {
  const max = Math.max(...data.map((d) => Math.max(d.income, d.expense)), 1)
  return (
    <div className="trend">
      {data.map((d) => (
        <div className="trend-col" key={d.month}>
          <div className="bars">
            <div className="bar income" title={d.income} style={{ height: `${Math.max((d.income / max) * 100, 2)}%` }} />
            <div className="bar expense" title={d.expense} style={{ height: `${Math.max((d.expense / max) * 100, 2)}%` }} />
          </div>
          <div className="trend-label">{d.label}</div>
        </div>
      ))}
    </div>
  )
}

export function Donut({ data }) {
  const total = data.reduce((a, b) => a + b.value, 0)
  if (total <= 0) return <div className="donut-empty">Belum ada pengeluaran bulan ini</div>
  const r = 42
  const c = 2 * Math.PI * r
  let acc = 0
  return (
    <svg viewBox="0 0 100 100" className="donut">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#f2f3f5" strokeWidth="14" />
      {data.map((d) => {
        const frac = d.value / total
        const dash = frac * c
        const offset = -acc * c
        acc += frac
        return (
          <circle
            key={d.id}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={d.color}
            strokeWidth="14"
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={offset}
            transform="rotate(-90 50 50)"
          />
        )
      })}
    </svg>
  )
}
