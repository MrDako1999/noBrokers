const mongoose = require('mongoose')

// Cache the connection across serverless invocations. Without this, every
// cold start opens a new socket pool and Atlas eventually rejects us.
let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not set')
    }

    cached.promise = mongoose
      .connect(process.env.MONGODB_URI, { bufferCommands: false })
      .then((m) => {
        console.log('MongoDB connected')
        return m
      })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}

module.exports = connectDB
