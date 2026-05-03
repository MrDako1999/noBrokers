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

// Documents accepted as proof of ownership when listing a property.
// Keep enum values in sync with `ownershipDocSchema` in backend/models/Listing.js.
export const OWNERSHIP_DOC_TYPES = [
  { value: 'title_deed', label: 'Title Deed' },
  { value: 'assessment_tax', label: 'Assessment tax receipt' },
  { value: 'land_tax', label: 'Land tax receipt' },
  { value: 'spa_front', label: 'SPA front cover' },
  { value: 'spa_schedule', label: 'SPA scheduled page' },
  { value: 'other', label: 'Other' },
];

export const OWNERSHIP_DOC_LABELS = OWNERSHIP_DOC_TYPES.reduce(
  (acc, t) => ({ ...acc, [t.value]: t.label }),
  // Legacy values kept for documents uploaded before the type list changed.
  {
    spa: 'SPA Document',
    utility_bill: 'Utility Bill',
    quit_rent: 'Quit Rent (Cukai Tanah)',
    strata: 'Strata Title',
  },
);

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
