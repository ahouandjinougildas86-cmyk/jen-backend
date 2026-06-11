const express = require('express')
const router = express.Router()
const pool = require('../config/db')
const { FedaPay, Transaction } = require('fedapay')

FedaPay.setApiKey(process.env.FEDAPAY_SECRET_KEY)
FedaPay.setEnvironment(process.env.FEDAPAY_ENV || 'sandbox')

function genCode() {
  return 'JEN-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

function genSeat() {
  const rows = ['A', 'B', 'C', 'D', 'E', 'F']
  const r = rows[Math.floor(Math.random() * rows.length)]
  const n = String(Math.floor(Math.random() * 40) + 1).padStart(2, '0')
  return r + n
}

// POST /api/payments/init
router.post('/init', async (req, res) => {
  const { fname, lname, email, phone, pm, amount, event_id } = req.body
  if (!fname || !lname || !email || !phone || !pm) {
    return res.status(400).json({ error: 'Champs manquants' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO orders (event_id, fname, lname, email, phone, pm, amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [event_id || 1, fname, lname, email, phone, pm, amount || 3000]
    )
    const order = rows[0]

    await pool.query(
      `INSERT INTO transactions (order_id, provider, status)
       VALUES ($1, $2, 'pending')`,
      [order.id, pm]
    )

    const frontendUrl = process.env.FRONTEND_URL || 'https://jen-five.vercel.app'

    const transaction = await Transaction.create({
      description: `Billet JEN - ${fname} ${lname}`,
      amount: amount || 3000,
      currency: { iso: 'XOF' },
      callback_url: `${frontendUrl}?status=approved&order_id=${order.id}`,
      cancel_url: `${frontendUrl}?status=cancelled`,
      custom_metadata: { order_id: order.id },
      customer: {
        firstname: fname,
        lastname: lname,
        email: email,
        phone_number: { number: phone, country: 'BJ' }
      }
    })

    const token = await transaction.generateToken()

    res.status(201).json({
      order_id: order.id,
      payment_url: token.url,
      token: token.token
    })
  } catch (err) {
    res.status(500).json({
      error: 'Erreur serveur',
      message: err?.message,
      status: err?.status,
      errors: err?.errors,
      httpStatus: err?.httpStatus,
      errorMessage: err?.errorMessage
    })
  }
})

// POST /api/payments/webhook
router.post('/webhook', async (req, res, next) => {
  try {
    // Log brut complet pour voir la structure FedaPay
    console.log('Body brut:', JSON.stringify(req.body))
    console.log('Headers:', JSON.stringify(req.headers))

    const event = req.body

    console.log('Webhook reçu:', event?.name)

    if (event.name === 'transaction.approved') {
      const transaction = event.entity
      const ref = transaction?.id?.toString()
      const order_id = transaction?.custom_metadata?.order_id || null

      console.log('Webhook approved — order_id:', order_id)

      if (!order_id) {
        console.error('Webhook: order_id manquant')
        return res.json({ received: true })
      }

      await pool.query(
        `UPDATE transactions
     SET status = 'paid', provider_ref = $1, raw_response = $2, updated_at = NOW()
     WHERE order_id = $3`,
        [ref, JSON.stringify(event), order_id]
      )

      await pool.query(
        "UPDATE orders SET status = 'paid' WHERE id = $1",
        [order_id]
      )

      const existing = await pool.query(
        'SELECT id FROM tickets WHERE order_id = $1',
        [order_id]
      )

      if (!existing.rows.length) {
        const orderResult = await pool.query(
          'SELECT * FROM orders WHERE id = $1',
          [order_id]
        )

        if (orderResult.rows.length) {
          const order = orderResult.rows[0]
          const code = genCode()
          const seat = genSeat()
          const qr_data = `${code}|${seat}|${order.email}`

          await pool.query(
            `INSERT INTO tickets (order_id, code, seat, qr_data)
         VALUES ($1, $2, $3, $4)`,
            [order_id, code, seat, qr_data]
          )

          console.log(`Ticket créé: ${code} — siège ${seat} — commande ${order_id}`)
        }
      }
    }

    res.json({ received: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router