require('dotenv').config()
const mongoose = require('mongoose')
const connectDB = require('../src/config/db.js')
const User = require('../src/models/User.js')
const Listing = require('../src/models/Listing.js')

// Stable Unsplash IDs for real-estate / interior shots so the demo grid never
// 404s. Each seed listing rotates through this pool to get 1-3 cover photos.
const STOCK_PHOTOS = [
  '1560448204-e02f11c3d0e2', // modern living room
  '1502672260266-1c1ef2d93688', // bedroom
  '1493809842364-78817add7ffb', // apartment exterior
  '1567496898669-ee935f5f647a', // condo balcony
  '1522708323590-d24dbb6b0267', // kitchen
  '1564013799919-ab600027ffc6', // residential building
  '1505691938895-1758d7feb511', // luxury living
  '1554995207-c18c203602cb', // bedroom interior
  '1512917774080-9991f1c4c750', // suburban house
  '1600596542815-ffad4c1539a9', // dining area
  '1600585154340-be6161a56a0c', // facade
  '1583608205776-bfd35f0d9f83', // serviced apt
]

function photo(idx, seq = 0) {
  const id = STOCK_PHOTOS[(idx + seq) % STOCK_PHOTOS.length]
  return {
    url: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=70`,
    key: `seed/${id}`,
    width: 900,
    height: 600,
  }
}

function imagesFor(idx, count = 3) {
  return Array.from({ length: count }, (_, i) => photo(idx, i))
}

// 30 sample listings spread across KL + Selangor with realistic coordinates.
// Mix of sale/rent, all property types, varied prices/sizes so the map shows
// a meaningful spread of price-bubble markers + cluster bubbles where they
// pile up (e.g. Mont Kiara, KLCC, Bangsar).
const SAMPLE_LISTINGS = [
  // --- Mont Kiara cluster (5 listings within ~600m) ----------------------
  {
    title: 'Modern 3-bed condo in Mont Kiara',
    description:
      'Bright corner unit at Verve Suites with KL skyline view. Fully furnished, walkable to Plaza Mont Kiara and Garden International School.',
    listingType: 'sale',
    propertyType: 'condo',
    price: 1450000,
    bedrooms: 3, bathrooms: 2, parkingSpaces: 2, sqft: 1480, furnished: 'fully',
    amenities: ['Pool', 'Gym', 'Playground', '24h Security', 'Lift'],
    location: {
      address: 'Jalan Kiara, Mont Kiara', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '50480', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6555, 3.1731] },
    },
  },
  {
    title: 'Spacious 4-bed family condo at 11 Mont Kiara',
    description:
      'Large family unit with 4 ensuite bedrooms, dual-key configuration, three covered parking bays. Premium finishes throughout.',
    listingType: 'sale',
    propertyType: 'condo',
    price: 2950000,
    bedrooms: 4, bathrooms: 4, parkingSpaces: 3, sqft: 2480, furnished: 'partially',
    amenities: ['Pool', 'Gym', '24h Security', 'Tennis Court', 'BBQ Area'],
    location: {
      address: '11 Mont Kiara, Jalan Kiara', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '50480', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6571, 3.1718] },
    },
  },
  {
    title: 'Penthouse with rooftop pool, Mont Kiara',
    description:
      'Duplex penthouse with private rooftop plunge pool. 360° views, marble floors throughout, two car parks.',
    listingType: 'sale',
    propertyType: 'condo',
    price: 4800000,
    bedrooms: 4, bathrooms: 5, parkingSpaces: 2, sqft: 3850, furnished: 'fully',
    amenities: ['Pool', 'Gym', 'Sauna', '24h Security'],
    location: {
      address: 'Jalan Duta Kiara, Mont Kiara', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '50480', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6589, 3.1742] },
    },
  },
  {
    title: 'Studio for rent at Solaris Mont Kiara',
    description:
      'Smart studio above Solaris dining strip. Walking distance to dozens of cafes and a 24/7 gym.',
    listingType: 'rent',
    propertyType: 'serviced_residence',
    monthlyRent: 2200,
    bedrooms: 1, bathrooms: 1, parkingSpaces: 1, sqft: 540, furnished: 'fully',
    amenities: ['Pool', 'Gym', 'Lift', 'Wi-Fi'],
    location: {
      address: 'Solaris Mont Kiara', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '50480', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6512, 3.1701] },
    },
  },
  {
    title: 'Family 3-bed for rent, Mont Kiara Aman',
    description:
      'Renovated 3-bed unit with maids room. Quiet block, lots of natural light, one street from international schools.',
    listingType: 'rent',
    propertyType: 'condo',
    monthlyRent: 6500,
    bedrooms: 3, bathrooms: 3, parkingSpaces: 2, sqft: 1620, furnished: 'partially',
    amenities: ['Pool', 'Gym', 'Playground', '24h Security'],
    location: {
      address: 'Jalan Kiara 3, Mont Kiara Aman', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '50480', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6534, 3.1715] },
    },
  },

  // --- KLCC / Bukit Bintang cluster (5 listings) ------------------------
  {
    title: '2-bed apartment overlooking KLCC park',
    description:
      'Direct KLCC park-facing unit at Park Seven. Marble flooring, premium kitchen, two-tier security.',
    listingType: 'sale',
    propertyType: 'apartment',
    price: 2750000,
    bedrooms: 2, bathrooms: 2, parkingSpaces: 2, sqft: 1480, furnished: 'partially',
    amenities: ['Pool', 'Gym', 'Lift', '24h Security', 'Sauna'],
    location: {
      address: 'Persiaran KLCC', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '50450', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.7138, 3.1561] },
    },
  },
  {
    title: 'Furnished 1-bed at Vortex KLCC for rent',
    description:
      'Walking distance to Pavilion KL. Sleek 1-bed with desk space, pool overlooking the city.',
    listingType: 'rent',
    propertyType: 'serviced_residence',
    monthlyRent: 3200,
    bedrooms: 1, bathrooms: 1, parkingSpaces: 1, sqft: 660, furnished: 'fully',
    amenities: ['Pool', 'Gym', 'Lift', 'Wi-Fi'],
    location: {
      address: 'Vortex KLCC, Jalan Sultan Ismail', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '50250', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.7104, 3.1538] },
    },
  },
  {
    title: '3-bed at The Pearl KLCC',
    description:
      'Sky-high 3-bed with floor-to-ceiling windows. Two-bay parking and concierge service included.',
    listingType: 'rent',
    propertyType: 'condo',
    monthlyRent: 8500,
    bedrooms: 3, bathrooms: 3, parkingSpaces: 2, sqft: 1850, furnished: 'fully',
    amenities: ['Pool', 'Gym', '24h Security', 'Lift', 'Sauna'],
    location: {
      address: 'The Pearl, Jalan Stonor', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '50450', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.7165, 3.1503] },
    },
  },
  {
    title: 'Loft apartment, Bukit Bintang',
    description:
      'Industrial-chic loft with mezzanine bedroom. Steps from MRT and Pavilion.',
    listingType: 'sale',
    propertyType: 'apartment',
    price: 980000,
    bedrooms: 1, bathrooms: 1, parkingSpaces: 1, sqft: 720, furnished: 'fully',
    amenities: ['Lift', '24h Security', 'Wi-Fi'],
    location: {
      address: 'Jalan Bukit Bintang', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '55100', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.7130, 3.1465] },
    },
  },
  {
    title: 'Shop-office for rent on Changkat',
    description:
      '3-storey shop-office on Changkat Bukit Bintang. Ground-floor F&B-ready with kitchen exhaust in place.',
    listingType: 'rent',
    propertyType: 'shop_office',
    monthlyRent: 12500,
    bedrooms: 0, bathrooms: 2, parkingSpaces: 0, sqft: 2400, furnished: 'partially',
    amenities: ['24h Security'],
    location: {
      address: 'Changkat Bukit Bintang', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '50200', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.7088, 3.1455] },
    },
  },

  // --- Bangsar / Bangsar South ------------------------------------------
  {
    title: 'Cosy 2-bed serviced apartment in Bangsar South',
    description:
      'Move-in ready 2-bed at The Establishment. All white goods included, two car parks, walking distance to The Sphere.',
    listingType: 'rent',
    propertyType: 'serviced_residence',
    monthlyRent: 3500,
    bedrooms: 2, bathrooms: 2, parkingSpaces: 2, sqft: 950, furnished: 'fully',
    amenities: ['Pool', 'Gym', 'Co-working Lounge', 'Lift'],
    location: {
      address: 'Jalan Kerinchi, Bangsar South', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '59200', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6692, 3.1117] },
    },
  },
  {
    title: 'Bangsar bungalow on quiet cul-de-sac',
    description:
      'Detached bungalow with garden and pool. Mature trees, secure neighbourhood, close to Bangsar Village.',
    listingType: 'sale',
    propertyType: 'bungalow',
    price: 6200000,
    bedrooms: 5, bathrooms: 5, parkingSpaces: 4, sqft: 5200, furnished: 'unfurnished',
    amenities: ['Pool', 'Garden', 'Storeroom', 'Pet Friendly'],
    location: {
      address: 'Jalan Maarof, Bangsar', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '59000', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6707, 3.1295] },
    },
  },
  {
    title: '2-bed condo at Pantai Hillpark',
    description:
      'Hillside condo with green views. Recently repainted, includes built-in cabinetry.',
    listingType: 'sale',
    propertyType: 'condo',
    price: 690000,
    bedrooms: 2, bathrooms: 2, parkingSpaces: 1, sqft: 990, furnished: 'partially',
    amenities: ['Pool', '24h Security', 'Playground'],
    location: {
      address: 'Pantai Hillpark, Jalan Pantai', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '59200', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6644, 3.1093] },
    },
  },

  // --- Subang / PJ / Damansara ------------------------------------------
  {
    title: 'Double-storey terrace, USJ 5',
    description:
      'Original-condition 4-bed terrace, freehold, gated and guarded. Walking distance to USJ 4 wet market.',
    listingType: 'sale',
    propertyType: 'terrace',
    price: 1100000,
    bedrooms: 4, bathrooms: 3, parkingSpaces: 2, sqft: 1900, furnished: 'unfurnished',
    amenities: ['Garden', 'Storeroom'],
    location: {
      address: 'Jalan USJ 5, USJ 5', city: 'Subang Jaya',
      state: 'Selangor', postcode: '47610', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.5820, 3.0561] },
    },
  },
  {
    title: 'Renovated semi-D in SS2, PJ',
    description:
      'Tastefully renovated 5-bed semi-D with modern kitchen and entertainment room. Quiet end-lot.',
    listingType: 'sale',
    propertyType: 'semi_detached',
    price: 3450000,
    bedrooms: 5, bathrooms: 4, parkingSpaces: 4, sqft: 3200, furnished: 'partially',
    amenities: ['Garden', 'Storeroom'],
    location: {
      address: 'Jalan SS 2/55, SS2', city: 'Petaling Jaya',
      state: 'Selangor', postcode: '47300', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6217, 3.1213] },
    },
  },
  {
    title: 'Townhouse in Damansara Perdana',
    description:
      'Lower-level townhouse with private garden and 2 car parks. Family-friendly community pool.',
    listingType: 'sale',
    propertyType: 'townhouse',
    price: 880000,
    bedrooms: 3, bathrooms: 3, parkingSpaces: 2, sqft: 1480, furnished: 'unfurnished',
    amenities: ['Pool', 'Garden', '24h Security'],
    location: {
      address: 'Persiaran Surian, Damansara Perdana', city: 'Petaling Jaya',
      state: 'Selangor', postcode: '47820', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6140, 3.1664] },
    },
  },
  {
    title: '1-bed serviced apartment, Empire Damansara',
    description:
      'Smart 1-bed for rent above Empire Damansara mall. Includes one parking and 24/7 concierge.',
    listingType: 'rent',
    propertyType: 'serviced_residence',
    monthlyRent: 1900,
    bedrooms: 1, bathrooms: 1, parkingSpaces: 1, sqft: 480, furnished: 'fully',
    amenities: ['Pool', 'Gym', 'Lift', 'Wi-Fi'],
    location: {
      address: 'Empire Damansara, Jalan PJU 8', city: 'Petaling Jaya',
      state: 'Selangor', postcode: '47820', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6112, 3.1620] },
    },
  },
  {
    title: 'Refurbished link house in Bandar Utama',
    description:
      'Move-in ready 4-bed link house steps from 1Utama mall. Granite kitchen tops, freshly tiled.',
    listingType: 'rent',
    propertyType: 'terrace',
    monthlyRent: 4200,
    bedrooms: 4, bathrooms: 3, parkingSpaces: 2, sqft: 1800, furnished: 'partially',
    amenities: ['Garden', 'Storeroom'],
    location: {
      address: 'Bandar Utama, BU3', city: 'Petaling Jaya',
      state: 'Selangor', postcode: '47800', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6098, 3.1497] },
    },
  },

  // --- Cheras / Setapak / Wangsa Maju -----------------------------------
  {
    title: 'Affordable 3-bed in Pandan Indah',
    description:
      'Refurbished 3-bed apartment with new aircons. Walking distance to Pandan Indah LRT.',
    listingType: 'sale',
    propertyType: 'apartment',
    price: 380000,
    bedrooms: 3, bathrooms: 2, parkingSpaces: 1, sqft: 920, furnished: 'partially',
    amenities: ['Lift', '24h Security'],
    location: {
      address: 'Jalan Pandan Indah', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '55100', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.7470, 3.1290] },
    },
  },
  {
    title: 'Brand new condo in Cheras Maluri',
    description:
      'Freehold 3-bed corner unit with KLCC view. Adjacent to MRT and AEON Maluri.',
    listingType: 'sale',
    propertyType: 'condo',
    price: 720000,
    bedrooms: 3, bathrooms: 2, parkingSpaces: 2, sqft: 1180, furnished: 'unfurnished',
    amenities: ['Pool', 'Gym', '24h Security', 'Lift', 'Playground'],
    location: {
      address: 'Jalan Jejaka, Maluri', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '55100', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.7301, 3.1240] },
    },
  },
  {
    title: 'Setapak 2-bed for rent, walking to LRT',
    description:
      'Renovated 2-bed condo with new IKEA kitchen. Five minutes to Wangsa Maju LRT.',
    listingType: 'rent',
    propertyType: 'condo',
    monthlyRent: 1600,
    bedrooms: 2, bathrooms: 2, parkingSpaces: 1, sqft: 880, furnished: 'partially',
    amenities: ['Pool', 'Lift', '24h Security'],
    location: {
      address: 'Jalan Setapak', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '53000', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.7222, 3.1972] },
    },
  },

  // --- Cyberjaya / Putrajaya / Shah Alam --------------------------------
  {
    title: 'Garden townhouse in Cyberjaya',
    description:
      'Family townhouse with double-volume living. Steps to MMU and Shaftsbury mall.',
    listingType: 'sale',
    propertyType: 'townhouse',
    price: 920000,
    bedrooms: 4, bathrooms: 3, parkingSpaces: 2, sqft: 2050, furnished: 'unfurnished',
    amenities: ['Garden', '24h Security', 'Playground'],
    location: {
      address: 'Persiaran Cyber Heights', city: 'Cyberjaya',
      state: 'Selangor', postcode: '63000', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6479, 2.9220] },
    },
  },
  {
    title: 'Putrajaya lakeside condo for rent',
    description:
      'Lake-view 3-bed in Precinct 8. Quiet area, walking distance to government offices.',
    listingType: 'rent',
    propertyType: 'condo',
    monthlyRent: 2400,
    bedrooms: 3, bathrooms: 2, parkingSpaces: 1, sqft: 1320, furnished: 'partially',
    amenities: ['Pool', 'Gym', '24h Security'],
    location: {
      address: 'Precinct 8, Putrajaya', city: 'Putrajaya',
      state: 'Wilayah Persekutuan', postcode: '62250', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6890, 2.9270] },
    },
  },
  {
    title: 'Shah Alam family terrace',
    description:
      'Spacious 4-bed terrace in Section 7. Mature neighbourhood, quick access to LKSA.',
    listingType: 'sale',
    propertyType: 'terrace',
    price: 850000,
    bedrooms: 4, bathrooms: 3, parkingSpaces: 2, sqft: 2200, furnished: 'unfurnished',
    amenities: ['Garden', 'Storeroom'],
    location: {
      address: 'Section 7, Jalan Plumbum', city: 'Shah Alam',
      state: 'Selangor', postcode: '40000', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.5235, 3.0830] },
    },
  },

  // --- Klang / Kajang / Semenyih ----------------------------------------
  {
    title: 'Klang corner-lot terrace',
    description:
      'Freehold 2-storey corner-lot terrace in Bandar Botanic. Plenty of frontage parking.',
    listingType: 'sale',
    propertyType: 'terrace',
    price: 720000,
    bedrooms: 4, bathrooms: 3, parkingSpaces: 3, sqft: 1820, furnished: 'unfurnished',
    amenities: ['Garden', 'Storeroom'],
    location: {
      address: 'Bandar Botanic, Klang', city: 'Klang',
      state: 'Selangor', postcode: '41200', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.4267, 3.0408] },
    },
  },
  {
    title: 'Newly built apartment in Kajang',
    description:
      'Affordable 3-bed apartment near Kajang KTM. Includes one parking bay.',
    listingType: 'rent',
    propertyType: 'apartment',
    monthlyRent: 1200,
    bedrooms: 3, bathrooms: 2, parkingSpaces: 1, sqft: 960, furnished: 'unfurnished',
    amenities: ['Lift', '24h Security'],
    location: {
      address: 'Jalan Kajang Utama', city: 'Kajang',
      state: 'Selangor', postcode: '43000', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.7900, 2.9930] },
    },
  },

  // --- Land + commercial ------------------------------------------------
  {
    title: 'Development land in Bukit Jalil',
    description:
      'Freehold residential-zoned land, ~0.5 acre. Suitable for boutique condo development.',
    listingType: 'sale',
    propertyType: 'land',
    price: 5400000,
    bedrooms: 0, bathrooms: 0, parkingSpaces: 0, sqft: 21780, furnished: 'unfurnished',
    amenities: [],
    location: {
      address: 'Jalan Hartamas, Bukit Jalil', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '57000', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6618, 3.0568] },
    },
  },
  {
    title: 'Retail unit in Sunway Pyramid vicinity',
    description:
      'Ground-floor commercial unit with glass frontage. Suitable for cafe or services.',
    listingType: 'rent',
    propertyType: 'commercial',
    monthlyRent: 8500,
    bedrooms: 0, bathrooms: 1, parkingSpaces: 0, sqft: 1100, furnished: 'partially',
    amenities: ['24h Security', 'Lift'],
    location: {
      address: 'Persiaran Lagoon, Sunway', city: 'Subang Jaya',
      state: 'Selangor', postcode: '47500', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6058, 3.0742] },
    },
  },

  // --- Coastal Selangor ------------------------------------------------
  {
    title: 'Beach-side bungalow in Bagan Lalang',
    description:
      'Single-storey bungalow within walking distance of the beach. Great weekend escape.',
    listingType: 'sale',
    propertyType: 'bungalow',
    price: 1450000,
    bedrooms: 4, bathrooms: 3, parkingSpaces: 4, sqft: 2800, furnished: 'partially',
    amenities: ['Garden', 'Pet Friendly'],
    location: {
      address: 'Jalan Bagan Lalang', city: 'Sepang',
      state: 'Selangor', postcode: '43950', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.7000, 2.6075] },
    },
  },

  // --- Same-building demo: 4 units at "The Establishment, Bangsar South" ----
  // All four share the exact same lat/lng so the map collapses them into a
  // single "From RM 2,800/mo (4)" multi-unit pin. Hover to preview, click to
  // open the multi-unit card listing every unit in the building.
  {
    title: 'The Establishment — Studio',
    description: 'Smart studio in the lifestyle tower. Pool deck, co-working, gym.',
    listingType: 'rent', propertyType: 'serviced_residence',
    monthlyRent: 2800,
    bedrooms: 1, bathrooms: 1, parkingSpaces: 1, sqft: 540, furnished: 'fully',
    amenities: ['Pool', 'Gym', 'Co-working Lounge', 'Lift'],
    location: {
      address: 'The Establishment, Jalan Kerinchi', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '59200', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6692, 3.1117] },
    },
  },
  {
    title: 'The Establishment — 1-bed corner unit',
    description: 'Corner 1-bed with full-height windows facing the park.',
    listingType: 'rent', propertyType: 'serviced_residence',
    monthlyRent: 3200,
    bedrooms: 1, bathrooms: 1, parkingSpaces: 1, sqft: 720, furnished: 'fully',
    amenities: ['Pool', 'Gym', 'Lift'],
    location: {
      address: 'The Establishment, Jalan Kerinchi', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '59200', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6692, 3.1117] },
    },
  },
  {
    title: 'The Establishment — 2-bed family unit',
    description: 'Spacious 2-bed with study nook. Two car parks.',
    listingType: 'rent', propertyType: 'serviced_residence',
    monthlyRent: 4200,
    bedrooms: 2, bathrooms: 2, parkingSpaces: 2, sqft: 1080, furnished: 'partially',
    amenities: ['Pool', 'Gym', 'Lift', '24h Security'],
    location: {
      address: 'The Establishment, Jalan Kerinchi', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '59200', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6692, 3.1117] },
    },
  },
  {
    title: 'The Establishment — 3-bed sky suite',
    description: 'High-floor 3-bed with panoramic city view. Premium finishes.',
    listingType: 'rent', propertyType: 'serviced_residence',
    monthlyRent: 6500,
    bedrooms: 3, bathrooms: 3, parkingSpaces: 2, sqft: 1620, furnished: 'fully',
    amenities: ['Pool', 'Gym', 'Lift', '24h Security', 'Sauna'],
    location: {
      address: 'The Establishment, Jalan Kerinchi', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '59200', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6692, 3.1117] },
    },
  },

  // --- Same-building demo #2: 3 units in a Mont Kiara condo for sale -------
  {
    title: '11 Mont Kiara — 3-bed unit',
    description: 'Move-in 3-bed with renovated kitchen. Two parking bays.',
    listingType: 'sale', propertyType: 'condo',
    price: 1680000,
    bedrooms: 3, bathrooms: 2, parkingSpaces: 2, sqft: 1650, furnished: 'partially',
    amenities: ['Pool', 'Gym', 'Tennis Court'],
    location: {
      address: '11 Mont Kiara, Jalan Kiara', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '50480', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6571, 3.1718] },
    },
  },
  {
    title: '11 Mont Kiara — 4-bed dual-key',
    description: 'Dual-key 4-bed configuration. Great for multi-generation living.',
    listingType: 'sale', propertyType: 'condo',
    price: 2950000,
    bedrooms: 4, bathrooms: 4, parkingSpaces: 3, sqft: 2480, furnished: 'partially',
    amenities: ['Pool', 'Gym', '24h Security', 'Tennis Court'],
    location: {
      address: '11 Mont Kiara, Jalan Kiara', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '50480', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6571, 3.1718] },
    },
  },
  {
    title: '11 Mont Kiara — 5-bed penthouse',
    description: 'Top-floor penthouse with private rooftop. Imported finishes.',
    listingType: 'sale', propertyType: 'condo',
    price: 5400000,
    bedrooms: 5, bathrooms: 5, parkingSpaces: 4, sqft: 4200, furnished: 'fully',
    amenities: ['Pool', 'Gym', 'Sauna', '24h Security', 'Tennis Court'],
    location: {
      address: '11 Mont Kiara, Jalan Kiara', city: 'Kuala Lumpur',
      state: 'Wilayah Persekutuan', postcode: '50480', country: 'Malaysia',
      geo: { type: 'Point', coordinates: [101.6571, 3.1718] },
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
  const force = process.argv.includes('--force')
  if (existing === 0 || force) {
    if (force && existing > 0) {
      await Listing.deleteMany({ owner: demoOwner._id })
      console.log(`Cleared ${existing} existing demo listings`)
    }
    await Listing.insertMany(
      SAMPLE_LISTINGS.map((l, idx) => ({
        ...l,
        images: imagesFor(idx, 3),
        owner: demoOwner._id,
        status: 'active',
        verification: { verified: true, verifiedAt: new Date(), verifiedBy: admin._id },
      })),
    )
    console.log(`Seeded ${SAMPLE_LISTINGS.length} sample listings`)
  } else {
    console.log(`Demo owner already has ${existing} listings; skipping (pass --force to reseed)`)
  }

  await mongoose.disconnect()
  console.log('Done')
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
