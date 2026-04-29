import { Link } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';

export default function Footer() {
  return (
    <footer className="border-t border-sectionBorder bg-background mt-16">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <BrandLogo />
            <p className="mt-3 text-sm text-muted-foreground max-w-xs">
              Owner-direct real estate. List, browse, offer and rent without
              commission-hungry agents in the middle.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Browse</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/buy" className="hover:text-primary">Properties for sale</Link></li>
              <li><Link to="/rent" className="hover:text-primary">Properties for rent</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Owners</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/dashboard/listings/new" className="hover:text-primary">List a property</Link></li>
              <li><Link to="/dashboard" className="hover:text-primary">Owner dashboard</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/about" className="hover:text-primary">About</Link></li>
              <li><Link to="/privacy" className="hover:text-primary">Privacy</Link></li>
              <li><Link to="/terms" className="hover:text-primary">Terms</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-sectionBorder flex flex-col md:flex-row md:items-center justify-between text-xs text-muted-foreground gap-2">
          <span>&copy; {new Date().getFullYear()} noBrokers.my — All rights reserved.</span>
          <span>Made in Malaysia.</span>
        </div>
      </div>
    </footer>
  );
}
