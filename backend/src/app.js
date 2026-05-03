const express = require('express')
const cors = require('cors')
const connectDB = require('./config/db.js')
const errorHandler = require('./middleware/errorHandler.js')

const authRoutes = require('./routes/auth.js')
const userRoutes = require('./routes/users.js')
const listingRoutes = require('./routes/listings.js')
const offerRoutes = require('./routes/offers.js')
const watchlistRoutes = require('./routes/watchlist.js')
const uploadRoutes = require('./routes/uploads.js')
const adminRoutes = require('./routes/admin.js')
const availabilityRoutes = require('./routes/availability.js')
const viewingRoutes = require('./routes/viewings.js')
const chatRoutes = require('./routes/chat.js')

const app = express()

const baseAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://nobrokers.my',
  'https://www.nobrokers.my',
  process.env.CLIENT_URL,
]

const extraAllowedOrigins = (process.env.EXTRA_ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const allowedOrigins = [...baseAllowedOrigins, ...extraAllowedOrigins].filter(Boolean)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      // Allow Vercel preview deployments by default — they share the *.vercel.app suffix.
      if (/\.vercel\.app$/.test(new URL(origin).hostname)) return callback(null, true)
      return callback(new Error(`Origin ${origin} not allowed by CORS`))
    },
    credentials: true,
  }),
)

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

// Lazy-connect on first request (serverless safe).
app.use(async (req, res, next) => {
  try {
    await connectDB()
    next()
  } catch (error) {
    console.error('Database connection failed:', error.message)
    res.status(500).json({ error: 'Database connection failed' })
  }
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/listings', listingRoutes)
app.use('/api/offers', offerRoutes)
app.use('/api/watchlist', watchlistRoutes)
app.use('/api/uploads', uploadRoutes)
app.use('/api/admin', adminRoutes)
// Availability router owns two path families — /owners/... and /listings/:id/slots —
// so mount at /api and let its own paths resolve.
app.use('/api', availabilityRoutes)
app.use('/api/viewings', viewingRoutes)
app.use('/api/chat', chatRoutes)

app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.use(errorHandler)

module.exports = app
