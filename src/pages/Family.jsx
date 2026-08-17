import { useCallback, useEffect, useState } from 'react'
import {
  NavBar, Button, Toast, Dialog, List, Input, Tag, Popup, PullToRefresh, Result, Empty,
} from 'antd-mobile'
import { AddOutline, LinkOutline, DeleteOutline, EyeOutline, EyeInvisibleOutline, RightOutline, TeamOutline } from 'antd-mobile-icons'
import dayjs from 'dayjs'
import { api } from '../api'
import { rupiah, shortRupiah, formatDate } from '../format'
import CategoryIcon from '../components/CategoryIcon'

export default function Family() {
  const [family, setFamily] = useState(undefined)
  const [createName, setCreateName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [viewing, setViewing] = useState(null)

  const load = useCallback(async () => {
    try {
      const d = await api('/family')
      setFamily(d.family)
    } catch (e) {
      Toast.show({ icon: 'fail', content: e.message })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const createFamily = async () => {
    if (!createName.trim()) return Toast.show({ icon: 'fail', content: 'Isi nama keluarga' })
    try {
      await api('/family', { method: 'POST', body: { name: createName } })
      Toast.show({ icon: 'success', content: 'Keluarga dibuat!' })
      load()
    } catch (e) {
      Toast.show({ icon: 'fail', content: e.message })
    }
  }

  const joinFamily = async () => {
    if (!joinCode.trim()) return Toast.show({ icon: 'fail', content: 'Masukkan kode undangan' })
    try {
      await api('/family/join', { method: 'POST', body: { code: joinCode } })
      Toast.show({ icon: 'success', content: 'Bergabung berhasil!' })
      load()
    } catch (e) {
      Toast.show({ icon: 'fail', content: e.message })
    }
  }

  const invite = async () => {
    try {
      const d = await api('/family/invite', { method: 'POST', body: {} })
      setFamily((f) => ({
        ...f,
        invitations: [...(f.invitations || []), d.invitation],
      }))
      Toast.show({ icon: 'success', content: `Kode: ${d.invitation.code}` })
    } catch (e) {
      Toast.show({ icon: 'fail', content: e.message })
    }
  }

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      Toast.show({ icon: 'success', content: 'Disalin!' })
    } catch {
      Toast.show({ content: text })
    }
  }

  const revokeInvite = async (inv) => {
    const ok = await Dialog.confirm({ content: 'Cabut undangan ini?', cancelText: 'Batal', confirmText: 'Cabut' })
    if (!ok) return
    try {
      await api(`/family/invitations/${inv.id}`, { method: 'DELETE' })
      load()
    } catch (e) {
      Toast.show({ icon: 'fail', content: e.message })
    }
  }

  const toggleVisibility = async (member) => {
    try {
      await api(`/family/members/${member.userId}`, {
        method: 'PATCH',
        body: { visibility: member.visibility === 'public' ? 'private' : 'public' },
      })
      load()
    } catch (e) {
      Toast.show({ icon: 'fail', content: e.message })
    }
  }

  const removeMember = async (member) => {
    const ok = await Dialog.confirm({ content: `Keluarkan ${member.name} dari keluarga?`, cancelText: 'Batal', confirmText: 'Keluarkan' })
    if (!ok) return
    try {
      await api(`/family/members/${member.userId}`, { method: 'DELETE' })
      Toast.show({ icon: 'success', content: 'Anggota dikeluarkan' })
      load()
    } catch (e) {
      Toast.show({ icon: 'fail', content: e.message })
    }
  }

  if (family === undefined) return <div className="page"><div className="center-screen" /></div>

  if (family === null) {
    return (
      <div className="page">
        <NavBar back={null}><div className="nav-bar-content">Keluarga</div></NavBar>
        <Result
          icon={<TeamOutline fontSize={48} color="#1677ff" />}
          title="Belum ada keluarga"
          description="Buat keluarga baru atau bergabung dengan kode undangan."
        />
        <div className="section-card">
          <div className="section-title">Buat Keluarga Baru</div>
          <div className="budget-alloc-input">
            <Input placeholder="Nama keluarga (mis. Keluarga Sani)" value={createName} onChange={setCreateName} />
          </div>
          <Button block color="primary" style={{ marginTop: 12 }} onClick={createFamily}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AddOutline /> Buat Keluarga</span>
          </Button>
        </div>
        <div className="section-card">
          <div className="section-title">Gabung dengan Kode</div>
          <div className="budget-alloc-input">
            <Input placeholder="Kode undangan (contoh: A1B2C3D4)" value={joinCode} onChange={setJoinCode} />
          </div>
          <Button block color="primary" fill="outline" style={{ marginTop: 12 }} onClick={joinFamily}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><LinkOutline /> Gabung</span>
          </Button>
        </div>
      </div>
    )
  }

  const isAdmin = family.myRole === 'admin'

  return (
    <PullToRefresh onRefresh={load}>
      <div className="page">
        <NavBar back={null}><div className="nav-bar-content">{family.name}</div></NavBar>

        <div className="section-card" style={{ marginTop: 0 }}>
          <div className="section-title">
            <span>Anggota ({family.members.length})</span>
          </div>
          <List>
            {family.members.map((m) => (
              <List.Item
                key={m.userId}
                prefix={<div className="avatar">{m.name[0]?.toUpperCase()}</div>}
                description={
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                    <Tag className={`badge-role ${m.role === 'admin' ? 'badge-admin' : 'badge-member'}`}>{m.role}</Tag>
                    <Tag className={`badge-role ${m.visibility === 'public' ? 'badge-public' : 'badge-private'}`}>
                      {m.visibility === 'public' ? 'Terbuka' : 'Privat'}
                    </Tag>
                  </div>
                }
                extra={
                  isAdmin && m.userId !== family.ownerId ? (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ color: 'var(--adm-color-primary)' }} onClick={() => toggleVisibility(m)}>
                        {m.visibility === 'public' ? <EyeInvisibleOutline /> : <EyeOutline />}
                      </span>
                      <span style={{ color: 'var(--adm-color-danger)' }} onClick={() => removeMember(m)}>
                        <DeleteOutline />
                      </span>
                    </div>
                  ) : isAdmin ? (
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Pemilik</span>
                  ) : null
                }
                onClick={isAdmin ? () => setViewing(m) : undefined}
              >
                <span style={{ fontWeight: 600 }}>{m.name}</span>
              </List.Item>
            ))}
          </List>
        </div>

        {isAdmin && (
          <>
            <div className="section-card">
              <div className="section-title">Undang Anggota</div>
              <Button block color="primary" fill="outline" onClick={invite}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AddOutline /> Buat Kode Undangan</span>
              </Button>
              {family.invitations.length > 0 && (
                <>
                  <div className="group-label">Kode aktif (berlaku 7 hari)</div>
                  {family.invitations.map((inv) => (
                    <div key={inv.id} style={{ marginBottom: 8 }}>
                      <div className="invite-code" onClick={() => copy(inv.code)}>
                        {inv.code}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                        <span>{inv.email || 'Siapa saja'} · {dayjs(inv.expiresAt).format('D MMM')}</span>
                        <span style={{ color: 'var(--adm-color-danger)' }} onClick={() => revokeInvite(inv)}>Cabut</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
            <div className="section-card" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Tap anggota untuk melihat transaksinya bulan ini (hanya yang berstatus terbuka).
            </div>
          </>
        )}
      </div>

      <MemberTransactions member={viewing} onClose={() => setViewing(null)} />
    </PullToRefresh>
  )
}

function MemberTransactions({ member, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!member) return
    setLoading(true)
    setError('')
    setData(null)
    api(`/family/member/${member.userId}/transactions`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [member])

  return (
    <Popup
      visible={Boolean(member)}
      onMaskClick={onClose}
      bodyStyle={{ height: '80vh', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: '16px 16px 24px' }}
    >
      {member && (
        <div style={{ overflowY: 'auto', height: '100%' }}>
          <div className="section-title" style={{ marginBottom: 12 }}>
            Transaksi {member.name}
            <span style={{ fontSize: 12, color: 'var(--adm-color-primary)', fontWeight: 500 }} onClick={onClose}>Tutup</span>
          </div>
          {loading && <div className="empty-box">Memuat...</div>}
          {error && <div className="empty-box" style={{ color: 'var(--adm-color-danger)' }}>{error}</div>}
          {data && (
            <>
              <div className="stat-mini">
                <div className="box"><div className="l">Pemasukan</div><div className="v" style={{ color: 'var(--adm-color-success)' }}>{shortRupiah(data.income)}</div></div>
                <div className="box"><div className="l">Pengeluaran</div><div className="v" style={{ color: 'var(--adm-color-danger)' }}>{shortRupiah(data.expense)}</div></div>
                <div className="box"><div className="l">Selisih</div><div className="v">{shortRupiah(data.income - data.expense)}</div></div>
              </div>
              {data.transactions.length === 0 ? (
                <Empty description="Tidak ada transaksi bulan ini" />
              ) : (
                <List>
                  {data.transactions.map((t) => (
                    <List.Item
                      key={t.id}
                      prefix={<div className="tx-icon"><CategoryIcon name={t.category.icon} color={t.category.color} size={18} /></div>}
                      description={<span className="meta">{formatDate(t.date)} · {t.category.name}</span>}
                      extra={<span className={`tx-amt ${t.type}`}>{t.type === 'income' ? '+' : '-'}{rupiah(t.amount)}</span>}
                    >
                      <span className="name">{t.note || t.category.name}</span>
                    </List.Item>
                  ))}
                </List>
              )}
            </>
          )}
        </div>
      )}
    </Popup>
  )
}
