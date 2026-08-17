import { useCallback, useEffect, useState } from 'react'
import {
  NavBar, List, Button, Toast, Dialog, Popup, Input, TextArea, Selector, DatePicker, Tag, Empty, PullToRefresh, SwipeAction,
} from 'antd-mobile'
import { AddOutline, CheckCircleOutline, ClockCircleOutline, DeleteOutline, EditSOutline, UndoOutline } from 'antd-mobile-icons'
import dayjs from 'dayjs'
import { api } from '../api'
import { rupiah, todayISO, formatDate } from '../format'

const RECURRENCE = [
  { label: 'Sekali', value: 'once' },
  { label: 'Harian', value: 'daily' },
  { label: 'Mingguan', value: 'weekly' },
  { label: 'Bulanan', value: 'monthly' },
]

export default function Reminders() {
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api('/reminders')
      setReminders(d.reminders)
    } catch (e) {
      Toast.show({ icon: 'fail', content: e.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const complete = async (r) => {
    await api(`/reminders/${r.id}/complete`, { method: 'PATCH' })
    Toast.show({ icon: 'success', content: 'Ditandai sudah dikirim' })
    load()
  }
  const reactivate = async (r) => {
    await api(`/reminders/${r.id}/reactivate`, { method: 'PATCH' })
    load()
  }
  const remove = async (r) => {
    const ok = await Dialog.confirm({ content: `Hapus pengingat "${r.title}"?`, cancelText: 'Batal', confirmText: 'Hapus' })
    if (!ok) return
    try {
      await api(`/reminders/${r.id}`, { method: 'DELETE' })
      Toast.show({ icon: 'success', content: 'Terhapus' })
      load()
    } catch (e) {
      Toast.show({ icon: 'fail', content: e.message })
    }
  }

  const active = reminders.filter((r) => r.status === 'active')
  const done = reminders.filter((r) => r.status === 'completed')

  return (
    <PullToRefresh onRefresh={load}>
      <div className="page">
        <NavBar
          back={null}
          right={<Button size="small" color="primary" onClick={() => setEditing({})}><AddOutline /></Button>}
        >
          <div className="nav-bar-content">Pengingat Kirim Uang</div>
        </NavBar>

        {loading && reminders.length === 0 && <div className="empty-box">Memuat...</div>}

        {!loading && active.length === 0 && done.length === 0 && (
          <Empty description="Belum ada pengingat. Tambahkan untuk kewajiban rutin (cicilan, uang saku, dll)." />
        )}

        {active.length > 0 && (
          <>
            <div className="section-label">Aktif ({active.length})</div>
            <div className="section-card" style={{ marginTop: 4 }}>
              <List>
                {active.map((r) => (
                  <SwipeAction
                    key={r.id}
                    rightActions={[
                      { key: 'edit', text: <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><EditSOutline />Edit</span>, color: 'primary', onClick: () => setEditing(r) },
                      { key: 'done', text: <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><CheckCircleOutline />Selesai</span>, color: 'success', onClick: () => complete(r) },
                      { key: 'del', text: <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><DeleteOutline />Hapus</span>, color: 'danger', onClick: () => remove(r) },
                    ]}
                  >
                    <List.Item
                      prefix={<div className="tx-icon"><ClockCircleOutline fontSize={22} color="#1677ff" /></div>}
                      description={
                        <span className="meta">
                          {formatDate(r.dueDate)} · {r.recurrence}
                          {dayjs(r.dueDate).isBefore(dayjs(), 'day') && (
                            <Tag color="danger" style={{ marginLeft: 6 }}>Tenggat</Tag>
                          )}
                        </span>
                      }
                      extra={r.amount > 0 ? <span className="tx-amt">{rupiah(r.amount)}</span> : null}
                    >
                      <span className="name">{r.title}</span>
                    </List.Item>
                  </SwipeAction>
                ))}
              </List>
            </div>
          </>
        )}

        {done.length > 0 && (
          <>
            <div className="section-label">Selesai ({done.length})</div>
            <div className="section-card" style={{ marginTop: 4 }}>
              <List>
                {done.map((r) => (
                  <List.Item
                    key={r.id}
                    prefix={<div className="tx-icon" style={{ background: '#e8f8f0' }}><CheckCircleOutline fontSize={22} color="#00b578" /></div>}
                    description={<span className="meta">{formatDate(r.dueDate)} · selesai</span>}
                    extra={
                      <Button size="mini" fill="outline" color="primary" onClick={() => reactivate(r)}>
                        <UndoOutline />
                      </Button>
                    }
                  >
                    <span className="name" style={{ textDecoration: 'line-through', color: 'var(--text-secondary)' }}>{r.title}</span>
                  </List.Item>
                ))}
              </List>
            </div>
          </>
        )}
      </div>

      <ReminderForm
        visible={Boolean(editing)}
        reminder={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          load()
        }}
      />
    </PullToRefresh>
  )
}

function ReminderForm({ visible, reminder, onClose, onSaved }) {
  const isEdit = Boolean(reminder?.id)
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [recurrence, setRecurrence] = useState('monthly')
  const [dueDate, setDueDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [dateVisible, setDateVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!reminder) return
    setTitle(reminder.title || '')
    setAmount(reminder.amount ? String(reminder.amount) : '')
    setRecurrence(reminder.recurrence || 'monthly')
    setDueDate(reminder.dueDate || todayISO())
    setNotes(reminder.notes || '')
  }, [reminder])

  const save = async () => {
    if (!title.trim()) return Toast.show({ icon: 'fail', content: 'Isi judul pengingat' })
    setSaving(true)
    try {
      const body = { title, amount: Number(amount) || 0, recurrence, dueDate, notes }
      if (isEdit) await api(`/reminders/${reminder.id}`, { method: 'PATCH', body })
      else await api('/reminders', { method: 'POST', body })
      Toast.show({ icon: 'success', content: isEdit ? 'Pengingat diperbarui' : 'Pengingat dibuat' })
      onSaved()
    } catch (e) {
      Toast.show({ icon: 'fail', content: e.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: '16px' }}
    >
      <div style={{ maxHeight: '82vh', overflowY: 'auto' }}>
        <div className="section-title" style={{ marginBottom: 12 }}>
          {isEdit ? 'Edit Pengingat' : 'Buat Pengingat'}
        </div>

        <div className="form-field">
          <label>Judul</label>
          <Input placeholder="Contoh: Transfer cicilan motor" value={title} onChange={setTitle} />
        </div>
        <div className="form-field">
          <label>Nominal (opsional)</label>
          <Input type="number" placeholder="0" value={amount} onChange={(v) => setAmount(v.replace(/[^\d.]/g, ''))} />
        </div>
        <div className="form-field">
          <label>Berulang</label>
          <Selector options={RECURRENCE} value={[recurrence]} onChange={(v) => setRecurrence(v[0] || 'monthly')} />
        </div>
        <div className="form-field">
          <label>Tanggal Jatuh Tempo</label>
          <Button block fill="outline" color="default" onClick={() => setDateVisible(true)}>
            {dayjs(dueDate).format('D MMMM YYYY')}
          </Button>
          <DatePicker
            visible={dateVisible}
            onClose={() => setDateVisible(false)}
            value={dayjs(dueDate).toDate()}
            min={dayjs().subtract(1, 'month').toDate()}
            onConfirm={(v) => setDueDate(dayjs(v).format('YYYY-MM-DD'))}
          />
        </div>
        <div className="form-field">
          <label>Catatan (opsional)</label>
          <TextArea placeholder="Catatan tambahan..." value={notes} onChange={setNotes} maxLength={500} showCount />
        </div>

        <Button block color="primary" onClick={save} loading={saving} style={{ marginTop: 8 }}>
          {isEdit ? 'Simpan Perubahan' : 'Simpan Pengingat'}
        </Button>
      </div>
    </Popup>
  )
}
