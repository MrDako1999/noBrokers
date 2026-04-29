function errorHandler(err, req, res, next) {
  console.error('Error:', err)

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message)
    return res.status(400).json({ error: messages.join(', ') })
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field'
    return res.status(400).json({ error: `${field} already exists` })
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ error: `Invalid ${err.path}` })
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' })
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' })
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message })
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  })
}

module.exports = errorHandler
