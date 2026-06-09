module.exports = (err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Erreur serveur', detail: err.message })
}