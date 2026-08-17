const router = require('express').Router()
const db = require('../db')
const { requireAuth } = require('../auth')
const { publicUser, validateCredentials } = require('../helpers')
const wrap = require('../wrap')

const FIND_USER = db.prepare('SELECT * FROM users WHERE id = ?')
const UPDATE_NAME = db.prepare('UPDATE users SET name = ? WHERE id = ?')
const UPDATE_AVATAR = db.prepare('UPDATE users SET avatar = ? WHERE id = ?')

const loadUser = (userId) => FIND_USER.get(userId)

// GET /api/me
router.get(
  '/',
  requireAuth,
  wrap(async (req, res) => {
    res.json({ user: publicUser(await loadUser(req.userId)) })
  })
)

// PATCH /api/me  { name?, avatar? }
router.patch(
  '/',
  requireAuth,
  wrap(async (req, res) => {
    const { name, avatar } = req.body || {}
    const user = await loadUser(req.userId)
    if (name !== undefined) {
      const error = validateCredentials({ email: user.email, password: 'abc12345', name, isRegister: true })
      if (error) return res.status(400).json({ message: error })
      await UPDATE_NAME.run(String(name).trim(), req.userId)
    }
    if (avatar !== undefined) {
      if (avatar && typeof avatar !== 'string') return res.status(400).json({ message: 'Avatar tidak valid.' })
      await UPDATE_AVATAR.run(avatar || null, req.userId)
    }
    res.json({ user: publicUser(await loadUser(req.userId)) })
  })
)

module.exports = { router, loadUser }
