import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Form, Input, Button, Toast } from 'antd-mobile'
import { PayCircleOutline, LockOutline, UserOutline } from 'antd-mobile-icons'
import { useAuth } from '../AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values) => {
    setLoading(true)
    try {
      await login(values.email, values.password)
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
        <p>Kelola keuangan keluarga dengan transparan &amp; terencana.</p>
      </div>
      <div className="auth-card">
        <h2>Masuk</h2>
        <p className="sub">Selamat datang kembali!</p>
        <Form
          layout="vertical"
          onFinish={onFinish}
          footer={
            <Button block type="submit" color="primary" size="large" loading={loading}>
              Masuk
            </Button>
          }
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, message: 'Email wajib diisi' }, { type: 'email', message: 'Format email tidak valid' }]}
          >
            <Input placeholder="nama@email.com" clearable prefix={<UserOutline />} />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Password wajib diisi' }]}
          >
            <Input type="password" placeholder="Minimal 8 karakter" clearable prefix={<LockOutline />} />
          </Form.Item>
        </Form>
        <div className="auth-footer">
          Belum punya akun?
          <Link to="/register">Daftar Sekarang</Link>
        </div>
      </div>
    </div>
  )
}
