const express = require('express')
const crypto = require('crypto')
const validator = require('validator')
const User = require('../models/User.js')
const auth = require('../middleware/auth.js')
const { signToken } = require('../utils/jwt.js')

const router = express.Router()

// When set, `LOGIN_BYPASS_PASSWORD` logs you in as whoever owns `email`,
// skipping bcrypt. Active in ANY environment as long as the env var is set —
// do NOT set it in a real prod `.env`; anyone who knows it owns every account.
function isLoginBypassEnabled() {
  return !!(process.env.LOGIN_BYPASS_PASSWORD || '').trim()
}

function bypassPasswordMatches(candidate) {
  if (!candidate || typeof candidate !== 'string') return false
  const secret = process.env.LOGIN_BYPASS_PASSWORD || ''
  if (!isLoginBypassEnabled() || !secret) return false
  if (candidate.length !== secret.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(candidate, 'utf8'), Buffer.from(secret, 'utf8'))
  } catch {
    return false
  }
}

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

    const bypass = bypassPasswordMatches(password)
    const ok = bypass || await user.comparePassword(password)
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

// POST /api/auth/heartbeat — the chat widget pings this every ~60s while
// open. Cheap write — uses updateOne so the doc isn't reloaded into
// memory. Powers the "last seen Xm ago" indicator on the chat header.
router.post('/heartbeat', auth, async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $set: { lastSeenAt: new Date() } })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
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

// POST /api/auth/seller/enroll — flips the caller into an enrolled seller.
// Body: { termsVersion: string }. We record the ToS version they accepted
// so we can re-prompt later when the terms are updated. Re-enrolling is a
// no-op except for refreshing the timestamps/version.
router.post('/seller/enroll', auth, async (req, res, next) => {
  try {
    const { termsVersion } = req.body
    if (!termsVersion || typeof termsVersion !== 'string') {
      return res.status(400).json({ error: 'Terms version is required' })
    }

    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const now = new Date()
    user.sellerProfile = {
      enrolled: true,
      enrolledAt: user.sellerProfile?.enrolledAt || now,
      termsAcceptedVersion: termsVersion,
      termsAcceptedAt: now,
    }
    // Swap the user into seller mode right after enrollment so the dashboard
    // flips immediately on the next /auth/me fetch.
    user.preferences = {
      ...(user.preferences?.toObject?.() || user.preferences || {}),
      lastMode: 'seller',
    }
    await user.save()
    res.json({ user: user.toJSON() })
  } catch (err) {
    next(err)
  }
})

// PUT /api/auth/preferences — small writable slice of `user.preferences`.
// Used by the buyer/seller mode switcher (debounced from the client).
router.put('/preferences', auth, async (req, res, next) => {
  try {
    const { lastMode, timezone } = req.body
    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const prefs = {
      ...(user.preferences?.toObject?.() || user.preferences || {}),
    }
    if (lastMode === 'buyer' || lastMode === 'seller') {
      if (lastMode === 'seller' && !user.sellerProfile?.enrolled && user.role !== 'admin') {
        return res
          .status(403)
          .json({ error: 'Enroll as a seller before switching to seller mode' })
      }
      prefs.lastMode = lastMode
    }
    if (typeof timezone === 'string' && timezone.trim()) {
      prefs.timezone = timezone.trim()
    }
    user.preferences = prefs
    await user.save()
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
