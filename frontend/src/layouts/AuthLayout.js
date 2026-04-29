import { Outlet, Link } from 'react-router-dom';
import { Sun, Moon, ArrowLeft } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import useThemeStore from '@/stores/themeStore';

export default function AuthLayout() {
  const { resolvedTheme, setTheme } = useThemeStore();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex items-center justify-between p-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to home
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
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <BrandLogo />
            </div>
            <p className="text-sm text-muted-foreground">
              Owner-direct real estate. No agents. No middlemen.
            </p>
          </div>
          <Outlet />
        </div>
      </div>

      <footer className="py-4 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} noBrokers.my
      </footer>
    </div>
  );
}
