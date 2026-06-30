const express = require('express')
const cors = require('cors')
require('dotenv').config()

const syncRoutes = require('./routes/sync')

const app = express()
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: 'Tulana Kart API running' })
})

app.use('/api', syncRoutes)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})