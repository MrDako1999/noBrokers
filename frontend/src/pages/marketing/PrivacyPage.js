import { useEffect } from 'react';

export default function PrivacyPage() {
  useEffect(() => {
    document.title = 'Privacy Policy — noBrokers.my';
  }, []);

  return (
    <article className="mx-auto max-w-3xl px-4 md:px-6 py-12 md:py-16 prose prose-neutral dark:prose-invert">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Legal</span>
      <h1 className="mt-2 text-3xl md:text-4xl font-heading font-bold tracking-tight !mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground !mt-1">Last updated: 29 April 2026</p>

      <h2 className="!mt-10">1. Who we are</h2>
      <p>
        noBrokers.my (&quot;noBrokers&quot;, &quot;we&quot;, &quot;us&quot;) operates an owner-direct real estate
        platform serving Malaysia. We are reachable at <strong>privacy@nobrokers.my</strong>.
      </p>

      <h2>2. Information we collect</h2>
      <ul>
        <li><strong>Account data</strong> — name, email, phone, password (hashed).</li>
        <li><strong>KYC data</strong> — the identity documents you submit for verification.</li>
        <li><strong>Listing data</strong> — property details, photos, ownership documents.</li>
        <li><strong>Activity</strong> — listings you view, watchlist additions, offers you make.</li>
      </ul>

      <h2>3. How we use it</h2>
      <ul>
        <li>To verify owners and KYC-check buyers and tenants.</li>
        <li>To match you with relevant listings and counterparties.</li>
        <li>To enforce our Terms of Service and prevent fraud.</li>
        <li>To send transactional emails (offers, replies, reset links).</li>
      </ul>

      <h2>4. Where it lives</h2>
      <p>
        Account data and listing data are stored in MongoDB Atlas. Images and documents are stored on
        Cloudflare R2. We never sell your data to third parties.
      </p>

      <h2>5. Your rights</h2>
      <p>
        Under Malaysia&apos;s PDPA 2010, you can request access to, correction of, or deletion of your
        personal data at any time by emailing <strong>privacy@nobrokers.my</strong>. Account deletion
        removes your KYC docs from R2 within 30 days.
      </p>

      <h2>6. Changes</h2>
      <p>
        We may revise this policy from time to time. The &quot;Last updated&quot; date above always reflects the
        current version.
      </p>
    </article>
  );
}
