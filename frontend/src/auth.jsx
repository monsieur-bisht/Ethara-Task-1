import { createContext, useContext, useEffect, useState } from 'react'
import { api, setAuthToken } from './api.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }
    api
      .get('/api/auth/me')
      .then((r) => setUser(r.data))
      .catch(() => setAuthToken(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(email, password) {
    const { data } = await api.post('/api/auth/login', { email, password })
    setAuthToken(data.access_token)
    setUser(data.user)
  }

  async function signup(email, full_name, password) {
    const { data } = await api.post('/api/auth/signup', { email, full_name, password })
    setAuthToken(data.access_token)
    setUser(data.user)
  }

  function logout() {
    setAuthToken(null)
    setUser(null)
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, signup, logout }}>{children}</AuthCtx.Provider>
  )
}

export function useAuth() {
  return useContext(AuthCtx)
}
