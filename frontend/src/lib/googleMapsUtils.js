import { useJsApiLoader } from '@react-google-maps/api';

// Google Maps helpers shared across PlacesSearchInput + AddressAutocomplete +
// the browse map. Centred on Kuala Lumpur because noBrokers is Malaysia-only.

export const MY_CENTER = { lat: 3.139, lng: 101.6869 };

// One canonical libraries array for the whole app. Different `libraries`
// arrays cause `useJsApiLoader` to log a "loaded with different libraries"
// warning and re-load the script, so every consumer must import this constant.
export const MAPS_LIBRARIES = ['places', 'drawing'];

// Shared script loader. Wraps useJsApiLoader so callers can't accidentally
// pass a different api key or library set.
export function useGoogleMaps() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey || '',
    libraries: MAPS_LIBRARIES,
  });
  return { isLoaded, loadError, apiKey };
}

export const COORD_RE = /^\s*(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)\s*$/;

// noBrokers' Listing.location schema (kept identical to backend/src/models/Listing.js).
export const EMPTY_ADDRESS = {
  address: '',
  city: '',
  state: '',
  postcode: '',
  country: 'Malaysia',
  formattedAddress: '',
  placeId: '',
  lat: null,
  lng: null,
};

export function parseCoordinates(text) {
  const m = text.match(COORD_RE);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

// Pull structured address fields out of a Google PlaceResult / GeocoderResult.
// Uses several fallbacks so even sparse rural results yield something usable.
export function extractAddressComponents(place, placeName) {
  const components = place.address_components || [];
  const get = (type) =>
    components.find((c) => c.types.includes(type))?.long_name || '';

  const streetNumber = get('street_number');
  const route = get('route');
  const structuredStreet = [streetNumber, route].filter(Boolean).join(' ');

  const plusCode = place.plus_code?.compound_code || place.plus_code?.global_code || '';
  const formattedAddress = place.formatted_address || '';
  const formattedFirstPart = formattedAddress.split(',')[0]?.trim() || '';

  const street =
    structuredStreet ||
    get('premise') ||
    get('subpremise') ||
    placeName ||
    get('neighborhood') ||
    get('sublocality') ||
    get('sublocality_level_1') ||
    plusCode ||
    formattedFirstPart ||
    '';

  const city =
    get('locality') ||
    get('administrative_area_level_2') ||
    get('sublocality_level_1') ||
    get('sublocality') ||
    get('neighborhood') ||
    '';

  return {
    address: street,
    city,
    state: get('administrative_area_level_1'),
    postcode: get('postal_code'),
    country: get('country') || 'Malaysia',
    formattedAddress,
    placeId: place.place_id || '',
  };
}

// Hide Google's default `.pac-container` autocomplete dropdown so our own
// styled dropdown in PlacesSearchInput is the only one the user sees.
export function ensurePacHidden() {
  const id = 'pac-container-hide';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = '.pac-container { display: none !important; }';
  document.head.appendChild(style);
}
