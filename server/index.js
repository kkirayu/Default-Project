const path = require('path')
const fs = require('fs')
const express = require('express')
const cookieParser = require('cookie-parser')
const db = require('./db')

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())

// Ensure the schema exists before handling any request (cached promise, runs once per instance).
let schemaReady
app.use(async (req, res, next) => {
  try {
    if (!schemaReady) schemaReady = db.init()
    await schemaReady
    next()
  } catch (err) {
    next(err)
  }
})

app.use('/api', require('./routes'))

// In production, serve the built frontend from dist/
const distDir = path.join(__dirname, '..', 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

// Central error handler (async handlers reject here via wrap())
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ message: err?.message || 'Terjadi kesalahan di server.' })
})

// Vercel imports this file and treats the exported Express app as the serverless handler.
module.exports = app

// Direct execution: `node server/index.js`
if (require.main === module) {
  const PORT = process.env.PORT || 4000
  app.listen(PORT, () => {
    console.log(`\n  Dompet Keluarga ${db.isTurso ? '(Turso)' : '(SQLite lokal)'}  →  http://localhost:${PORT}`)
    console.log(`  Frontend (dev)              →  http://localhost:5173\n`)
  })
}
