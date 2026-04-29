const jwt = require('jsonwebtoken')
const User = require('../models/User.js')

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization

    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = header.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const user = await User.findById(decoded.userId).select('-password')
    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    req.user = user
    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' })
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' })
    }
    next(error)
  }
}

// Optional auth — attaches req.user if a valid token is present, but never
// rejects. Used by listing/browse endpoints so we can show watchlist state
// for signed-in users while still serving anonymous traffic.
async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) return next()

    const token = header.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.userId).select('-password')
    if (user) req.user = user
  } catch {
    // ignore — anonymous request
  }
  next()
}

module.exports = auth
module.exports.optionalAuth = optionalAuth
