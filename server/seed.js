const db = require('./db')

const DEFAULT_CATEGORIES = {
  income: [
    { name: 'Gaji', icon: 'paycircle', color: '#00b578' },
    { name: 'Bonus', icon: 'gift', color: '#ff8f1f' },
    { name: 'Penjualan', icon: 'shop', color: '#00b578' },
    { name: 'Pemasukan Lain', icon: 'more', color: '#86909c' },
  ],
  expense: [
    { name: 'Makanan', icon: 'receipt', color: '#ff3141' },
    { name: 'Transportasi', icon: 'travel', color: '#1677ff' },
    { name: 'Tagihan', icon: 'bill', color: '#ff8f1f' },
    { name: 'Belanja', icon: 'shopbag', color: '#eb6d20' },
    { name: 'Hiburan', icon: 'movie', color: '#8f5ce8' },
    { name: 'Kesehatan', icon: 'heart', color: '#00b578' },
    { name: 'Pendidikan', icon: 'content', color: '#4f8df9' },
    { name: 'Pengeluaran Lain', icon: 'more', color: '#86909c' },
  ],
}

// Budget grouping used by the 50/30/20 auto-splitter.
const NEEDS = ['Makanan', 'Transportasi', 'Tagihan', 'Kesehatan', 'Pendidikan']
const WANTS = ['Belanja', 'Hiburan', 'Pengeluaran Lain']

const insertCat = db.prepare(
  `INSERT INTO categories (user_id, name, type, icon, color, is_default, created_at)
   VALUES (?, ?, ?, ?, ?, 1, ?)`
)

async function seedCategoriesForUser(userId) {
  const now = new Date().toISOString()
  for (const type of ['income', 'expense']) {
    for (const c of DEFAULT_CATEGORIES[type]) {
      await insertCat.run(userId, c.name, type, c.icon, c.color, now)
    }
  }
}

async function needsOfType(userId, type) {
  return db
    .prepare(
      `SELECT id, name, icon, color, type, is_default FROM categories
       WHERE user_id = ? AND type = ? ORDER BY is_default DESC, id ASC`
    )
    .all(userId, type)
}

module.exports = { DEFAULT_CATEGORIES, NEEDS, WANTS, seedCategoriesForUser, needsOfType }

// ---------------------------------------------------------------
// `npm run seed` — create a demo user with sample data for 6 months
// ---------------------------------------------------------------
if (require.main === module) {
  const bcrypt = require('bcryptjs')

  async function main() {
    await db.init()

    const EMAIL = 'demo@keluarga.test'
    const PASSWORD = 'demo12345'

    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(EMAIL)
    if (existing) {
      console.log(`Demo user sudah ada (${EMAIL}). Hapus data/ jika ingin membuat ulang.`)
      return
    }

    const now = new Date().toISOString()
    const info = await db
      .prepare('INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .run('Demo Keluarga', EMAIL, bcrypt.hashSync(PASSWORD, 10), now)
    const userId = Number(info.lastInsertRowid)
    await seedCategoriesForUser(userId)

    const cats = await db.prepare('SELECT id, name, type FROM categories WHERE user_id = ?').all(userId)
    const byName = (name) => cats.find((c) => c.name === name).id
    const salary = byName('Gaji')
    const food = byName('Makanan')
    const transport = byName('Transportasi')
    const bills = byName('Tagihan')
    const shopping = byName('Belanja')
    const fun = byName('Hiburan')

    const tx = db.prepare(
      `INSERT INTO transactions (user_id, category_id, type, amount, note, date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    const add = (categoryId, type, amount, note, date) => tx.run(userId, categoryId, type, amount, note, date, now)

    const today = new Date()
    for (let i = 5; i >= 0; i--) {
      const m = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const y = m.getFullYear()
      const mm = String(m.getMonth() + 1).padStart(2, '0')
      const d = (day) => `${y}-${mm}-${String(day).padStart(2, '0')}`

      await add(salary, 'income', 10000000, 'Gaji bulanan', d(1))
      await add(food, 'expense', 1200000 + i * 70000, 'Belanja kebutuhan dapur', d(6))
      await add(food, 'expense', 450000, 'Makan di luar', d(14))
      await add(transport, 'expense', 600000, 'Bensin & parkir', d(8))
      await add(transport, 'expense', 250000, 'Ojek & angkutan', d(19))
      await add(bills, 'expense', 750000, 'Listrik & air', d(21))
      await add(shopping, 'expense', 900000, 'Belanja bulanan', d(11))
      await add(fun, 'expense', 350000, 'Keluarga rekreasi', d(24))
    }

    const rem = db.prepare(
      `INSERT INTO reminders (user_id, title, amount, recurrence, due_date, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`
    )
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 25)
    await rem.run(userId, 'Cicilan motor', 850000, 'monthly', nextMonth.toISOString().slice(0, 10), now)

    console.log(`\n  Demo user siap: ${EMAIL} / ${PASSWORD}`)
    console.log('  Login lalu coba Dashboard, Anggaran (auto 50/30/20), Keluarga, dan Pengingat.\n')
  }

  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
