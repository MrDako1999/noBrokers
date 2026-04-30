import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, MapPin, AlertTriangle, Expand } from 'lucide-react';
import PlacesSearchInput from '@/components/PlacesSearchInput';
import {
  MY_CENTER,
  EMPTY_ADDRESS,
  extractAddressComponents,
  ensurePacHidden,
  useGoogleMaps,
} from '@/lib/googleMapsUtils';
import { MY_STATES } from '@/lib/constants';

const inlineMapStyle = {
  width: '100%',
  height: '220px',
  borderRadius: '0.75rem',
};

const expandedMapStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '0.75rem',
};

// Google often returns "Kuala Lumpur" / "Putrajaya" / "Penang" / "Malacca"
// as the administrative_area_level_1. Map those onto the MY_STATES values
// the rest of the app filters on so the Select can prefill correctly.
const STATE_ALIASES = {
  'kuala lumpur': 'Wilayah Persekutuan',
  putrajaya: 'Wilayah Persekutuan',
  labuan: 'Wilayah Persekutuan',
  'federal territory of kuala lumpur': 'Wilayah Persekutuan',
  'federal territory of putrajaya': 'Wilayah Persekutuan',
  'federal territory of labuan': 'Wilayah Persekutuan',
  penang: 'Pulau Pinang',
  malacca: 'Melaka',
};

function normalizeState(raw) {
  if (!raw) return '';
  const lower = raw.toLowerCase().trim();
  if (STATE_ALIASES[lower]) return STATE_ALIASES[lower];
  const exact = MY_STATES.find((s) => s.toLowerCase() === lower);
  if (exact) return exact;
  // Some Google results are like "Selangor, Malaysia" — try the first chunk.
  const first = lower.split(',')[0].trim();
  const fuzzy = MY_STATES.find((s) => s.toLowerCase() === first);
  return fuzzy || '';
}

// Convert the structured address Google gives us into noBrokers' location shape.
function toLocation(parsed, lat, lng) {
  return {
    address: parsed.address || '',
    city: parsed.city || '',
    state: normalizeState(parsed.state),
    postcode: parsed.postcode || '',
    country: parsed.country || 'Malaysia',
    formattedAddress: parsed.formattedAddress || '',
    placeId: parsed.placeId || '',
    lat: lat ?? null,
    lng: lng ?? null,
  };
}

function useReverseGeocoder(onChange) {
  const geocoderRef = useRef(null);

  const ensureGeocoder = useCallback(() => {
    if (!geocoderRef.current) {
      geocoderRef.current = new window.google.maps.Geocoder();
    }
    return geocoderRef.current;
  }, []);

  return useCallback(
    (position) => {
      const geocoder = ensureGeocoder();
      geocoder.geocode({ location: position }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const result = results[0];
          const placeName =
            result.plus_code?.compound_code ||
            result.formatted_address?.split(',')[0]?.trim() ||
            '';
          const parsed = extractAddressComponents(result, placeName);
          onChange(toLocation(parsed, position.lat, position.lng));
        } else {
          onChange({
            ...EMPTY_ADDRESS,
            lat: position.lat,
            lng: position.lng,
            formattedAddress: `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`,
          });
        }
      });
    },
    [ensureGeocoder, onChange],
  );
}

function AddressMap({ lat, lng, onChange, containerStyle, expandButton }) {
  const [map, setMap] = useState(null);
  const reverseGeocode = useReverseGeocoder(onChange);

  const center = lat != null && lng != null ? { lat, lng } : MY_CENTER;
  const hasPin = lat != null && lng != null;

  useEffect(() => {
    if (map && lat != null && lng != null) {
      map.panTo({ lat, lng });
    }
  }, [map, lat, lng]);

  const handleLoad = useCallback((m) => {
    setMap(m);
  }, []);

  const handleMapClick = useCallback(
    (e) => {
      reverseGeocode({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    },
    [reverseGeocode],
  );

  const handleMarkerDragEnd = useCallback(
    (e) => {
      reverseGeocode({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    },
    [reverseGeocode],
  );

  return (
    <div className="relative h-full overflow-hidden rounded-xl">
      {expandButton}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={hasPin ? 16 : 11}
        onLoad={handleLoad}
        onClick={handleMapClick}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        {hasPin && (
          <MarkerF
            position={{ lat, lng }}
            draggable
            onDragEnd={handleMarkerDragEnd}
          />
        )}
      </GoogleMap>
    </div>
  );
}

function ExpandedAddressMap({
  lat,
  lng,
  onChange,
  onPlaceSelect,
  onCoordsSelect,
  searchValue,
  onSearchChange,
}) {
  return (
    <div className="flex h-full flex-col gap-3">
      <PlacesSearchInput
        value={searchValue}
        onValueChange={onSearchChange}
        onSelect={onPlaceSelect}
        onCoordsSelect={onCoordsSelect}
        placeholder="Search address, neighbourhood, or paste lat,lng"
        searchTypes={['establishment', 'geocode']}
      />
      <div className="min-h-0 flex-1">
        <AddressMap
          lat={lat}
          lng={lng}
          onChange={onChange}
          containerStyle={expandedMapStyle}
        />
      </div>
      {lat != null && lng != null && (
        <div className="flex shrink-0 items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {lat.toFixed(6)}, {lng.toFixed(6)}
          </p>
        </div>
      )}
    </div>
  );
}

// Drop-in replacement for the manual address fields on the listing form.
// `value` is the parent's `form.location` object (noBrokers schema).
// `onChange` receives a complete location object and the parent should merge it.
export default function AddressAutocomplete({ value, onChange, disabled }) {
  const [searchValue, setSearchValue] = useState('');
  const [expanded, setExpanded] = useState(false);

  const { isLoaded, loadError, apiKey } = useGoogleMaps();

  const addr = value || EMPTY_ADDRESS;

  useEffect(() => {
    ensurePacHidden();
  }, []);

  useEffect(() => {
    if (addr.formattedAddress && !searchValue) {
      setSearchValue(addr.formattedAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr.formattedAddress]);

  // Merge a partial patch back into the location and propagate up.
  const patch = useCallback(
    (next) => {
      onChange({ ...addr, ...next });
    },
    [addr, onChange],
  );

  const handlePlaceSelect = useCallback(
    ({ lat, lng, placeName, address }) => {
      const hasFields = address.address || address.city || address.country;
      if (!hasFields && lat != null && lng != null && window.google?.maps?.Geocoder) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === 'OK' && results?.[0]) {
            const rich = extractAddressComponents(results[0], placeName);
            const loc = toLocation(rich, lat, lng);
            setSearchValue(loc.formattedAddress || address.formattedAddress);
            patch(loc);
          } else {
            const loc = toLocation(address, lat, lng);
            setSearchValue(loc.formattedAddress);
            patch(loc);
          }
        });
      } else {
        const loc = toLocation(address, lat, lng);
        setSearchValue(loc.formattedAddress);
        patch(loc);
      }
    },
    [patch],
  );

  const handleCoordsSelect = useCallback(
    (coords) => {
      if (!window.google?.maps?.Geocoder) {
        patch({ ...EMPTY_ADDRESS, lat: coords.lat, lng: coords.lng });
        return;
      }
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: coords }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const parsed = extractAddressComponents(results[0]);
          const loc = toLocation(parsed, coords.lat, coords.lng);
          setSearchValue(loc.formattedAddress);
          patch(loc);
        } else {
          patch({ ...EMPTY_ADDRESS, lat: coords.lat, lng: coords.lng });
        }
      });
    },
    [patch],
  );

  const handleMapChange = useCallback(
    (next) => {
      setSearchValue(
        next.formattedAddress || `${next.lat?.toFixed(6)}, ${next.lng?.toFixed(6)}`,
      );
      patch(next);
    },
    [patch],
  );

  const handleFieldChange = useCallback(
    (field, val) => {
      patch({ [field]: val });
    },
    [patch],
  );

  const hasAddress = addr.address || addr.city || addr.state;

  if (!apiKey) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border-2 border-dashed border-sectionBorder p-4 text-center">
          <MapPin className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Google Maps API key not configured — enter the address manually.
          </p>
        </div>
        <AddressFields addr={addr} onChange={handleFieldChange} disabled={disabled} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">Failed to load Google Maps.</p>
        <AddressFields addr={addr} onChange={handleFieldChange} disabled={disabled} />
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-sectionBorder p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading map…</span>
      </div>
    );
  }

  const expandBtn = (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      className="absolute right-2 top-2 z-10 h-8 w-8 shadow-md"
      onClick={() => setExpanded(true)}
      title="Expand map"
    >
      <Expand className="h-4 w-4" />
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Search address</Label>
        <PlacesSearchInput
          value={searchValue}
          onValueChange={setSearchValue}
          onSelect={handlePlaceSelect}
          onCoordsSelect={handleCoordsSelect}
          disabled={disabled}
          placeholder="e.g. Mont Kiara, KL — or paste 3.1390, 101.6869"
          searchTypes={['establishment', 'geocode']}
        />
        <p className="text-xs text-muted-foreground">
          Pick from suggestions, drop a pin on the map, or drag the marker to
          fine-tune the exact location.
        </p>
      </div>

      <AddressMap
        lat={addr.lat}
        lng={addr.lng}
        onChange={handleMapChange}
        containerStyle={inlineMapStyle}
        expandButton={expandBtn}
      />

      {addr.lat != null && addr.lng != null && (
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {addr.lat.toFixed(6)}, {addr.lng.toFixed(6)}
          </p>
        </div>
      )}

      <AddressFields addr={addr} onChange={handleFieldChange} disabled={disabled} />

      {!hasAddress && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-bg px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs leading-relaxed text-warning">
            Add at least the city and state — buyers filter by location, so a
            listing with no address won&apos;t show up in browse.
          </p>
        </div>
      )}

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] w-full max-w-[calc(100vw-2rem)] flex-col p-4 sm:p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle>Pinpoint the property</DialogTitle>
            <DialogDescription>
              Search, click the map, or drag the marker to set the exact location.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            <ExpandedAddressMap
              lat={addr.lat}
              lng={addr.lng}
              onChange={handleMapChange}
              onPlaceSelect={handlePlaceSelect}
              onCoordsSelect={handleCoordsSelect}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddressFields({ addr, onChange, disabled }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="loc-address">Street address</Label>
        <Input
          id="loc-address"
          value={addr.address || ''}
          onChange={(e) => onChange('address', e.target.value)}
          placeholder="e.g. Jalan Kiara 1, Mont Kiara"
          disabled={disabled}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="loc-city">City</Label>
          <Input
            id="loc-city"
            value={addr.city || ''}
            onChange={(e) => onChange('city', e.target.value)}
            placeholder="e.g. Kuala Lumpur"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>State</Label>
          <Select
            value={addr.state || ''}
            onValueChange={(v) => onChange('state', v)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {MY_STATES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loc-postcode">Postcode</Label>
          <Input
            id="loc-postcode"
            value={addr.postcode || ''}
            onChange={(e) => onChange('postcode', e.target.value)}
            placeholder="50480"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
