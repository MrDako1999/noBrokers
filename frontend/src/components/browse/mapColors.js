// Brand teal palette pulled out of frontend/src/index.css so SVG `data:` URLs
// (which can't read CSS variables) and other one-off `style={{ ... }}` props
// have a single source of truth. HTML/JSX should keep using Tailwind utility
// classes (`bg-primary`, `text-primary-foreground`, etc.); only reach for
// these constants when you can't.
//
// Source: --primary = HSL(188, 75%, 28%) -> #0d6970
export const BRAND_TEAL = '#0d6970';
export const BRAND_TEAL_DARK = '#0a4f55';
export const BRAND_TEAL_TINT_BG = 'rgba(13, 105, 112, 0.18)'; // soft outer ring
