const express  = require('express')
const router   = express.Router()
const pool     = require('../config/db')
const FedaPay  = require('fedapay')

// Config FedaPay
FedaPay.FedaPay.setApiKey(process.env.FEDAPAY_SECRET_KEY)
FedaPay.FedaPay.setEnvironment(process.env.FEDAPAY_ENV || 'sandbox')

// POST /api/payments/init
router.post('/init', async (req, res, next) => {
  const { fname, lname, email, phone, pm, event_id, amount } = req.body

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

    const transaction = await FedaPay.Transaction.create({
      description: `Billet JEN - ${fname} ${lname}`,
      amount:      amount || 3000,
      currency:    { iso: 'XOF' },
      callback_url: `${process.env.FRONTEND_URL}?status={status}`,
      customer: {
        firstname: fname,
        lastname:  lname,
        email:     email,
        phone_number: { number: phone, country: 'BJ' }
      },
      custom_metadata: { order_id: order.id }
    })

    const token = await transaction.generateToken()

    res.status(201).json({
      order_id:    order.id,
      payment_url: token.url,
      token:       token.token
    })

  } catch (err) {
    next(err)
  }
})

// POST /api/payments/webhook
router.post('/webhook', async (req, res, next) => {
  try {
    const event = req.body

    if (event.name === 'transaction.approved') {
      const ref       = event.data?.transaction?.id?.toString()
      const customRef = event.data?.transaction?.custom_metadata?.order_id

      await pool.query(
        `UPDATE transactions
         SET status = 'paid', provider_ref = $1, raw_response = $2, updated_at = NOW()
         WHERE order_id = $3`,
        [ref, JSON.stringify(event), customRef]
      )

      await pool.query(
        "UPDATE orders SET status = 'paid' WHERE id = $1",
        [customRef]
      )

      await fetch(`${process.env.BACKEND_URL}/api/tickets/create`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ order_id: customRef })
      })
    }

    res.json({ received: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router