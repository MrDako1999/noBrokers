import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

// `/buy` and `/rent` use a full-viewport split-pane that already fills the
// space below the navbar — the marketing footer would force an extra scroll
// and break the sticky map column. Hide it on those routes.
const FULL_VIEWPORT_PATHS = ['/buy', '/rent'];

export default function MarketingLayout() {
  const { pathname } = useLocation();
  const isFullViewport = FULL_VIEWPORT_PATHS.includes(pathname);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className={isFullViewport ? 'flex-1 overflow-hidden' : 'flex-1'}>
        <Outlet />
      </main>
      {!isFullViewport && <Footer />}
    </div>
  );
}
