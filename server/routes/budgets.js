const router = require('express').Router()
const db = require('../db')
const { requireAuth } = require('../auth')
const { money } = require('../helpers')
const { NEEDS, WANTS } = require('../seed')
const wrap = require('../wrap')

function monthRange(month) {
  const [y, m] = month.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1))
  const pad = (n) => String(n).padStart(2, '0')
  return { from: `${y}-${pad(m)}-01`, to: `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-01` }
}

async function monthIncome(userId, month) {
  const { from, to } = monthRange(month)
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
       WHERE user_id = ? AND type = 'income' AND date >= ? AND date < ?`
    )
    .get(userId, from, to)
  return money(row.total)
}

async function avg3MonthIncome(userId, month) {
  const [y, m] = month.split('-').map(Number)
  let sum = 0
  for (let i = 2; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    const mm = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    sum += await monthIncome(userId, mm)
  }
  return sum / 3
}

function currentMonth() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
}

router.use(requireAuth)

// GET /api/budgets?month=YYYY-MM
router.get(
  '/',
  wrap(async (req, res) => {
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : currentMonth()
    const { from, to } = monthRange(month)

    const rows = await db
      .prepare(
        `SELECT c.id AS category_id, c.name, c.icon, c.color,
                COALESCE(b.allocated, 0) AS allocated,
                COALESCE((SELECT SUM(t.amount) FROM transactions t
                          WHERE t.category_id = c.id AND t.user_id = ? AND t.type = 'expense' AND t.date >= ? AND t.date < ?), 0) AS spent
         FROM categories c
         LEFT JOIN budgets b ON b.category_id = c.id AND b.user_id = ? AND b.month = ?
         WHERE c.user_id = ? AND c.type = 'expense'
         ORDER BY spent DESC, c.id ASC`
      )
      .all(req.userId, from, to, req.userId, month, req.userId)

    res.json({
      month,
      income: await monthIncome(req.userId, month),
      incomeAvg3: await avg3MonthIncome(req.userId, month),
      budgets: rows.map((r) => ({
        categoryId: r.category_id,
        name: r.name,
        icon: r.icon,
        color: r.color,
        allocated: money(r.allocated),
        spent: money(r.spent),
      })),
    })
  })
)

// POST /api/budgets/bulk { month, items: [{ categoryId, allocated }] }
router.post(
  '/bulk',
  wrap(async (req, res) => {
    const month = /^\d{4}-\d{2}$/.test((req.body || {}).month || '') ? req.body.month : currentMonth()
    const items = Array.isArray(req.body.items) ? req.body.items : []

    if (!items.length) return res.status(400).json({ message: 'Belum ada alokasi yang diisi.' })

    const upsertSql = `INSERT INTO budgets (user_id, category_id, month, allocated, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, category_id, month) DO UPDATE SET allocated = excluded.allocated`
    const removeSql = 'DELETE FROM budgets WHERE user_id = ? AND category_id = ? AND month = ?'
    const catFind = db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ? AND type = ?')

    const nowIso = new Date().toISOString()
    const allocated = {}
    for (const item of items) {
      const categoryId = Number(item.categoryId)
      const value = Number(item.allocated)
      if (!Number.isFinite(value) || value < 0) {
        return res.status(400).json({ message: 'Nilai alokasi tidak valid.' })
      }
      if (!(await catFind.get(categoryId, req.userId, 'expense'))) {
        return res.status(400).json({ message: 'Kategori tidak valid.' })
      }
      allocated[categoryId] = money(value)
    }

    const total = Object.values(allocated).reduce((a, b) => a + b, 0)
    const limit = Math.max(await monthIncome(req.userId, month), await avg3MonthIncome(req.userId, month))
    if (limit > 0 && total > limit) {
      return res.status(400).json({
        message: `Total alokasi (${money(total)}) melebihi pemasukan bulan ini (${money(limit)}).`,
      })
    }

    const stmts = []
    for (const [categoryId, value] of Object.entries(allocated)) {
      if (value > 0) stmts.push({ sql: upsertSql, args: [req.userId, Number(categoryId), month, value, nowIso] })
      else stmts.push({ sql: removeSql, args: [req.userId, Number(categoryId), month] })
    }
    await db.batch(stmts)

    res.json({ ok: true, total: money(total) })
  })
)

// POST /api/budgets/auto { month }  — 50/30/20 splitter
router.post(
  '/auto',
  wrap(async (req, res) => {
    const month = /^\d{4}-\d{2}$/.test((req.body || {}).month || '') ? req.body.month : currentMonth()

    const income = Math.max(await monthIncome(req.userId, month), await avg3MonthIncome(req.userId, month))
    if (income <= 0) {
      return res.status(400).json({
        message: 'Belum ada pemasukan yang bisa dialokasikan. Catat pemasukan dulu atau pilih bulan lain.',
      })
    }

    const categories = await db
      .prepare(`SELECT id, name FROM categories WHERE user_id = ? AND type = 'expense'`)
      .all(req.userId)

    const spend = async (categoryId) => {
      const { from, to } = monthRange(month)
      const row = await db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
           WHERE user_id = ? AND category_id = ? AND type = 'expense' AND date >= ? AND date < ?`
        )
        .get(req.userId, categoryId, from, to)
      return money(row.total)
    }

    const buckets = { needs: [], wants: [], other: [] }
    for (const c of categories) {
      const group = NEEDS.includes(c.name) ? 'needs' : WANTS.includes(c.name) ? 'wants' : 'other'
      buckets[group].push({ ...c, spent: await spend(c.id) })
    }

    const distribute = (group, pool) => {
      const list = buckets[group]
      if (!list.length) return {}
      const totalSpent = list.reduce((a, b) => a + b.spent, 0)
      const out = {}
      if (totalSpent > 0) {
        for (const c of list) out[c.id] = money((pool * c.spent) / totalSpent)
      } else {
        for (const c of list) out[c.id] = money(pool / list.length)
      }
      return out
    }

    const allocation = {
      ...distribute('needs', income * 0.5),
      ...distribute('wants', income * 0.3),
    }

    const upsertSql = `INSERT INTO budgets (user_id, category_id, month, allocated, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, category_id, month) DO UPDATE SET allocated = excluded.allocated`
    const nowIso = new Date().toISOString()
    const stmts = Object.entries(allocation).map(([categoryId, value]) => ({
      sql: upsertSql,
      args: [req.userId, Number(categoryId), month, money(value), nowIso],
    }))
    if (stmts.length) await db.batch(stmts)

    const allocatedTotal = Object.values(allocation).reduce((a, b) => a + b, 0)
    res.json({ ok: true, total: money(allocatedTotal), savings: money(income - allocatedTotal), allocation })
  })
)

module.exports = router
