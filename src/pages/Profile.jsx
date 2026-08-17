import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavBar, Button, Toast, Popup, Input, Tag, Dialog, List } from 'antd-mobile'
import { TeamOutline, BellOutline, UnorderedListOutline, EditSOutline, RightOutline, PayCircleOutline } from 'antd-mobile-icons'
import { api } from '../api'
import { useAuth } from '../AuthContext'
import { formatDate } from '../format'

export default function Profile() {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [editVisible, setEditVisible] = useState(false)
  const [name, setName] = useState('')
  const [family, setFamily] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(user?.name || '')
    api('/family').then((d) => setFamily(d.family)).catch(() => {})
  }, [user])

  const saveName = async () => {
    if (!name.trim()) return Toast.show({ icon: 'fail', content: 'Nama tidak boleh kosong' })
    setSaving(true)
    try {
      await api('/me', { method: 'PATCH', body: { name } })
      await refreshUser()
      setEditVisible(false)
      Toast.show({ icon: 'success', content: 'Profil diperbarui' })
    } catch (e) {
      Toast.show({ icon: 'fail', content: e.message })
    } finally {
      setSaving(false)
    }
  }

  const doLogout = async () => {
    const ok = await Dialog.confirm({ content: 'Keluar dari akun ini?', cancelText: 'Batal', confirmText: 'Keluar' })
    if (!ok) return
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="page">
      <NavBar back={null}><div className="nav-bar-content">Profil</div></NavBar>

      <div className="profile-hero">
        <div className="avatar">{user?.name?.[0]?.toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pname">{user?.name}</div>
          <div className="pemail">{user?.email}</div>
          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
            <Tag style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', border: 'none' }}>
              {family ? `${family.name} · ${family.myRole}` : 'Belum ada keluarga'}
            </Tag>
          </div>
        </div>
        <Button size="mini" fill="outline" style={{ '--border-color': 'rgba(255,255,255,0.5)', '--text-color': '#fff' }} onClick={() => setEditVisible(true)}>
          <EditSOutline />
        </Button>
      </div>

      <div className="section-card">
        <div className="link-row" onClick={() => navigate('/transactions')}>
          <span className="l-left"><UnorderedListOutline fontSize={20} color="#1677ff" /> Riwayat Transaksi</span>
          <RightOutline />
        </div>
        <div className="link-row" onClick={() => navigate('/family')}>
          <span className="l-left"><TeamOutline fontSize={20} color="#00b578" /> Keluarga</span>
          <RightOutline />
        </div>
        <div className="link-row" onClick={() => navigate('/reminders')}>
          <span className="l-left"><BellOutline fontSize={20} color="#ff8f1f" /> Pengingat</span>
          <RightOutline />
        </div>
        <div className="link-row" onClick={() => navigate('/budget')}>
          <span className="l-left"><PayCircleOutline fontSize={20} color="#8f5ce8" /> Alokasi Anggaran</span>
          <RightOutline />
        </div>
      </div>

      <div className="section-card" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        Akun dibuat {user?.createdAt ? formatDate(user.createdAt, 'D MMMM YYYY') : '-'}
      </div>

      <div className="logout-btn">
        <Button block color="danger" fill="outline" onClick={doLogout}>
          Keluar
        </Button>
      </div>

      <Popup
        visible={editVisible}
        onMaskClick={() => setEditVisible(false)}
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: '16px' }}
      >
        <div className="section-title" style={{ marginBottom: 12 }}>Edit Nama</div>
        <Input placeholder="Nama lengkap" value={name} onChange={setName} />
        <Button block color="primary" style={{ marginTop: 16 }} onClick={saveName} loading={saving}>
          Simpan
        </Button>
      </Popup>
    </div>
  )
}
