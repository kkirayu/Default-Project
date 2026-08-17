const router = require('express').Router()
const db = require('../db')
const { seedCategoriesForUser } = require('../seed')
const {
  validateCredentials,
  hashPassword,
  verifyPassword,
  publicUser,
} = require('../helpers')
const { signToken, setAuthCookie, clearAuthCookie } = require('../auth')
const wrap = require('../wrap')

const FIND_USER = db.prepare('SELECT * FROM users WHERE email = ?')
const INSERT_USER = db.prepare(
  `INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)`
)

function issueSession(res, user) {
  const token = signToken(user.id)
  setAuthCookie(res, token)
  return publicUser(user)
}

// POST /api/auth/register
router.post(
  '/register',
  wrap(async (req, res) => {
    const { name, email, password } = req.body || {}
    const error = validateCredentials({ name, email, password, isRegister: true })
    if (error) return res.status(400).json({ message: error })

    const cleanEmail = String(email).trim().toLowerCase()
    if (await FIND_USER.get(cleanEmail)) {
      return res.status(409).json({ message: 'Email sudah terdaftar.' })
    }

    const now = new Date().toISOString()
    const info = await INSERT_USER.run(String(name).trim(), cleanEmail, hashPassword(password), now)
    const userId = Number(info.lastInsertRowid)

    await seedCategoriesForUser(userId)

    const user = await FIND_USER.get(cleanEmail)
    res.status(201).json({ user: issueSession(res, user) })
  })
)

// POST /api/auth/login
router.post(
  '/login',
  wrap(async (req, res) => {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ message: 'Email dan password wajib diisi.' })

    const user = await FIND_USER.get(String(email).trim().toLowerCase())
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ message: 'Email atau password salah.' })
    }

    res.json({ user: issueSession(res, user) })
  })
)

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearAuthCookie(res)
  res.json({ ok: true })
})

module.exports = router
