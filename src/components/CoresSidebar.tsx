import { type ElementType } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  Zap,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import coresLogo from '@/assets/cores-logo.svg';

interface CoresSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

interface NavItem {
  key: string;
  path: string;
  icon: ElementType;
}

const navItems: NavItem[] = [
  { key: 'nav.dashboard', path: '/dashboard', icon: LayoutDashboard },
  { key: 'nav.employees', path: '/employees', icon: Users },
  { key: 'nav.onboarding', path: '/onboarding', icon: ClipboardCheck },
  { key: 'nav.absence', path: '/absence', icon: CalendarDays },
  { key: 'nav.provisioning', path: '/provisioning', icon: Zap },
  { key: 'nav.settings', path: '/settings', icon: Settings },
];

const navItemClass =
  'group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-cores-navy/90 transition-all duration-200 hover:bg-white/35 hover:text-cores-navy';
const navItemActiveClass = 'bg-white text-cores-navy shadow-[0_8px_24px_-14px_rgba(0,0,0,0.45)]';

const getInitials = (name?: string | null) => {
  if (!name) {
    return 'HR';
  }

  const parts = name
    .split(' ')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return 'HR';
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
};

const isItemActive = (pathname: string, itemPath: string) => {
  if (pathname === itemPath) {
    return true;
  }

  if (itemPath === '/dashboard') {
    return false;
  }

  return pathname.startsWith(`${itemPath}/`);
};

export function CoresSidebar({ className, onNavigate }: CoresSidebarProps) {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const initials = getInitials(user?.name);

  return (
    <aside
      className={cn(
        'flex h-full w-[252px] shrink-0 flex-col bg-transparent px-0 py-0 text-cores-navy',
        className,
      )}
    >
      <div className="mb-6 flex items-start pl-6 px-4 pt-6">
        <img src={coresLogo} alt="Cores" className="h-11 w-auto" />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-1.5">
        {navItems.map((item) => {
          const active = isItemActive(pathname, item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(navItemClass, active && navItemActiveClass)}
            >
              <item.icon className="h-[18px] w-[18px]" />
              <span>{t(item.key)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 px-1.5 pb-4 pt-6">
        <div className="flex items-center gap-3 rounded-xl border border-white/45 bg-white/35 p-3 backdrop-blur-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-xs font-semibold text-cores-navy">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-cores-navy">{user?.name ?? 'HR Admin'}</p>
            <p className="truncate text-[11px] text-cores-navy/75">{user?.email ?? 'admin@cores.nl'}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void logout();
          }}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-cores-navy/90 transition-colors hover:bg-white/35 hover:text-cores-navy"
        >
          <LogOut className="h-[18px] w-[18px]" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}