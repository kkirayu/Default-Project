import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PullToRefresh, List, Badge, Empty, Button, SpinLoading } from 'antd-mobile'
import { BellOutline, PayCircleOutline } from 'antd-mobile-icons'
import { api } from '../api'
import { useAuth } from '../AuthContext'
import { rupiah, shortRupiah, formatDate, monthLabel } from '../format'
import CategoryIcon from '../components/CategoryIcon'
import { TrendChart, Donut } from '../components/Charts'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [reminderCount, setReminderCount] = useState(0)

  const load = async () => {
    const [d, r] = await Promise.all([
      api('/dashboard'),
      api('/reminders').catch(() => ({ reminders: [] })),
    ])
    setData(d)
    setReminderCount(r.reminders.filter((x) => x.status === 'active').length)
  }

  useEffect(() => {
    load().catch(() => {})
  }, [])

  if (!data) {
    return (
      <div className="page">
        <div className="empty-box"><SpinLoading color="primary" /></div>
      </div>
    )
  }

  const breakdown = data.categoryBreakdown.filter((c) => c.total > 0)
  const donutData = breakdown.map((c) => ({ id: c.id, value: c.total, color: c.color }))

  return (
    <PullToRefresh onRefresh={load}>
      <div className="page">
        <div className="dash-header">
          <div className="greeting">
            <span className="name">Halo, {user?.name?.split(' ')[0]} 👋</span>
            <Link to="/reminders" className="bell-btn">
              <BellOutline fontSize={18} />
              {reminderCount > 0 && <Badge content={reminderCount} style={{ position: 'absolute', top: -4, right: -4 }} />}
            </Link>
          </div>
          <div className="balance-label">Saldo bulan ini</div>
          <div className="balance">{rupiah(data.monthBalance)}</div>
          <span className="month-chip">{monthLabel(data.month)}</span>
        </div>

        <div className="stat-row">
          <div className="stat-card">
            <div className="label">Pemasukan</div>
            <div className="value income">{shortRupiah(data.monthIncome)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Pengeluaran</div>
            <div className="value expense">{shortRupiah(data.monthExpense)}</div>
          </div>
        </div>

        <div className="section-card">
          <div className="reco-box">
            <div className="ico"><PayCircleOutline fontSize={22} /></div>
            <div className="txt">
              <span>Rekomendasi budget bulanan</span>
              <div><b>{rupiah(data.budgetRecommendation)}</b></div>
            </div>
            <Button size="mini" color="primary" fill="outline" onClick={() => navigate('/budget')}>
              Atur
            </Button>
          </div>
        </div>

        <div className="section-card">
          <div className="section-title">
            <span>Statistik 6 Bulan</span>
            <span className="trend-legend">
              <span><span className="dot" style={{ background: 'var(--adm-color-success)' }} />Masuk</span>
              <span><span className="dot" style={{ background: 'var(--adm-color-primary)' }} />Keluar</span>
            </span>
          </div>
          <TrendChart data={data.trend} />
        </div>

        <div className="section-card">
          <div className="section-title">
            <span>Pengeluaran per Kategori</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
              {shortRupiah(data.monthExpense)}
            </span>
          </div>
          {breakdown.length === 0 ? (
            <div className="empty-box">
              <Empty description="Belum ada pengeluaran bulan ini" />
              <Button color="primary" fill="outline" size="small" onClick={() => navigate('/transactions/new')}>
                Catat Transaksi
              </Button>
            </div>
          ) : (
            <div className="breakdown-wrap">
              <Donut data={donutData} />
              <div className="breakdown-list">
                {breakdown.slice(0, 5).map((c) => (
                  <div className="breakdown-item" key={c.id}>
                    <CategoryIcon name={c.icon} color={c.color} size={16} />
                    <span className="name">{c.name}</span>
                    <span className="amt">{shortRupiah(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="section-card">
          <div className="section-title">
            <span>Transaksi Terbaru</span>
            <Link to="/transactions">Lihat Semua</Link>
          </div>
          {data.recent.length === 0 ? (
            <div className="empty-box">Belum ada transaksi. Mulai catat sekarang!</div>
          ) : (
            <List>
              {data.recent.map((t) => (
                <List.Item
                  key={t.id}
                  prefix={
                    <div className="tx-icon">
                      <CategoryIcon name={t.category.icon} color={t.category.color} size={20} />
                    </div>
                  }
                  description={
                    <span className="tx-mid">
                      <span className="meta">
                        {t.category.name} · {formatDate(t.date)}
                      </span>
                    </span>
                  }
                  onClick={() => navigate(`/transactions/${t.id}`)}
                  extra={<span className={`tx-amt ${t.type}`}>{t.type === 'income' ? '+' : '-'}{shortRupiah(t.amount)}</span>}
                >
                  <span className="tx-mid">
                    <span className="name">{t.note || t.category.name}</span>
                  </span>
                </List.Item>
              ))}
            </List>
          )}
        </div>

        <div className="section-card">
          <div className="section-title">
            <span>Ringkasan Seluruh Waktu</span>
          </div>
          <div className="stat-mini">
            <div className="box">
              <div className="l">Total Masuk</div>
              <div className="v" style={{ color: 'var(--adm-color-success)' }}>{shortRupiah(data.totalIncome)}</div>
            </div>
            <div className="box">
              <div className="l">Total Keluar</div>
              <div className="v" style={{ color: 'var(--adm-color-danger)' }}>{shortRupiah(data.totalExpense)}</div>
            </div>
            <div className="box">
              <div className="l">Selisih</div>
              <div className="v">{shortRupiah(data.totalBalance)}</div>
            </div>
          </div>
        </div>
      </div>
    </PullToRefresh>
  )
}
