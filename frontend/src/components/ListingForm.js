import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import MultiImageUpload, { MultiDocumentUpload } from '@/components/MultiImageUpload';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import {
  PROPERTY_TYPES,
  FURNISHING_OPTIONS,
  COMMON_AMENITIES,
} from '@/lib/constants';
import { cn } from '@/lib/utils';

const OWNERSHIP_DOC_TYPES = [
  { value: 'title_deed', label: 'Title Deed (Geran)' },
  { value: 'spa', label: 'SPA Document' },
  { value: 'utility_bill', label: 'Utility Bill' },
  { value: 'quit_rent', label: 'Quit Rent (Cukai Tanah)' },
  { value: 'strata', label: 'Strata Title' },
  { value: 'other', label: 'Other' },
];

const empty = {
  title: '',
  description: '',
  listingType: 'sale',
  propertyType: 'condo',
  price: '',
  monthlyRent: '',
  bedrooms: '',
  bathrooms: '',
  parkingSpaces: '',
  sqft: '',
  furnished: 'unfurnished',
  amenities: [],
  images: [],
  ownershipDocuments: [],
  location: {
    address: '',
    city: '',
    state: '',
    postcode: '',
    country: 'Malaysia',
    formattedAddress: '',
    placeId: '',
    lat: null,
    lng: null,
  },
};

export default function ListingForm({ initial, onSubmit, submitting, mode = 'create' }) {
  const [form, setForm] = useState(() => ({ ...empty, ...initial, location: { ...empty.location, ...(initial?.location || {}) } }));

  const update = (patch) => setForm((p) => ({ ...p, ...patch }));

  const toggleAmenity = (a) => {
    setForm((p) =>
      p.amenities.includes(a)
        ? { ...p, amenities: p.amenities.filter((x) => x !== a) }
        : { ...p, amenities: [...p.amenities, a] },
    );
  };

  const isSale = form.listingType === 'sale';

  const submit = (publish) => (e) => {
    e?.preventDefault?.();
    const payload = {
      ...form,
      price: isSale ? Number(form.price) || 0 : undefined,
      monthlyRent: !isSale ? Number(form.monthlyRent) || 0 : undefined,
      bedrooms: Number(form.bedrooms) || 0,
      bathrooms: Number(form.bathrooms) || 0,
      parkingSpaces: Number(form.parkingSpaces) || 0,
      sqft: Number(form.sqft) || 0,
      location: {
        ...form.location,
        lat:
          form.location.lat === '' || form.location.lat == null
            ? undefined
            : Number(form.location.lat),
        lng:
          form.location.lng === '' || form.location.lng == null
            ? undefined
            : Number(form.location.lng),
      },
      publish: !!publish,
    };
    onSubmit(payload);
  };

  return (
    <form className="space-y-8" onSubmit={submit(true)}>
      <Section title="The basics">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Listing type">
            <Select value={form.listingType} onValueChange={(v) => update({ listingType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sale">For sale</SelectItem>
                <SelectItem value="rent">For rent</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Property type">
            <Select value={form.propertyType} onValueChange={(v) => update({ propertyType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Title">
          <Input
            placeholder="e.g. Modern 3-bed condo in Mont Kiara"
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            required
          />
        </Field>

        <Field label="Description">
          <Textarea
            placeholder="What makes this property special? Walkable to MRT? View? Recently refurbished?"
            rows={5}
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          {isSale ? (
            <Field label="Asking price (RM)">
              <Input
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => update({ price: e.target.value })}
                required
              />
            </Field>
          ) : (
            <Field label="Monthly rent (RM)">
              <Input
                type="number"
                min="0"
                value={form.monthlyRent}
                onChange={(e) => update({ monthlyRent: e.target.value })}
                required
              />
            </Field>
          )}
          <Field label="Built-up size (sqft)">
            <Input
              type="number"
              min="0"
              value={form.sqft}
              onChange={(e) => update({ sqft: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Bedrooms">
            <Input type="number" min="0" value={form.bedrooms} onChange={(e) => update({ bedrooms: e.target.value })} />
          </Field>
          <Field label="Bathrooms">
            <Input type="number" min="0" value={form.bathrooms} onChange={(e) => update({ bathrooms: e.target.value })} />
          </Field>
          <Field label="Parking">
            <Input type="number" min="0" value={form.parkingSpaces} onChange={(e) => update({ parkingSpaces: e.target.value })} />
          </Field>
          <Field label="Furnishing">
            <Select value={form.furnished} onValueChange={(v) => update({ furnished: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FURNISHING_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      <Section
        title="Location"
        subtitle="Search for the property on the map. The address fields fill in automatically — buyers can also search by radius around your pin."
      >
        <AddressAutocomplete
          value={form.location}
          onChange={(loc) => setForm((p) => ({ ...p, location: { ...p.location, ...loc } }))}
        />
      </Section>

      <Section title="Photos" subtitle="The first image is the cover. Drag-to-reorder coming soon.">
        <MultiImageUpload value={form.images} onChange={(images) => update({ images })} />
      </Section>

      <Section title="Amenities">
        <div className="flex flex-wrap gap-2">
          {COMMON_AMENITIES.map((a) => {
            const active = form.amenities.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggleAmenity(a)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs transition-colors',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-inputBorderIdle hover:border-inputBorderFocus',
                )}
              >
                {a}
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        title="Ownership documents"
        subtitle="Upload your title deed / SPA / utility bill so we can verify you really own this property. Your documents are private — only the admin sees them."
      >
        <MultiDocumentUpload
          value={form.ownershipDocuments}
          onChange={(ownershipDocuments) => update({ ownershipDocuments })}
          kind="ownership-doc"
          types={OWNERSHIP_DOC_TYPES}
        />
      </Section>

      <div className="sticky bottom-4 z-10 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end rounded-2xl border border-sectionBorder bg-card/95 backdrop-blur p-3 shadow-lg">
        <Button type="button" variant="outline" onClick={submit(false)} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
          Save as draft
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
          {mode === 'create' ? 'Submit for verification' : 'Save & resubmit'}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-sectionBorder bg-card p-5 md:p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold font-heading">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
