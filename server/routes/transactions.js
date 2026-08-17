const router = require('express').Router()
const db = require('../db')
const { requireAuth } = require('../auth')
const { money } = require('../helpers')
const wrap = require('../wrap')

const EDIT_WINDOW_HOURS = Number(process.env.EDIT_WINDOW_HOURS || 24) // 0 = unlimited

const FIND_TX = db.prepare(
  `SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
   FROM transactions t JOIN categories c ON c.id = t.category_id
   WHERE t.id = ? AND t.user_id = ?`
)
const FIND_CAT = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?')
const INSERT = db.prepare(
  `INSERT INTO transactions (user_id, category_id, type, amount, note, date, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
)
const UPDATE = db.prepare(
  `UPDATE transactions SET category_id = ?, type = ?, amount = ?, note = ?, date = ?
   WHERE id = ? AND user_id = ?`
)
const DELETE = db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?')

router.use(requireAuth)

function serialize(row) {
  return {
    id: row.id,
    type: row.type,
    amount: money(row.amount),
    note: row.note,
    date: row.date,
    createdAt: row.created_at,
    category: {
      id: row.category_id,
      name: row.category_name,
      icon: row.category_icon,
      color: row.category_color,
    },
  }
}

function validateBody(body, res) {
  const { categoryId, type, amount, date, note } = body || {}
  if (type !== 'income' && type !== 'expense') {
    res.status(400).json({ message: 'Tipe transaksi tidak valid.' })
    return null
  }
  const amountNum = Number(amount)
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    res.status(400).json({ message: 'Nominal harus lebih besar dari 0.' })
    return null
  }
  if (!categoryId) {
    res.status(400).json({ message: 'Kategori wajib dipilih.' })
    return null
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ message: 'Tanggal tidak valid.' })
    return null
  }
  return { categoryId: Number(categoryId), type, amount: amountNum, date, note: note ? String(note).slice(0, 500) : null }
}

function checkEditWindow(row, res) {
  if (EDIT_WINDOW_HOURS <= 0) return true
  const ageMs = Date.now() - new Date(row.created_at).getTime()
  if (ageMs > EDIT_WINDOW_HOURS * 60 * 60 * 1000) {
    res.status(403).json({ message: `Transaksi hanya bisa diedit dalam ${EDIT_WINDOW_HOURS} jam sejak dibuat.` })
    return false
  }
  return true
}

// GET /api/transactions?type=&categoryId=&from=&to=&q=&page=&pageSize=
router.get(
  '/',
  wrap(async (req, res) => {
    const { type, categoryId, from, to, q } = req.query
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 30))

    const where = ['t.user_id = ?']
    const params = [req.userId]
    if (type === 'income' || type === 'expense') {
      where.push('t.type = ?')
      params.push(type)
    }
    if (categoryId) {
      where.push('t.category_id = ?')
      params.push(Number(categoryId))
    }
    if (from) {
      where.push('t.date >= ?')
      params.push(from)
    }
    if (to) {
      where.push('t.date <= ?')
      params.push(to)
    }
    if (q) {
      where.push('(t.note LIKE ? OR c.name LIKE ?)')
      params.push(`%${q}%`, `%${q}%`)
    }

    const whereSql = where.join(' AND ')
    const countRow = await db
      .prepare(`SELECT COUNT(*) AS n FROM transactions t JOIN categories c ON c.id = t.category_id WHERE ${whereSql}`)
      .get(...params)
    const total = countRow.n
    const rows = await db
      .prepare(
        `SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
         FROM transactions t JOIN categories c ON c.id = t.category_id
         WHERE ${whereSql} ORDER BY t.date DESC, t.id DESC LIMIT ? OFFSET ?`
      )
      .all(...params, pageSize, (page - 1) * pageSize)

    res.json({
      transactions: rows.map(serialize),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  })
)

// GET /api/transactions/:id
router.get(
  '/:id',
  wrap(async (req, res) => {
    const row = await FIND_TX.get(Number(req.params.id), req.userId)
    if (!row) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' })
    res.json({ transaction: serialize(row) })
  })
)

// POST /api/transactions
router.post(
  '/',
  wrap(async (req, res) => {
    const data = validateBody(req.body, res)
    if (!data) return

    const cat = await FIND_CAT.get(data.categoryId, req.userId)
    if (!cat) return res.status(404).json({ message: 'Kategori tidak ditemukan.' })
    if (cat.type !== data.type) {
      return res.status(400).json({ message: 'Kategori tidak sesuai dengan tipe transaksi.' })
    }

    const info = await INSERT.run(
      req.userId,
      data.categoryId,
      data.type,
      money(data.amount),
      data.note,
      data.date,
      new Date().toISOString()
    )
    const row = await FIND_TX.get(Number(info.lastInsertRowid), req.userId)
    res.status(201).json({ transaction: serialize(row) })
  })
)

// PATCH /api/transactions/:id
router.patch(
  '/:id',
  wrap(async (req, res) => {
    const existing = await FIND_TX.get(Number(req.params.id), req.userId)
    if (!existing) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' })
    if (!checkEditWindow(existing, res)) return

    const data = validateBody(req.body, res)
    if (!data) return
    const cat = await FIND_CAT.get(data.categoryId, req.userId)
    if (!cat) return res.status(404).json({ message: 'Kategori tidak ditemukan.' })
    if (cat.type !== data.type) return res.status(400).json({ message: 'Kategori tidak sesuai dengan tipe transaksi.' })

    await UPDATE.run(data.categoryId, data.type, money(data.amount), data.note, data.date, existing.id, req.userId)
    res.json({ transaction: serialize(await FIND_TX.get(existing.id, req.userId)) })
  })
)

// DELETE /api/transactions/:id
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const existing = await FIND_TX.get(Number(req.params.id), req.userId)
    if (!existing) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' })
    if (!checkEditWindow(existing, res)) return
    await DELETE.run(existing.id, req.userId)
    res.json({ ok: true })
  })
)

module.exports = router
