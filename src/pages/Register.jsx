import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Form, Input, Button, Toast } from 'antd-mobile'
import { PayCircleOutline, LockOutline, UserOutline, MailOutline } from 'antd-mobile-icons'
import { useAuth } from '../AuthContext'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values) => {
    setLoading(true)
    try {
      await register(values.name, values.email, values.password)
      Toast.show({ icon: 'success', content: 'Akun berhasil dibuat!' })
      navigate('/dashboard', { replace: true })
    } catch (e) {
      Toast.show({ icon: 'fail', content: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="logo">
          <PayCircleOutline fontSize={30} /> Dompet Keluarga
        </div>
        <p>Mulai catat pemasukan &amp; pengeluaran keluarga hari ini.</p>
      </div>
      <div className="auth-card">
        <h2>Daftar</h2>
        <p className="sub">Buat akun, lalu kelola keluarga &amp; transaksi bersama.</p>
        <Form
          layout="vertical"
          onFinish={onFinish}
          footer={
            <Button block type="submit" color="primary" size="large" loading={loading}>
              Daftar
            </Button>
          }
        >
          <Form.Item name="name" label="Nama" rules={[{ required: true, message: 'Nama wajib diisi' }]}>
            <Input placeholder="Nama lengkap" clearable prefix={<UserOutline />} />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, message: 'Email wajib diisi' }, { type: 'email', message: 'Format email tidak valid' }]}
          >
            <Input placeholder="nama@email.com" clearable prefix={<MailOutline />} />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Password wajib diisi' },
              { min: 8, message: 'Minimal 8 karakter' },
              { pattern: /(?=.*[A-Za-z])(?=.*\d)/, message: 'Harus kombinasi huruf & angka' },
            ]}
          >
            <Input type="password" placeholder="Minimal 8 karakter, huruf & angka" clearable prefix={<LockOutline />} />
          </Form.Item>
        </Form>
        <div className="auth-footer">
          Sudah punya akun?
          <Link to="/login">Masuk</Link>
        </div>
      </div>
    </div>
  )
}
