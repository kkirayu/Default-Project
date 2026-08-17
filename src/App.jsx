import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { TabBar, SpinLoading } from 'antd-mobile'
import { AppOutline, UnorderedListOutline, AddOutline, TeamOutline, UserOutline } from 'antd-mobile-icons'
import { AuthProvider, useAuth } from './AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import TransactionForm from './pages/TransactionForm'
import TransactionDetail from './pages/TransactionDetail'
import Budget from './pages/Budget'
import Family from './pages/Family'
import Reminders from './pages/Reminders'
import Profile from './pages/Profile'

const tabs = [
  { key: '/dashboard', title: 'Dashboard', icon: <AppOutline /> },
  { key: '/transactions', title: 'Transaksi', icon: <UnorderedListOutline /> },
  { key: '/transactions/new', title: '', icon: <AddOutline />, center: true },
  { key: '/family', title: 'Keluarga', icon: <TeamOutline /> },
  { key: '/profile', title: 'Profil', icon: <UserOutline /> },
]

function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const current = tabs.find((t) => t.key !== '/transactions/new' && location.pathname.startsWith(t.key))?.key || '/dashboard'
  return (
    <div className="app-shell">
      <div className="page-scroll">
        <Outlet />
      </div>
      <div className="tabbar-wrap">
        <TabBar activeKey={current} onChange={(k) => navigate(k)}>
          {tabs.map((t) => (
            <TabBar.Item
              key={t.key}
              icon={t.icon}
              title={t.title}
              className={t.center ? 'center-tab' : ''}
            />
          ))}
        </TabBar>
      </div>
    </div>
  )
}

function Protected() {
  const { user, loading } = useAuth()
  if (loading) return <div className="center-screen"><SpinLoading color="primary" /></div>
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function GuestOnly() {
  const { user, loading } = useAuth()
  if (loading) return <div className="center-screen"><SpinLoading color="primary" /></div>
  if (user) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<GuestOnly />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          <Route element={<Protected />}>
            <Route element={<Shell />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/budget" element={<Budget />} />
              <Route path="/family" element={<Family />} />
              <Route path="/reminders" element={<Reminders />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            <Route path="/transactions/new" element={<TransactionForm />} />
            <Route path="/transactions/:id" element={<TransactionDetail />} />
            <Route path="/transactions/:id/edit" element={<TransactionForm />} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
