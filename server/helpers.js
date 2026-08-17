const bcrypt = require('bcryptjs')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateCredentials({ name, email, password, isRegister }) {
  if (isRegister) {
    if (!name || !name.trim()) return 'Nama wajib diisi.'
    if (name.trim().length > 60) return 'Nama maksimal 60 karakter.'
  }
  if (!email || !EMAIL_RE.test(email)) return 'Format email tidak valid.'
  if (!password || password.length < 8) return 'Password minimal 8 karakter.'
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password))
    return 'Password harus kombinasi huruf dan angka.'
  return null
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10)
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash)
}

function publicUser(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatar: row.avatar,
    createdAt: row.created_at,
  }
}

function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

module.exports = { validateCredentials, hashPassword, verifyPassword, publicUser, money }
