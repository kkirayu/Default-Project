import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { email, password } })
    setUser(d.user)
    return d.user
  }, [])

  const register = useCallback(async (name, email, password) => {
    const d = await api('/auth/register', { method: 'POST', body: { name, email, password } })
    setUser(d.user)
    return d.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    const d = await api('/me')
    setUser(d.user)
    return d.user
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
