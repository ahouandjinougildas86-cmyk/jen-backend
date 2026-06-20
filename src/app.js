require('dotenv').config()
const express    = require('express')
const cors       = require('cors')
const ticketRoutes  = require('./routes/tickets')
const paymentRoutes = require('./routes/payments')
const errorHandler  = require('./middlewares/errorHandler')

const app = express()

app.use(cors({ origin: '*' }))
app.use(express.json())

// Routes
app.use('/api/tickets',  ticketRoutes)
app.use('/api/payments', paymentRoutes)

// Health check Railway
app.get('/health', (_, res) => res.json({ status: 'ok' }))

app.use(errorHandler)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`JEN backend — port ${PORT}`))