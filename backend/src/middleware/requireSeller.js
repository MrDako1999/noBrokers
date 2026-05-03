// Gate for anything that can only be done by an enrolled seller/landlord
// (listing creation, availability edits, owner-side viewing actions).
// Admins pass through so they can moderate regardless of their own
// enrollment status.
//
// Assumes the `auth` middleware has already attached `req.user`. Composition
// pattern at the route: router.post('/', auth, requireSeller, handler).
function requireSeller(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  if (req.user.role === 'admin') return next()
  if (!req.user.sellerProfile?.enrolled) {
    return res.status(403).json({
      error: 'Seller enrollment required',
      code: 'seller_not_enrolled',
    })
  }
  next()
}

module.exports = requireSeller
