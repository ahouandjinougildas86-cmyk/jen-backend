module.exports = (err, req, res, next) => {
  console.error('ERREUR COMPLETE:', JSON.stringify(err, null, 2))
  console.error('MESSAGE:', err.message)
  console.error('STACK:', err.stack)
  res.status(500).json({ error: 'Erreur serveur', detail: err.message })
}