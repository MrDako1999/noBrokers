import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, Plus, Heart, LayoutDashboard, LogOut, Menu, Sun, Moon, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import BrandLogo from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import useAuthStore from '@/stores/authStore';
import useThemeStore from '@/stores/themeStore';
import { cn } from '@/lib/utils';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuthStore();
  const { resolvedTheme, setTheme } = useThemeStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const onLogout = () => {
    logout();
    navigate('/');
  };

  const navLinkClass = ({ isActive }) =>
    cn(
      'text-sm font-medium transition-colors hover:text-primary',
      isActive ? 'text-primary' : 'text-foreground/80',
    );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-sectionBorder bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center">
            <BrandLogo />
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <NavLink to="/buy" className={navLinkClass}>
              Buy
            </NavLink>
            <NavLink to="/rent" className={navLinkClass}>
              Rent
            </NavLink>
            <NavLink to="/about" className={navLinkClass}>
              About
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
            <Link to="/buy">
              <Search className="h-4 w-4 mr-1.5" />
              Search
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          >
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {user ? (
            <>
              <Button asChild variant="default" size="sm" className="hidden md:inline-flex">
                <Link to="/dashboard/listings/new">
                  <Plus className="h-4 w-4 mr-1.5" />
                  List property
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 font-semibold">
                    {user.name?.[0]?.toUpperCase() || 'U'}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
                  <div className="px-2 pb-2 text-xs text-muted-foreground">{user.email}</div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate('/dashboard')}>
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/dashboard/watchlist')}>
                    <Heart className="h-4 w-4" />
                    Watchlist
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/dashboard/listings/new')}>
                    <Plus className="h-4 w-4" />
                    List a property
                  </DropdownMenuItem>
                  {isAdmin() && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => navigate('/admin')}>
                        <ShieldCheck className="h-4 w-4" />
                        Admin
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onLogout}>
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild variant="default" size="sm">
                <Link to="/register">Get started</Link>
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="md:hidden border-t border-sectionBorder bg-background">
          <div className="px-4 py-3 flex flex-col gap-1">
            <Link to="/buy" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent">
              Buy
            </Link>
            <Link to="/rent" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent">
              Rent
            </Link>
            <Link to="/about" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent">
              About
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
