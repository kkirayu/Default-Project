const router = require('express').Router()
const db = require('../db')
const { requireAuth } = require('../auth')
const { money } = require('../helpers')
const wrap = require('../wrap')

function monthRange(month) {
  const [y, m] = month.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1))
  const pad = (n) => String(n).padStart(2, '0')
  return {
    from: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-01`,
    to: `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-01`,
  }
}

function lastMonths(n) {
  const now = new Date()
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

router.use(requireAuth)

// GET /api/dashboard?month=YYYY-MM
router.get(
  '/',
  wrap(async (req, res) => {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '')
      ? req.query.month
      : `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
    const { from, to } = monthRange(month)

    const monthTotals = await db
      .prepare(
        `SELECT type, COALESCE(SUM(amount), 0) AS total FROM transactions
         WHERE user_id = ? AND date >= ? AND date < ? GROUP BY type`
      )
      .all(req.userId, from, to)
    const monthIncome = money(monthTotals.find((r) => r.type === 'income')?.total || 0)
    const monthExpense = money(monthTotals.find((r) => r.type === 'expense')?.total || 0)

    const allTotals = await db
      .prepare(`SELECT type, COALESCE(SUM(amount), 0) AS total FROM transactions WHERE user_id = ? GROUP BY type`)
      .all(req.userId)
    const totalIncome = money(allTotals.find((r) => r.type === 'income')?.total || 0)
    const totalExpense = money(allTotals.find((r) => r.type === 'expense')?.total || 0)

    const recent = await db
      .prepare(
        `SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
         FROM transactions t JOIN categories c ON c.id = t.category_id
         WHERE t.user_id = ? ORDER BY t.date DESC, t.id DESC LIMIT 8`
      )
      .all(req.userId)

    const categoryBreakdown = await db
      .prepare(
        `SELECT c.id, c.name, c.icon, c.color, COALESCE(SUM(t.amount), 0) AS total
         FROM categories c
         LEFT JOIN transactions t ON t.category_id = c.id AND t.user_id = ? AND t.type = 'expense' AND t.date >= ? AND t.date < ?
         WHERE c.user_id = ? AND c.type = 'expense'
         GROUP BY c.id ORDER BY total DESC`
      )
      .all(req.userId, from, to, req.userId)

    // last 6 month trend
    const months = lastMonths(6)
    const trend = []
    for (const m of months) {
      const { from: f, to: t } = monthRange(m)
      const rows = await db
        .prepare(
          `SELECT type, COALESCE(SUM(amount), 0) AS total FROM transactions
           WHERE user_id = ? AND date >= ? AND date < ? GROUP BY type`
        )
        .all(req.userId, f, t)
      trend.push({
        month: m,
        label: m.slice(5),
        income: money(rows.find((r) => r.type === 'income')?.total || 0),
        expense: money(rows.find((r) => r.type === 'expense')?.total || 0),
      })
    }

    // budget recommendation: average expense of the last 3 full months, rounded up to nearest 10k
    const last3 = months.slice(-3)
    let threeMonthSum = 0
    for (const m of last3) {
      const { from: f, to: t } = monthRange(m)
      const row = await db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
           WHERE user_id = ? AND type = 'expense' AND date >= ? AND date < ?`
        )
        .get(req.userId, f, t)
      threeMonthSum += money(row.total)
    }
    const recommendation = Math.ceil((threeMonthSum / 3) / 10000) * 10000

    res.json({
      month,
      monthIncome,
      monthExpense,
      monthBalance: money(monthIncome - monthExpense),
      totalIncome,
      totalExpense,
      totalBalance: money(totalIncome - totalExpense),
      recent: recent.map((t) => ({
        id: t.id,
        type: t.type,
        amount: money(t.amount),
        note: t.note,
        date: t.date,
        category: { id: t.category_id, name: t.category_name, icon: t.category_icon, color: t.category_color },
      })),
      categoryBreakdown: categoryBreakdown.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        total: money(c.total),
      })),
      trend,
      budgetRecommendation: recommendation,
    })
  })
)

module.exports = router
