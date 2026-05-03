require('dotenv').config()
const mongoose = require('mongoose')
const connectDB = require('../src/config/db.js')
const User = require('../src/models/User.js')
const Listing = require('../src/models/Listing.js')

// Back-fill `sellerProfile.enrolled` on users who already own at least one
// non-draft listing. Safety net for the seller-enrollment rollout so
// existing listers don't get locked out of the listing-create flow.
async function main() {
  await connectDB()

  const ownerIds = await Listing.distinct('owner', {
    status: { $in: ['pending', 'active', 'sold', 'rented', 'archived', 'rejected'] },
  })

  if (!ownerIds.length) {
    console.log('No existing owners found — nothing to back-fill.')
    await mongoose.disconnect()
    return
  }

  const now = new Date()
  const result = await User.updateMany(
    {
      _id: { $in: ownerIds },
      $or: [
        { 'sellerProfile.enrolled': { $ne: true } },
        { sellerProfile: { $exists: false } },
      ],
    },
    {
      $set: {
        'sellerProfile.enrolled': true,
        'sellerProfile.enrolledAt': now,
        'sellerProfile.termsAcceptedVersion': 'backfill-v1',
        'sellerProfile.termsAcceptedAt': now,
      },
    },
  )

  console.log(
    `Back-fill complete: matched ${result.matchedCount}, modified ${result.modifiedCount} of ${ownerIds.length} candidate owners.`,
  )
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('Back-fill failed:', err)
  process.exit(1)
})
