const express = require('express')
const router  = express.Router()
const pool    = require('../config/db')

// POST /api/payments/init — Créer une commande + initier le paiement
router.post('/init', async (req, res, next) => {
  const { fname, lname, email, phone, pm, event_id, amount } = req.body

  if (!fname || !lname || !email || !phone || !pm) {
    return res.status(400).json({ error: 'Champs manquants' })
  }

  try {
    // Créer la commande
    const { rows } = await pool.query(
      `INSERT INTO orders (event_id, fname, lname, email, phone, pm, amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [event_id || 1, fname, lname, email, phone, pm, amount || 3000]
    )
    const order = rows[0]

    // Enregistrer la transaction en pending
    await pool.query(
      `INSERT INTO transactions (order_id, provider, status)
       VALUES ($1, $2, 'pending')`,
      [order.id, pm]
    )

    // TODO : appel réel à l'API MTN / Moov / Celtis ici
    // Pour l'instant on retourne l'order_id au frontend
    res.status(201).json({
      order_id: order.id,
      message:  'Commande créée — en attente de paiement'
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/payments/webhook — Callback du provider de paiement
router.post('/webhook', async (req, res, next) => {
  const { order_id, provider_ref, status, provider } = req.body

  try {
    // Mettre à jour la transaction
    await pool.query(
      `UPDATE transactions
       SET status = $1, provider_ref = $2, raw_response = $3, updated_at = NOW()
       WHERE order_id = $4`,
      [status, provider_ref, JSON.stringify(req.body), order_id]
    )

    if (status === 'paid') {
      // Mettre à jour la commande
      await pool.query(
        "UPDATE orders SET status = 'paid' WHERE id = $1",
        [order_id]
      )

      // Générer le ticket automatiquement
      await fetch(`${process.env.BACKEND_URL}/api/tickets/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id })
      })
    }

    res.json({ received: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router