// Single source of truth for select options used across the listing form,
// browse filters, and admin panel. Keep enum values here in sync with the
// backend Listing model.

export const PROPERTY_TYPES = [
  { value: 'condo', label: 'Condominium' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'serviced_residence', label: 'Serviced Residence' },
  { value: 'terrace', label: 'Terrace' },
  { value: 'semi_detached', label: 'Semi-Detached' },
  { value: 'bungalow', label: 'Bungalow' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'land', label: 'Land' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'shop_office', label: 'Shop/Office' },
];

export const FURNISHING_OPTIONS = [
  { value: 'unfurnished', label: 'Unfurnished' },
  { value: 'partially', label: 'Partially Furnished' },
  { value: 'fully', label: 'Fully Furnished' },
];

export const LISTING_STATUS_LABELS = {
  draft: 'Draft',
  pending: 'Pending verification',
  active: 'Active',
  rejected: 'Rejected',
  sold: 'Sold',
  rented: 'Rented',
  archived: 'Archived',
};

export const KYC_STATUS_LABELS = {
  unverified: 'Not submitted',
  pending: 'Under review',
  verified: 'Verified',
  rejected: 'Rejected',
};

export const COMMON_AMENITIES = [
  'Pool',
  'Gym',
  'Playground',
  '24h Security',
  'Lift',
  'Covered Parking',
  'Tennis Court',
  'Sauna',
  'BBQ Area',
  'Co-working Lounge',
  'Garden',
  'Pet Friendly',
  'Storeroom',
  'Wi-Fi',
];

// Malaysian states for the location filter dropdown.
export const MY_STATES = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Perak',
  'Perlis',
  'Pulau Pinang',
  'Sabah',
  'Sarawak',
  'Selangor',
  'Terengganu',
  'Wilayah Persekutuan',
];
