import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { NavBar, Button, Toast, Selector, DatePicker, TextArea } from 'antd-mobile'
import dayjs from 'dayjs'
import { api } from '../api'
import { todayISO } from '../format'
import CategoryIcon from '../components/CategoryIcon'

export default function TransactionForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState(null)
  const [categories, setCategories] = useState({ income: [], expense: [] })
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [datePickerVisible, setDatePickerVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [inc, exp] = await Promise.all([
          api('/categories?type=income'),
          api('/categories?type=expense'),
        ])
        setCategories({ income: inc.categories, expense: exp.categories })
        if (isEdit) {
          const d = await api(`/transactions/${id}`)
          const t = d.transaction
          setType(t.type)
          setAmount(String(t.amount))
          setCategoryId(t.category.id)
          setDate(t.date)
          setNote(t.note || '')
        }
      } catch (e) {
        Toast.show({ icon: 'fail', content: e.message })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, isEdit])

  const list = categories[type] || []
  const cat = list.find((c) => c.id === categoryId)

  const submit = async () => {
    const amountNum = Number(amount)
    if (!amountNum || amountNum <= 0) return Toast.show({ icon: 'fail', content: 'Masukkan nominal yang valid' })
    if (!cat) return Toast.show({ icon: 'fail', content: 'Pilih kategori dulu' })
    setSaving(true)
    try {
      const body = { type, amount: amountNum, categoryId: cat.id, date, note }
      if (isEdit) await api(`/transactions/${id}`, { method: 'PATCH', body })
      else await api('/transactions', { method: 'POST', body })
      Toast.show({ icon: 'success', content: isEdit ? 'Transaksi diperbarui' : 'Transaksi tersimpan' })
      navigate(-1)
    } catch (e) {
      Toast.show({ icon: 'fail', content: e.message })
    } finally {
      setSaving(false)
    }
  }

  const renderCat = (c) => (
    <div
      className={`cat-cell ${categoryId === c.id ? 'active' : ''}`}
      onClick={() => setCategoryId(c.id)}
      key={c.id}
    >
      <div className="cc-icon" style={{ background: `${c.color}1a` }}>
        <CategoryIcon name={c.icon} color={c.color} size={24} />
      </div>
      <div className="cc-name">{c.name}</div>
    </div>
  )

  return (
    <div className="form-page">
      <NavBar onBack={() => navigate(-1)} style={{ background: 'var(--bg)' }}>
        <div className="nav-bar-content">{isEdit ? 'Edit Transaksi' : 'Catat Transaksi'}</div>
      </NavBar>

      <div className="form-body">
        <div className="amount-field">
          <span className="currency">Rp</span>
          <input
            className="amount-input"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            autoFocus={!isEdit}
          />
        </div>

        <div className="form-field">
          <label>Tipe Transaksi</label>
          <Selector
            options={[
              { label: 'Pemasukan', value: 'income' },
              { label: 'Pengeluaran', value: 'expense' },
            ]}
            value={[type]}
            onChange={(v) => {
              const t = v[0] || 'expense'
              setType(t)
              setCategoryId(null)
            }}
          />
        </div>

        <div className="form-field">
          <label>Kategori</label>
          <div className="cat-grid">{list.map(renderCat)}</div>
        </div>

        <div className="form-field">
          <label>Tanggal</label>
          <Button block color="default" fill="outline" onClick={() => setDatePickerVisible(true)}>
            {dayjs(date).format('D MMMM YYYY')}
          </Button>
          <DatePicker
            visible={datePickerVisible}
            onClose={() => setDatePickerVisible(false)}
            value={dayjs(date).toDate()}
            max={dayjs().toDate()}
            onConfirm={(v) => setDate(dayjs(v).format('YYYY-MM-DD'))}
          />
        </div>

        <div className="form-field">
          <label>Catatan (opsional)</label>
          <TextArea placeholder="Contoh: belanja bulanan, gaji karyawan..." value={note} onChange={setNote} maxLength={500} showCount />
        </div>
      </div>

      <div className="form-footer">
        <Button block color="primary" onClick={submit} loading={saving}>
          {isEdit ? 'Simpan Perubahan' : 'Simpan Transaksi'}
        </Button>
      </div>
    </div>
  )
}
