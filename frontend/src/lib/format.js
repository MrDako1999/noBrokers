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
