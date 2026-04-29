require('dotenv').config()
const app = require('./app.js')
const connectDB = require('./config/db.js')

const PORT = process.env.PORT || 5001

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`noBrokers API running on port ${PORT}`)
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
    })
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB:', error.message)
    process.exit(1)
  })
