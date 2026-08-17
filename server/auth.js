const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'dompet-keluarga-dev-secret-change-me'
const COOKIE_NAME = 'dk_token'
const SESSION_DAYS = 7

function signToken(userId) {
  return jwt.sign({}, JWT_SECRET, { subject: String(userId), expiresIn: `${SESSION_DAYS}d` })
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  })
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME)
}

function requireAuth(req, res, next) {
  const token =
    (req.cookies && req.cookies[COOKIE_NAME]) ||
    (req.headers.authorization && req.headers.authorization.replace(/^Bearer /, ''))
  if (!token) return res.status(401).json({ message: 'Belum masuk. Silakan login dulu.' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.userId = Number(payload.sub)
    next()
  } catch {
    return res.status(401).json({ message: 'Sesi berakhir. Silakan login ulang.' })
  }
}

module.exports = { signToken, setAuthCookie, clearAuthCookie, requireAuth, COOKIE_NAME }
