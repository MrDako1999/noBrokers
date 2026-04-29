const jwt = require('jsonwebtoken')

function signToken(userId, role) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set')
  }
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

module.exports = { signToken }
