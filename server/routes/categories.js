const router = require('express').Router()
const db = require('../db')
const { requireAuth } = require('../auth')
const wrap = require('../wrap')

const LIST = db.prepare(
  `SELECT id, name, type, icon, color, is_default FROM categories
   WHERE user_id = ? ORDER BY is_default DESC, id ASC`
)
const FIND = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?')
const INSERT = db.prepare(
  `INSERT INTO categories (user_id, name, type, icon, color, is_default, created_at)
   VALUES (?, ?, ?, ?, ?, 0, ?)`
)
const UPDATE = db.prepare('UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ? AND user_id = ?')
const DELETE = db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?')
const FALLBACK = db.prepare(
  `SELECT id FROM categories WHERE user_id = ? AND type = ? AND is_default = 1 AND name LIKE 'Pengeluaran%'
   UNION SELECT id FROM categories WHERE user_id = ? AND type = ? AND is_default = 1 AND name LIKE 'Pemasukan%'`
)
const REASSIGN = db.prepare('UPDATE transactions SET category_id = ? WHERE category_id = ? AND user_id = ?')
const COUNT_TX = db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE category_id = ? AND user_id = ?')

router.use(requireAuth)

function rowToJson(r) {
  return { id: r.id, name: r.name, type: r.type, icon: r.icon, color: r.color, isDefault: !!r.is_default }
}

// GET /api/categories?type=income|expense
router.get(
  '/',
  wrap(async (req, res) => {
    const { type } = req.query
    let rows = await LIST.all(req.userId)
    if (type === 'income' || type === 'expense') rows = rows.filter((r) => r.type === type)
    res.json({ categories: rows.map(rowToJson) })
  })
)

// POST /api/categories { name, type, icon?, color? }
router.post(
  '/',
  wrap(async (req, res) => {
    const { name, type, icon, color } = req.body || {}
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'Nama kategori wajib diisi.' })
    if (type !== 'income' && type !== 'expense') return res.status(400).json({ message: 'Tipe kategori tidak valid.' })

    const info = await INSERT.run(
      req.userId,
      String(name).trim().slice(0, 40),
      type,
      icon || 'more',
      color || '#1677ff',
      new Date().toISOString()
    )
    const row = await FIND.get(Number(info.lastInsertRowid), req.userId)
    res.status(201).json({ category: rowToJson(row) })
  })
)

// PATCH /api/categories/:id { name?, icon?, color? }
router.patch(
  '/:id',
  wrap(async (req, res) => {
    const row = await FIND.get(Number(req.params.id), req.userId)
    if (!row) return res.status(404).json({ message: 'Kategori tidak ditemukan.' })
    const { name, icon, color } = req.body || {}
    await UPDATE.run(
      name !== undefined ? String(name).trim().slice(0, 40) : row.name,
      icon !== undefined ? icon : row.icon,
      color !== undefined ? color : row.color,
      row.id,
      req.userId
    )
    res.json({ category: rowToJson(await FIND.get(row.id, req.userId)) })
  })
)

// DELETE /api/categories/:id  (reassigns its transactions to the default category)
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const row = await FIND.get(Number(req.params.id), req.userId)
    if (!row) return res.status(404).json({ message: 'Kategori tidak ditemukan.' })

    const { n } = await COUNT_TX.get(row.id, req.userId)
    if (n > 0) {
      const fallback = await FALLBACK.get(req.userId, row.type, req.userId, row.type)
      if (fallback) await REASSIGN.run(fallback.id, row.id, req.userId)
    }
    await DELETE.run(row.id, req.userId)
    res.json({ ok: true })
  })
)

module.exports = router
