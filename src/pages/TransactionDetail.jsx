import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { NavBar, Button, Toast, Dialog, List, Result } from 'antd-mobile'
import { EditSOutline, DeleteOutline } from 'antd-mobile-icons'
import { api } from '../api'
import { rupiah, formatDate } from '../format'
import CategoryIcon from '../components/CategoryIcon'

export default function TransactionDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [tx, setTx] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api(`/transactions/${id}`)
      .then((d) => setTx(d.transaction))
      .catch((e) => Toast.show({ icon: 'fail', content: e.message }))
      .finally(() => setLoading(false))
  }, [id])

  const remove = async () => {
    const ok = await Dialog.confirm({ content: 'Hapus transaksi ini?', cancelText: 'Batal', confirmText: 'Hapus' })
    if (!ok) return
    try {
      await api(`/transactions/${id}`, { method: 'DELETE' })
      Toast.show({ icon: 'success', content: 'Terhapus' })
      navigate('/transactions', { replace: true })
    } catch (e) {
      Toast.show({ icon: 'fail', content: e.message })
    }
  }

  if (loading) return null
  if (!tx) return <Result status="error" title="Transaksi tidak ditemukan" description="Mungkin sudah dihapus." />

  return (
    <div className="form-page">
      <NavBar onBack={() => navigate(-1)} style={{ background: 'var(--bg)' }}>
        <div className="nav-bar-content">Detail Transaksi</div>
      </NavBar>

      <div className="page">
        <div
          className="dash-header"
          style={{ background: tx.type === 'income' ? 'linear-gradient(135deg,#00b578,#34c98e)' : 'linear-gradient(135deg,#ff3141,#ff6b4a)' }}
        >
          <div className="balance-label">{tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</div>
          <div className="balance">{tx.type === 'income' ? '+' : '-'}{rupiah(tx.amount)}</div>
          <span className="month-chip">{formatDate(tx.date, 'D MMMM YYYY')}</span>
        </div>

        <div className="section-card">
          <List>
            <List.Item
              prefix={<CategoryIcon name={tx.category.icon} color={tx.category.color} size={20} />}
              extra={tx.category.name}
            >
              Kategori
            </List.Item>
            <List.Item extra={tx.note || '—'}>Catatan</List.Item>
            <List.Item extra={formatDate(tx.createdAt, 'D MMM YYYY, HH:mm')}>Dicatat</List.Item>
          </List>
        </div>

        <div className="form-footer">
          <Button
            block
            color="primary"
            style={{ marginBottom: 8 }}
            onClick={() => navigate(`/transactions/${id}/edit`)}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><EditSOutline /> Edit</span>
          </Button>
          <Button block color="danger" fill="outline" onClick={remove}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><DeleteOutline /> Hapus</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
