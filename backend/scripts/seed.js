require('dotenv').config()
const mongoose = require('mongoose')
const connectDB = require('../src/config/db.js')
const User = require('../src/models/User.js')
const Listing = require('../src/models/Listing.js')

const SAMPLE_LISTINGS = [
  {
    title: 'Modern 3-bed condo in Mont Kiara',
    description:
      'Bright corner unit with city skyline view, fully furnished, walkable to Plaza Mont Kiara and Garden International School.',
    listingType: 'sale',
    propertyType: 'condo',
    price: 1450000,
    bedrooms: 3,
    bathrooms: 2,
    parkingSpaces: 2,
    sqft: 1480,
    furnished: 'fully',
    amenities: ['Pool', 'Gym', 'Playground', '24h Security', 'Lift'],
    location: {
      address: 'Jalan Kiara, Mont Kiara',
      city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan',
      postcode: '50480',
      country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6555, 3.1731] },
    },
  },
  {
    title: 'Cosy 2-bed serviced apartment in Bangsar South',
    description:
      'Move-in ready 2-bed at The Establishment. Comes with all white goods, two car parks, walking distance to The Sphere.',
    listingType: 'rent',
    propertyType: 'serviced_residence',
    monthlyRent: 3500,
    bedrooms: 2,
    bathrooms: 2,
    parkingSpaces: 2,
    sqft: 950,
    furnished: 'fully',
    amenities: ['Pool', 'Gym', 'Co-working lounge', 'Lift'],
    location: {
      address: 'Jalan Kerinchi, Bangsar South',
      city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan',
      postcode: '59200',
      country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6692, 3.1117] },
    },
  },
  {
    title: 'Double-storey terrace, USJ 5',
    description:
      'Original-condition 4-bed terrace, freehold, gated and guarded neighbourhood. Walking distance to USJ 4 wet market.',
    listingType: 'sale',
    propertyType: 'terrace',
    price: 1100000,
    bedrooms: 4,
    bathrooms: 3,
    parkingSpaces: 2,
    sqft: 1900,
    furnished: 'unfurnished',
    amenities: ['Gated & guarded', 'Garden', 'Storeroom'],
    location: {
      address: 'Jalan USJ 5, USJ 5',
      city: 'Subang Jaya',
      state: 'Selangor',
      postcode: '47610',
      country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.5820, 3.0561] },
    },
  },
]

async function seed() {
  await connectDB()

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@nobrokers.my').toLowerCase()
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'changeme123'
  const adminName = process.env.SEED_ADMIN_NAME || 'noBrokers Admin'

  let admin = await User.findOne({ email: adminEmail })
  if (!admin) {
    admin = await User.create({
      email: adminEmail,
      password: adminPassword,
      name: adminName,
      role: 'admin',
      accountTypes: ['owner', 'landlord'],
      kyc: { status: 'verified', verifiedAt: new Date() },
    })
    console.log(`Created admin: ${adminEmail} / ${adminPassword}`)
  } else {
    console.log(`Admin already exists: ${adminEmail}`)
  }

  let demoOwner = await User.findOne({ email: 'owner@nobrokers.my' })
  if (!demoOwner) {
    demoOwner = await User.create({
      email: 'owner@nobrokers.my',
      password: 'changeme123',
      name: 'Demo Owner',
      accountTypes: ['owner', 'landlord'],
      kyc: { status: 'verified', verifiedAt: new Date() },
    })
    console.log('Created demo owner: owner@nobrokers.my / changeme123')
  }

  const existing = await Listing.countDocuments({ owner: demoOwner._id })
  if (existing === 0) {
    await Listing.insertMany(
      SAMPLE_LISTINGS.map((l) => ({
        ...l,
        owner: demoOwner._id,
        status: 'active',
        verification: { verified: true, verifiedAt: new Date(), verifiedBy: admin._id },
      })),
    )
    console.log(`Seeded ${SAMPLE_LISTINGS.length} sample listings`)
  } else {
    console.log(`Demo owner already has ${existing} listings; skipping`)
  }

  await mongoose.disconnect()
  console.log('Done')
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
