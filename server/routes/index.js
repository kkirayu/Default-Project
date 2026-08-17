const router = require('express').Router()

router.use('/auth', require('./auth'))
router.use('/me', require('./me').router)
router.use('/categories', require('./categories'))
router.use('/transactions', require('./transactions'))
router.use('/dashboard', require('./dashboard'))
router.use('/budgets', require('./budgets'))
router.use('/reminders', require('./reminders'))
router.use('/family', require('./family'))

router.get('/health', (req, res) => res.json({ ok: true, name: 'Dompet Keluarga API' }))

module.exports = router
