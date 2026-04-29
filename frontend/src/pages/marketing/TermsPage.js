import { useEffect } from 'react';

export default function TermsPage() {
  useEffect(() => {
    document.title = 'Terms of Service — noBrokers.my';
  }, []);

  return (
    <article className="mx-auto max-w-3xl px-4 md:px-6 py-12 md:py-16 prose prose-neutral dark:prose-invert">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Legal</span>
      <h1 className="mt-2 text-3xl md:text-4xl font-heading font-bold tracking-tight !mb-2">Terms of Service</h1>
      <p className="text-muted-foreground !mt-1">Last updated: 29 April 2026</p>

      <h2 className="!mt-10">1. Acceptance</h2>
      <p>
        By creating an account or using noBrokers.my, you agree to these Terms and our Privacy Policy.
        If you do not agree, please do not use the platform.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 18 years old and legally capable of entering into binding contracts under
        Malaysian law. Owners listing a property must be the legal owner or be authorised in writing
        by the legal owner.
      </p>

      <h2>3. Listings</h2>
      <p>
        Owners are responsible for the accuracy of every listing. False listings, misrepresentation of
        ownership, or duplicate listings are grounds for immediate removal and account suspension.
      </p>

      <h2>4. Offers</h2>
      <p>
        Offers made on noBrokers.my are good-faith expressions of interest. They become legally binding
        only when both parties sign the offer-to-purchase or tenancy agreement separately. noBrokers
        is not a party to any property transaction.
      </p>

      <h2>5. Fees</h2>
      <p>
        Browsing, listing and making offers are free during the MVP period. Premium add-ons (featured
        placement, document automation, priority verification) may be introduced later with clear pricing.
      </p>

      <h2>6. Prohibited use</h2>
      <ul>
        <li>Listing properties you do not own and have not been authorised to list.</li>
        <li>Posting fraudulent, misleading, or duplicated listings.</li>
        <li>Soliciting users off-platform to circumvent verification.</li>
        <li>Scraping or republishing listings without permission.</li>
      </ul>

      <h2>7. Liability</h2>
      <p>
        noBrokers facilitates contact and document handling. We make no warranty about the suitability,
        legality or condition of any property. We are not liable for any loss arising out of any
        property transaction concluded between users.
      </p>

      <h2>8. Termination</h2>
      <p>
        We may suspend or terminate accounts that violate these Terms. You may delete your account at
        any time from your dashboard.
      </p>

      <h2>9. Governing law</h2>
      <p>These Terms are governed by the laws of Malaysia.</p>
    </article>
  );
}
