const router = require('express').Router()
const db = require('../db')
const { requireAuth } = require('../auth')
const { money } = require('../helpers')
const wrap = require('../wrap')

const LIST = db.prepare(
  `SELECT * FROM reminders WHERE user_id = ? ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, due_date ASC`
)
const FIND = db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?')
const INSERT = db.prepare(
  `INSERT INTO reminders (user_id, title, amount, recurrence, due_date, notes, status, created_at)
   VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`
)
const UPDATE = db.prepare(
  `UPDATE reminders SET title = ?, amount = ?, recurrence = ?, due_date = ?, notes = ? WHERE id = ? AND user_id = ?`
)
const COMPLETE = db.prepare(`UPDATE reminders SET status = 'completed' WHERE id = ? AND user_id = ?`)
const REACTIVATE = db.prepare(`UPDATE reminders SET status = 'active' WHERE id = ? AND user_id = ?`)
const DELETE = db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?')

const RECURRENCES = ['daily', 'weekly', 'monthly', 'once']

router.use(requireAuth)

function serialize(r) {
  return {
    id: r.id,
    title: r.title,
    amount: money(r.amount),
    recurrence: r.recurrence,
    dueDate: r.due_date,
    notes: r.notes,
    status: r.status,
    createdAt: r.created_at,
  }
}

function validate(body, res) {
  const { title, amount, recurrence, dueDate, notes } = body || {}
  if (!title || !String(title).trim()) {
    res.status(400).json({ message: 'Judul reminder wajib diisi.' })
    return null
  }
  const amountNum = Number(amount || 0)
  if (!Number.isFinite(amountNum) || amountNum < 0) {
    res.status(400).json({ message: 'Nominal tidak valid.' })
    return null
  }
  if (!RECURRENCES.includes(recurrence)) {
    res.status(400).json({ message: 'Pola berulang tidak valid.' })
    return null
  }
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    res.status(400).json({ message: 'Tanggal tidak valid.' })
    return null
  }
  return { title: String(title).trim().slice(0, 120), amount: amountNum, recurrence, dueDate, notes: notes ? String(notes).slice(0, 500) : null }
}

// GET /api/reminders
router.get(
  '/',
  wrap(async (req, res) => {
    res.json({ reminders: (await LIST.all(req.userId)).map(serialize) })
  })
)

// POST /api/reminders
router.post(
  '/',
  wrap(async (req, res) => {
    const data = validate(req.body, res)
    if (!data) return
    const info = await INSERT.run(
      req.userId,
      data.title,
      money(data.amount),
      data.recurrence,
      data.dueDate,
      data.notes,
      new Date().toISOString()
    )
    res.status(201).json({ reminder: serialize(await FIND.get(Number(info.lastInsertRowid), req.userId)) })
  })
)

// PATCH /api/reminders/:id
router.patch(
  '/:id',
  wrap(async (req, res) => {
    const existing = await FIND.get(Number(req.params.id), req.userId)
    if (!existing) return res.status(404).json({ message: 'Reminder tidak ditemukan.' })
    const data = validate(req.body, res)
    if (!data) return
    await UPDATE.run(data.title, money(data.amount), data.recurrence, data.dueDate, data.notes, existing.id, req.userId)
    res.json({ reminder: serialize(await FIND.get(existing.id, req.userId)) })
  })
)

// PATCH /api/reminders/:id/complete
router.patch(
  '/:id/complete',
  wrap(async (req, res) => {
    const existing = await FIND.get(Number(req.params.id), req.userId)
    if (!existing) return res.status(404).json({ message: 'Reminder tidak ditemukan.' })
    await COMPLETE.run(existing.id, req.userId)
    res.json({ reminder: serialize(await FIND.get(existing.id, req.userId)) })
  })
)

// PATCH /api/reminders/:id/reactivate
router.patch(
  '/:id/reactivate',
  wrap(async (req, res) => {
    const existing = await FIND.get(Number(req.params.id), req.userId)
    if (!existing) return res.status(404).json({ message: 'Reminder tidak ditemukan.' })
    await REACTIVATE.run(existing.id, req.userId)
    res.json({ reminder: serialize(await FIND.get(existing.id, req.userId)) })
  })
)

// DELETE /api/reminders/:id
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const existing = await FIND.get(Number(req.params.id), req.userId)
    if (!existing) return res.status(404).json({ message: 'Reminder tidak ditemukan.' })
    await DELETE.run(existing.id, req.userId)
    res.json({ ok: true })
  })
)

module.exports = router
