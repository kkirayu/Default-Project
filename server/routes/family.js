const router = require('express').Router()
const db = require('../db')
const { requireAuth } = require('../auth')
const { money } = require('../helpers')
const wrap = require('../wrap')

const MY_MEMBERSHIP = db.prepare(
  `SELECT fm.*, f.name AS family_name, f.owner_id AS owner_id FROM family_members fm
   JOIN families f ON f.id = fm.family_id WHERE fm.user_id = ?`
)
const MEMBERS = db.prepare(
  `SELECT u.id AS user_id, u.name, u.email, u.avatar, fm.role, fm.visibility, fm.created_at AS joined_at
   FROM family_members fm JOIN users u ON u.id = fm.user_id
   WHERE fm.family_id = ? ORDER BY CASE fm.role WHEN 'admin' THEN 0 ELSE 1 END, fm.id ASC`
)
const INSERT_FAMILY = db.prepare(`INSERT INTO families (name, owner_id, created_at) VALUES (?, ?, ?)`)
const INSERT_MEMBER = db.prepare(
  `INSERT INTO family_members (family_id, user_id, role, visibility, created_at) VALUES (?, ?, ?, 'public', ?)`
)
const INSERT_INVITE = db.prepare(
  `INSERT INTO invitations (family_id, email, code, status, created_at, expires_at) VALUES (?, ?, ?, 'pending', ?, ?)`
)
const INVITES = db.prepare(
  `SELECT id, email, code, status, created_at, expires_at FROM invitations WHERE family_id = ? ORDER BY id DESC`
)
const FIND_INVITE = db.prepare('SELECT * FROM invitations WHERE code = ?')
const ACCEPT_INVITE = db.prepare(`UPDATE invitations SET status = 'accepted' WHERE id = ?`)
const UPDATE_MEMBER = db.prepare(`UPDATE family_members SET role = ?, visibility = ? WHERE family_id = ? AND user_id = ?`)
const DELETE_MEMBER = db.prepare('DELETE FROM family_members WHERE family_id = ? AND user_id = ?')
const COUNT_MEMBERS = db.prepare('SELECT COUNT(*) AS n FROM family_members WHERE family_id = ?')
const DELETE_INVITE = db.prepare('DELETE FROM invitations WHERE id = ? AND family_id = ?')

const isAdminRow = (membership) => membership && membership.role === 'admin'

function memberJson(u) {
  return {
    userId: u.user_id,
    name: u.name,
    email: u.email,
    avatar: u.avatar,
    role: u.role,
    visibility: u.visibility,
    joinedAt: u.joined_at,
  }
}

router.use(requireAuth)

// GET /api/family
router.get(
  '/',
  wrap(async (req, res) => {
    const membership = await MY_MEMBERSHIP.get(req.userId)
    if (!membership) return res.json({ family: null })

    const members = (await MEMBERS.all(membership.family_id)).map(memberJson)
    const invitations = isAdminRow(membership)
      ? (await INVITES.all(membership.family_id)).map((i) => ({
          id: i.id,
          email: i.email,
          code: i.code,
          status: i.status,
          createdAt: i.created_at,
          expiresAt: i.expires_at,
        }))
      : []

    res.json({
      family: {
        id: membership.family_id,
        name: membership.family_name,
        ownerId: membership.owner_id,
        myRole: membership.role,
        myVisibility: membership.visibility,
        members,
        invitations,
      },
    })
  })
)

// POST /api/family  { name }
router.post(
  '/',
  wrap(async (req, res) => {
    const membership = await MY_MEMBERSHIP.get(req.userId)
    if (membership) return res.status(409).json({ message: 'Kamu sudah berada dalam sebuah keluarga.' })

    const name = (req.body || {}).name
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'Nama keluarga wajib diisi.' })

    const now = new Date().toISOString()
    const info = await INSERT_FAMILY.run(String(name).trim().slice(0, 80), req.userId, now)
    await INSERT_MEMBER.run(Number(info.lastInsertRowid), req.userId, 'admin', now)

    const newMembership = await MY_MEMBERSHIP.get(req.userId)
    res.status(201).json({
      family: {
        id: newMembership.family_id,
        name: newMembership.family_name,
        ownerId: req.userId,
        myRole: 'admin',
        myVisibility: 'public',
        members: (await MEMBERS.all(newMembership.family_id)).map(memberJson),
        invitations: [],
      },
    })
  })
)

// POST /api/family/invite  { email? }  (admin) — returns a join code valid 7 days
router.post(
  '/invite',
  wrap(async (req, res) => {
    const membership = await MY_MEMBERSHIP.get(req.userId)
    if (!membership) return res.status(404).json({ message: 'Belum ada keluarga.' })
    if (!isAdminRow(membership)) return res.status(403).json({ message: 'Hanya admin yang bisa mengundang.' })

    const email = (req.body || {}).email
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Format email tidak valid.' })
    }

    const code = require('crypto').randomBytes(4).toString('hex').toUpperCase()
    const now = new Date()
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const info = await INSERT_INVITE.run(
      membership.family_id,
      email ? email.toLowerCase() : null,
      code,
      now.toISOString(),
      expires
    )

    res.status(201).json({ invitation: { id: Number(info.lastInsertRowid), code, email: email || null, status: 'pending' } })
  })
)

// GET /api/family/invitations (admin)
router.get(
  '/invitations',
  wrap(async (req, res) => {
    const membership = await MY_MEMBERSHIP.get(req.userId)
    if (!membership) return res.status(404).json({ message: 'Belum ada keluarga.' })
    if (!isAdminRow(membership)) return res.status(403).json({ message: 'Hanya admin yang bisa melihat undangan.' })
    const invitations = (await INVITES.all(membership.family_id)).map((i) => ({
      id: i.id,
      email: i.email,
      code: i.code,
      status: i.status,
      createdAt: i.created_at,
      expiresAt: i.expires_at,
    }))
    res.json({ invitations })
  })
)

// DELETE /api/family/invitations/:id (admin)
router.delete(
  '/invitations/:id',
  wrap(async (req, res) => {
    const membership = await MY_MEMBERSHIP.get(req.userId)
    if (!membership) return res.status(404).json({ message: 'Belum ada keluarga.' })
    if (!isAdminRow(membership)) return res.status(403).json({ message: 'Hanya admin yang bisa mencabut undangan.' })
    await DELETE_INVITE.run(Number(req.params.id), membership.family_id)
    res.json({ ok: true })
  })
)

// POST /api/family/join  { code }
router.post(
  '/join',
  wrap(async (req, res) => {
    const membership = await MY_MEMBERSHIP.get(req.userId)
    if (membership) return res.status(409).json({ message: 'Kamu sudah berada dalam sebuah keluarga.' })

    const code = String((req.body || {}).code || '').trim().toUpperCase()
    const invite = await FIND_INVITE.get(code)
    if (!invite || invite.status !== 'pending') return res.status(404).json({ message: 'Kode undangan tidak valid.' })
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return res.status(410).json({ message: 'Undangan sudah kadaluarsa (7 hari).' })
    }

    const now = new Date().toISOString()
    await INSERT_MEMBER.run(invite.family_id, req.userId, 'member', now)
    await ACCEPT_INVITE.run(invite.id)

    const m = await MY_MEMBERSHIP.get(req.userId)
    res.status(201).json({
      family: {
        id: m.family_id,
        name: m.family_name,
        ownerId: m.owner_id,
        myRole: m.role,
        myVisibility: m.visibility,
      },
    })
  })
)

// PATCH /api/family/members/:userId  { role?, visibility? } (admin)
router.patch(
  '/members/:userId',
  wrap(async (req, res) => {
    const membership = await MY_MEMBERSHIP.get(req.userId)
    if (!membership) return res.status(404).json({ message: 'Belum ada keluarga.' })
    if (!isAdminRow(membership)) return res.status(403).json({ message: 'Hanya admin yang bisa mengubah anggota.' })

    const targetId = Number(req.params.userId)
    const all = await MEMBERS.all(membership.family_id)
    const target = all.find((m) => m.user_id === targetId)
    if (!target) return res.status(404).json({ message: 'Anggota tidak ditemukan.' })

    const { role, visibility } = req.body || {}
    const newRole = role === 'admin' || role === 'member' ? role : target.role
    const newVisibility = visibility === 'public' || visibility === 'private' ? visibility : target.visibility

    await UPDATE_MEMBER.run(newRole, newVisibility, membership.family_id, targetId)

    const members = (await MEMBERS.all(membership.family_id)).map(memberJson)
    const me = members.find((m) => m.userId === req.userId)
    const updated = members.find((m) => m.userId === targetId)
    res.json({ family: { id: membership.family_id, name: membership.family_name, myRole: me.role, members, updated } })
  })
)

// DELETE /api/family/members/:userId (admin)
router.delete(
  '/members/:userId',
  wrap(async (req, res) => {
    const membership = await MY_MEMBERSHIP.get(req.userId)
    if (!membership) return res.status(404).json({ message: 'Belum ada keluarga.' })
    if (!isAdminRow(membership)) return res.status(403).json({ message: 'Hanya admin yang bisa menghapus anggota.' })

    const targetId = Number(req.params.userId)
    if (targetId === req.userId) return res.status(400).json({ message: 'Tidak bisa menghapus diri sendiri.' })
    if (targetId === membership.owner_id) return res.status(400).json({ message: 'Pemilik keluarga tidak bisa dihapus.' })

    const { n } = await COUNT_MEMBERS.get(membership.family_id)
    if (n <= 1) return res.status(400).json({ message: 'Keluarga harus memiliki minimal satu anggota.' })

    await DELETE_MEMBER.run(membership.family_id, targetId)
    res.json({ ok: true })
  })
)

// GET /api/family/member/:userId/transactions?month=YYYY-MM  (admin only, respects visibility)
router.get(
  '/member/:userId/transactions',
  wrap(async (req, res) => {
    const membership = await MY_MEMBERSHIP.get(req.userId)
    if (!membership) return res.status(404).json({ message: 'Belum ada keluarga.' })
    if (!isAdminRow(membership)) return res.status(403).json({ message: 'Hanya admin yang bisa melihat transaksi anggota.' })

    const targetId = Number(req.params.userId)
    const all = await MEMBERS.all(membership.family_id)
    const target = all.find((m) => m.user_id === targetId)
    if (!target) return res.status(404).json({ message: 'Anggota tidak ditemukan.' })

    if (target.visibility === 'private') {
      return res.status(403).json({ message: 'Transaksi anggota ini bersifat privat (visibilitas dikunci member).' })
    }

    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '')
      ? req.query.month
      : `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
    const [y, m] = month.split('-').map(Number)
    const from = `${month}-01`
    const to = `${y}-${String(m + 1).padStart(2, '0')}-01`

    const rows = await db
      .prepare(
        `SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
         FROM transactions t JOIN categories c ON c.id = t.category_id
         WHERE t.user_id = ? AND t.date >= ? AND t.date < ? ORDER BY t.date DESC, t.id DESC LIMIT 200`
      )
      .all(targetId, from, to)

    const totals = await db
      .prepare(
        `SELECT type, COALESCE(SUM(amount), 0) AS total FROM transactions
         WHERE user_id = ? AND date >= ? AND date < ? GROUP BY type`
      )
      .all(targetId, from, to)

    res.json({
      member: { userId: target.user_id, name: target.name, email: target.email },
      month,
      income: money(totals.find((r) => r.type === 'income')?.total || 0),
      expense: money(totals.find((r) => r.type === 'expense')?.total || 0),
      transactions: rows.map((t) => ({
        id: t.id,
        type: t.type,
        amount: money(t.amount),
        note: t.note,
        date: t.date,
        category: { name: t.category_name, icon: t.category_icon, color: t.category_color },
      })),
    })
  })
)

module.exports = router
