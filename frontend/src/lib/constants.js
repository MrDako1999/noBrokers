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

// Labels for viewing lifecycle states. Keep values in sync with the enum
// on backend/src/models/Viewing.js.
export const VIEWING_STATUS_LABELS = {
  requested: 'Requested',
  accepted: 'Accepted',
  declined: 'Declined',
  counter_proposed: 'Counter proposed',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show: 'No show',
  expired: 'Expired',
};

// Maps status -> Badge variant name so the inbox/detail views render a
// consistent color language.
export const VIEWING_STATUS_VARIANTS = {
  requested: 'warning',
  accepted: 'success',
  declined: 'destructive',
  counter_proposed: 'info',
  cancelled: 'outline',
  completed: 'info',
  no_show: 'destructive',
  expired: 'outline',
};

export const WEEKDAY_LABELS = [
  { value: 0, short: 'Sun', long: 'Sunday' },
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
];

// Common IANA zones surfaced in the availability editor. Covers the primary
// markets noBrokers serves today plus a generic UTC fallback.
export const SUPPORTED_TIMEZONES = [
  { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur (UTC+8)' },
  { value: 'Asia/Singapore', label: 'Singapore (UTC+8)' },
  { value: 'Asia/Jakarta', label: 'Jakarta (UTC+7)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (UTC+7)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
  { value: 'Australia/Sydney', label: 'Sydney (UTC+10/+11)' },
  { value: 'UTC', label: 'UTC' },
];

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
