// Express 4 doesn't catch rejected promises in async handlers.
// Wrap every async route handler with this so errors hit the error middleware.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

module.exports = wrap
