// Centralised formatters so number/date/currency displays stay consistent
// across the listing card, detail page, and dashboards.

const myr = new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
  maximumFractionDigits: 0,
});

const compact = new Intl.NumberFormat('en-MY', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatPrice(amount, currency = 'MYR') {
  if (amount == null) return '—';
  if (currency !== 'MYR') {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return myr.format(amount);
}

export function formatPriceCompact(amount) {
  if (amount == null) return '—';
  if (amount >= 1000) return `RM${compact.format(amount)}`;
  return `RM${amount}`;
}

export function formatRent(amount) {
  if (amount == null) return '—';
  return `${formatPrice(amount)}/mo`;
}

// Shortened forms used on map markers where space is at a premium.
// 580_000 -> "RM 580k", 1_250_000 -> "RM 1.25M".
export function formatPriceShort(amount) {
  if (amount == null) return '—';
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000;
    return `RM ${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2).replace(/\.?0+$/, '')}M`;
  }
  if (amount >= 1_000) {
    const k = amount / 1_000;
    return `RM ${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `RM ${amount}`;
}

export function formatRentShort(amount) {
  if (amount == null) return '—';
  return `${formatPriceShort(amount)}/mo`;
}

export function formatPsf(price, sqft) {
  if (!price || !sqft) return null;
  return `RM${(price / sqft).toFixed(0)}/sqft`;
}

export function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format a date in a specific IANA timezone. Used on the viewing timeline
// where we want to show "Mon, May 4, 2:00pm (Asia/Kuala_Lumpur)" so both
// parties see the same intent even if their devices live in different zones.
export function formatInZone(d, tz) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-MY', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz || undefined,
    });
  } catch {
    return formatDateTime(d);
  }
}

// Convert "630" (minutes since midnight) -> "10:30".
export function formatMinuteOfDay(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Parse "10:30" -> 630. Returns null for invalid input.
export function parseMinuteOfDay(str) {
  if (!str) return null;
  const [h, m] = String(str).split(':').map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 24 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function timeAgo(d) {
  if (!d) return '';
  const seconds = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
