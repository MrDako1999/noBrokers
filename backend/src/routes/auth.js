const express = require('express')
const crypto = require('crypto')
const validator = require('validator')
const User = require('../models/User.js')
const auth = require('../middleware/auth.js')
const { signToken } = require('../utils/jwt.js')

const router = express.Router()

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, phone, accountTypes } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' })
    }
    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' })
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    const lower = email.toLowerCase().trim()
    const existing = await User.findOne({ email: lower })
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' })
    }

    const user = await User.create({
      name: name.trim(),
      email: lower,
      password,
      phone: phone?.trim() || '',
      accountTypes: Array.isArray(accountTypes) && accountTypes.length ? accountTypes : ['buyer'],
    })

    const token = signToken(user._id, user.role)
    res.status(201).json({ token, user: user.toJSON() })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const ok = await user.comparePassword(password)
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const token = signToken(user._id, user.role)
    res.json({ token, user: user.toJSON() })
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user.toJSON() })
})

// PUT /api/auth/profile
router.put('/profile', auth, async (req, res, next) => {
  try {
    const { name, phone, accountTypes } = req.body
    const update = {}
    if (typeof name === 'string' && name.trim()) update.name = name.trim()
    if (typeof phone === 'string') update.phone = phone.trim()
    if (Array.isArray(accountTypes)) update.accountTypes = accountTypes

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true })
    res.json({ user: user.toJSON() })
  } catch (err) {
    next(err)
  }
})

// PUT /api/auth/password
router.put('/password', auth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' })
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' })
    }

    const user = await User.findById(req.user._id)
    const ok = await user.comparePassword(currentPassword)
    if (!ok) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }
    user.password = newPassword
    await user.save()
    res.json({ message: 'Password changed successfully' })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/forgot-password — issues a token. Sending the email is left
// to a future task (we don't have SMTP wired in the MVP). We still return
// the success message to prevent enumeration.
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
    if (!user) {
      return res.json({ message: 'If an account exists, a reset link has been sent' })
    }

    const resetToken = crypto.randomBytes(32).toString('hex')
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex')
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000 // 1h
    await user.save()

    // TODO: wire SMTP and send the link below.
    const resetUrl = `${process.env.CLIENT_URL || ''}/reset-password/${resetToken}`
    if (process.env.NODE_ENV !== 'production') {
      console.log('Password reset link:', resetUrl)
    }

    res.json({ message: 'If an account exists, a reset link has been sent' })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/reset-password/:token
router.post('/reset-password/:token', async (req, res, next) => {
  try {
    const { password } = req.body
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex')
    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: Date.now() },
    })
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' })
    }

    user.password = password
    user.resetPasswordToken = undefined
    user.resetPasswordExpires = undefined
    await user.save()
    res.json({ message: 'Password reset successfully' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
