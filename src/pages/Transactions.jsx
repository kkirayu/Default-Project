import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  NavBar, List, Selector, SearchBar, PullToRefresh, SwipeAction, Toast, Dialog, Empty, Badge,
} from 'antd-mobile'
import { CalendarOutline, DeleteOutline, EditSOutline } from 'antd-mobile-icons'
import { api } from '../api'
import { rupiah, shortRupiah, formatDate, currentMonth } from '../format'
import CategoryIcon from '../components/CategoryIcon'

export default function Transactions() {
  const navigate = useNavigate()
  const [month, setMonth] = useState(currentMonth())
  const [type, setType] = useState('')
  const [query, setQuery] = useState('')
  const [data, setData] = useState({ transactions: [] })
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api('/transactions', {
        params: {
          from: `${month}-01`,
          to: `${month}-31`,
          type: type || undefined,
          q: query || undefined,
          pageSize: 100,
        },
      })
      setData(d)
    } catch (e) {
      Toast.show({ icon: 'fail', content: e.message })
    } finally {
      setLoading(false)
    }
  }, [month, type, query])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (t) => {
    const ok = await Dialog.confirm({
      content: 'Hapus transaksi ini?',
      cancelText: 'Batal',
      confirmText: 'Hapus',
    })
    if (!ok) return
    try {
      await api(`/transactions/${t.id}`, { method: 'DELETE' })
      Toast.show({ icon: 'success', content: 'Terhapus' })
      load()
    } catch (e) {
      Toast.show({ icon: 'fail', content: e.message })
    }
  }

  const incomeSum = data.transactions.filter((t) => t.type === 'income').reduce((a, b) => a + b.amount, 0)
  const expenseSum = data.transactions.filter((t) => t.type === 'expense').reduce((a, b) => a + b.amount, 0)

  return (
    <div>
      <div className="sticky-nav">
        <NavBar
          back={null}
          onBack={() => navigate(-1)}
          right={
            <Badge content={data.transactions.length} style={{ '--color': 'var(--adm-color-primary)' }} />
          }
          style={{ background: 'transparent' }}
        >
          <div className="nav-bar-content">Riwayat Transaksi</div>
        </NavBar>
        <div className="filters" style={{ padding: '0 12px' }}>
          <Selector
            style={{ '--border-radius': '100px' }}
            options={[
              { label: 'Semua', value: '' },
              { label: 'Pemasukan', value: 'income' },
              { label: 'Pengeluaran', value: 'expense' },
            ]}
            value={[type]}
            onChange={(v) => setType(v[0] || '')}
          />
        </div>
        <div className="filters" style={{ padding: '0 12px 8px' }}>
          <SearchBar
            placeholder="Cari catatan atau kategori"
            value={query}
            onChange={setQuery}
            className="grow"
          />
          <CalendarOutline fontSize={26} color="#1677ff" onClick={() => setMonth(currentMonth())} />
        </div>
      </div>

      <div className="stat-mini" style={{ padding: '0 16px' }}>
        <div className="box"><div className="l">Pemasukan</div><div className="v" style={{ color: 'var(--adm-color-success)' }}>{shortRupiah(incomeSum)}</div></div>
        <div className="box"><div className="l">Pengeluaran</div><div className="v" style={{ color: 'var(--adm-color-danger)' }}>{shortRupiah(expenseSum)}</div></div>
        <div className="box"><div className="l">Selisih</div><div className="v">{shortRupiah(incomeSum - expenseSum)}</div></div>
      </div>

      <PullToRefresh onRefresh={load}>
        <div className="page">
          {data.transactions.length === 0 && !loading ? (
            <div className="empty-box">
              <Empty description="Tidak ada transaksi" />
            </div>
          ) : (
            <List>
              {data.transactions.map((t) => (
                <SwipeAction
                  key={t.id}
                  rightActions={[
                    {
                      key: 'edit',
                      text: <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><EditSOutline />Edit</span>,
                      color: 'primary',
                      onClick: () => navigate(`/transactions/${t.id}/edit`),
                    },
                    {
                      key: 'delete',
                      text: <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><DeleteOutline />Hapus</span>,
                      color: 'danger',
                      onClick: () => remove(t),
                    },
                  ]}
                >
                  <List.Item
                    prefix={
                      <div className="tx-icon">
                        <CategoryIcon name={t.category.icon} color={t.category.color} size={20} />
                      </div>
                    }
                    description={<span className="meta">{formatDate(t.date)} · {t.category.name}</span>}
                    onClick={() => navigate(`/transactions/${t.id}`)}
                    extra={<span className={`tx-amt ${t.type}`}>{t.type === 'income' ? '+' : '-'}{rupiah(t.amount)}</span>}
                  >
                    <span className="name">{t.note || t.category.name}</span>
                  </List.Item>
                </SwipeAction>
              ))}
            </List>
          )}
        </div>
      </PullToRefresh>
    </div>
  )
}
