const express = require('express')
const router  = express.Router()
const { v4: uuidv4 } = require('uuid')
const pool    = require('../config/db')

// Génération du code billet
function genCode() {
  return 'JEN-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

// Génération du siège
function genSeat() {
  const rows = ['A','B','C','D','E','F']
  const r = rows[Math.floor(Math.random() * rows.length)]
  const n = String(Math.floor(Math.random() * 40) + 1).padStart(2, '0')
  return r + n
}

// POST /api/tickets/create
// Appelé par le webhook après paiement confirmé
router.post('/create', async (req, res, next) => {
  const { order_id } = req.body
  if (!order_id) return res.status(400).json({ error: 'order_id requis' })

  try {
    // Vérifier que la commande est bien payée
    const { rows } = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND status = $2',
      [order_id, 'paid']
    )
    if (!rows.length) return res.status(404).json({ error: 'Commande introuvable ou non payée' })

    const order = rows[0]

    // Vérifier qu'un ticket n'existe pas déjà
    const existing = await pool.query(
      'SELECT id FROM tickets WHERE order_id = $1', [order_id]
    )
    if (existing.rows.length) {
      return res.json({ ticket_id: existing.rows[0].id })
    }

    const code    = genCode()
    const seat    = genSeat()
    const qr_data = `${code}|${seat}|${order.email}`

    const ticket = await pool.query(
      `INSERT INTO tickets (order_id, code, seat, qr_data)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [order_id, code, seat, qr_data]
    )

    res.status(201).json(ticket.rows[0])
  } catch (err) {
    next(err)
  }
})

// GET /api/tickets/:code — Récupérer un ticket par son code
router.get('/:code', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, o.fname, o.lname, o.email, o.pm, o.amount
       FROM tickets t
       JOIN orders o ON o.id = t.order_id
       WHERE t.code = $1`,
      [req.params.code]
    )
    if (!rows.length) return res.status(404).json({ error: 'Ticket introuvable' })
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

// POST /api/tickets/verify — Scanner QR à l'entrée
router.post('/verify', async (req, res, next) => {
  const { qr_data } = req.body
  if (!qr_data) return res.status(400).json({ error: 'qr_data requis' })

  try {
    const { rows } = await pool.query(
      'SELECT * FROM tickets WHERE qr_data = $1', [qr_data]
    )
    if (!rows.length) return res.status(404).json({ valid: false, message: 'Ticket invalide' })

    const ticket = rows[0]
    if (ticket.is_used) {
      return res.json({ valid: false, message: 'Ticket déjà utilisé', used_at: ticket.used_at })
    }

    // Marquer comme utilisé
    await pool.query(
      'UPDATE tickets SET is_used = TRUE, used_at = NOW() WHERE id = $1',
      [ticket.id]
    )
    res.json({ valid: true, message: 'Accès autorisé', ticket })
  } catch (err) {
    next(err)
  }
})

// GET /api/tickets/by-order/:order_id
router.get('/by-order/:order_id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, o.fname, o.lname, o.email, o.pm, o.amount
       FROM tickets t
       JOIN orders o ON o.id = t.order_id
       WHERE t.order_id = $1`,
      [req.params.order_id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Ticket pas encore généré' })
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

module.exports = router
