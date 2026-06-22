require('dotenv').config()
const express       = require('express')
const cors          = require('cors')
const errorHandler  = require('./middlewares/errorHandler')

const app = express()

// ── CORS restreint au frontend uniquement ──
app.use(cors({ origin: process.env.FRONTEND_URL || 'https://jen-five.vercel.app' }))

// ── Webhook AVANT express.json() — nécessite le body brut ──
const { webhookRouter, router: paymentRouter } = require('./routes/payments')
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }), webhookRouter)

// ── Body parser pour le reste ──
app.use(express.json())

// ── Routes ──
app.use('/api/tickets',  require('./routes/tickets'))
app.use('/api/payments', paymentRouter)

// ── Health check Railway ──
app.get('/health', (_, res) => res.json({ status: 'ok' }))

app.use(errorHandler)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`JEN backend — port ${PORT}`))