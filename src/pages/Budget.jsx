import { useCallback, useEffect, useState } from 'react'
import { NavBar, Button, Toast, Input, Dialog, ProgressBar, Tag } from 'antd-mobile'
import { LeftOutline, RightOutline, SetOutline, CheckCircleOutline, ExclamationCircleOutline } from 'antd-mobile-icons'
import dayjs from 'dayjs'
import { api } from '../api'
import { rupiah, shortRupiah, monthLabel } from '../format'
import CategoryIcon from '../components/CategoryIcon'

export default function Budget() {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'))
  const [data, setData] = useState(null)
  const [alloc, setAlloc] = useState({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (m) => {
    try {
      const d = await api('/budgets', { params: { month: m } })
      setData(d)
      const map = {}
      for (const b of d.budgets) map[b.categoryId] = b.allocated
      setAlloc(map)
    } catch (e) {
      Toast.show({ icon: 'fail', content: e.message })
    }
  }, [])

  useEffect(() => {
    load(month)
  }, [month, load])

  const totalAllocated = Object.values(alloc).reduce((a, b) => a + (Number(b) || 0), 0)
  const limit = Math.max(data?.income || 0, data?.incomeAvg3 || 0)
  const overLimit = limit > 0 && totalAllocated > limit

  const shiftMonth = (delta) => {
    setMonth(dayjs(month + '-01').add(delta, 'month').format('YYYY-MM'))
  }

  const applyAuto = async () => {
    const ok = await Dialog.confirm({
      content: 'Terapkan pembagian otomatis 50/30/20 berdasarkan pemasukan?',
      cancelText: 'Batal',
      confirmText: 'Terapkan',
    })
    if (!ok) return
    try {
      const r = await api('/budgets/auto', { method: 'POST', body: { month } })
      Toast.show({ icon: 'success', content: `Alokasi dibuat. Tabungan ${shortRupiah(r.savings)}` })
      load(month)
    } catch (e) {
      Toast.show({ icon: 'fail', content: e.message })
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const items = data.budgets
        .filter((b) => Number(alloc[b.categoryId]) > 0)
        .map((b) => ({ categoryId: b.categoryId, allocated: Number(alloc[b.categoryId]) || 0 }))
      await api('/budgets/bulk', { method: 'POST', body: { month, items } })
      Toast.show({ icon: 'success', content: 'Anggaran tersimpan' })
      load(month)
    } catch (e) {
      Toast.show({ icon: 'fail', content: e.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="form-page">
      <NavBar back={null} style={{ background: 'var(--bg)' }}>
        <div className="nav-bar-content">Alokasi Anggaran</div>
      </NavBar>

      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 12 }}>
          <LeftOutline fontSize={22} onClick={() => shiftMonth(-1)} />
          <div style={{ fontWeight: 700, fontSize: 16, minWidth: 150, textAlign: 'center' }}>
            {monthLabel(month)}
          </div>
          <RightOutline fontSize={22} onClick={() => shiftMonth(1)} />
        </div>

        <div className="budget-summary">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div className="muted">Pemasukan bulan ini</div>
              <div className="big" style={{ color: 'var(--adm-color-success)' }}>{rupiah(data?.income || 0)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="muted">Total alokasi</div>
              <div className="big" style={{ color: overLimit ? 'var(--adm-color-danger)' : 'var(--adm-color-primary)' }}>
                {rupiah(totalAllocated)}
              </div>
            </div>
          </div>
          {overLimit && (
            <div style={{ marginTop: 8 }}>
              <Tag color="danger">Alokasi melebihi pemasukan ({rupiah(limit)})</Tag>
            </div>
          )}
          <Button
            block
            color="primary"
            fill="outline"
            size="small"
            style={{ marginTop: 12 }}
            onClick={applyAuto}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><SetOutline /> Terapkan Otomatis (50/30/20)</span>
          </Button>
        </div>

        <div className="section-label">Alokasi per Kategori</div>
        <div className="section-card" style={{ marginTop: 4 }}>
          {data?.budgets.map((b) => {
            const allocated = Number(alloc[b.categoryId]) || 0
            const pct = allocated > 0 ? Math.min((b.spent / allocated) * 100, 100) : 0
            const state = allocated > 0 && b.spent >= allocated ? 'over' : allocated > 0 && pct >= 80 ? 'close' : 'ok'
            return (
              <div className="progress-row" key={b.categoryId}>
                <div className="progress-head">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CategoryIcon name={b.icon} color={b.color} size={16} />
                    {b.name}
                  </span>
                  <span className={state === 'over' ? 'over' : state === 'close' ? 'close' : ''}>
                    {shortRupiah(b.spent)} / {shortRupiah(allocated)}
                  </span>
                </div>
                <ProgressBar
                  percent={pct}
                  style={{
                    '--track-width': '8px',
                    '--fill-color': state === 'over' ? 'var(--adm-color-danger)' : state === 'close' ? 'var(--adm-color-warning)' : b.color,
                  }}
                />
                <div className="budget-alloc-input" style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>
                    Alokasi bulanan
                  </span>
                  <Input
                    type="number"
                    placeholder="0"
                    value={alloc[b.categoryId] === undefined ? '' : String(alloc[b.categoryId])}
                    onChange={(v) => setAlloc((s) => ({ ...s, [b.categoryId]: v }))}
                    style={{ '--font-size': '15px', textAlign: 'right', maxWidth: 120 }}
                  />
                </div>
              </div>
            )
          })}
          {data && data.budgets.length === 0 && <div className="empty-box">Belum ada kategori pengeluaran.</div>}
        </div>

        <div className="form-footer">
          <Button block color="primary" onClick={save} loading={saving}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CheckCircleOutline /> Simpan Anggaran</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
