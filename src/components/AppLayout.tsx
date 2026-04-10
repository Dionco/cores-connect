import React, { useMemo, useState } from 'react';
import { CalendarDays, PanelLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { CoresSidebar } from '@/components/CoresSidebar';
import NotificationCenter from '@/components/NotificationCenter';
import { PortalBackgroundLayer } from '@/components/layout/PortalBackgroundLayer';
import { PortalMainContent } from '@/components/layout/PortalMainContent';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { language, setLanguage } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const todayLabel = useMemo(() => {
    const locale = language === 'nl' ? 'nl-NL' : 'en-GB';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date());
  }, [language]);

  const header = (
    <div className="flex items-center justify-between gap-3 px-1 py-1">
      <div className="flex items-center gap-2.5">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white/75 text-foreground shadow-sm transition-colors hover:bg-white md:hidden"
              aria-label="Open sidebar navigation"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[280px] max-w-none border-r-0 bg-transparent p-0 shadow-none sm:max-w-none"
          >
            <CoresSidebar className="h-full w-full border-r-0" onNavigate={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          className="hidden items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-foreground/90 transition-colors hover:bg-white/30 hover:text-foreground sm:inline-flex"
          aria-label={todayLabel}
          title={todayLabel}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {todayLabel}
        </button>

        <NotificationCenter />

        <div className="ml-1 flex items-center rounded-xl bg-white/30 p-0.5 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={cn(
              'rounded-md px-2 py-1 text-[11px] font-semibold transition-colors',
              language === 'en' ? 'bg-white text-cores-navy' : 'text-foreground/85 hover:bg-white/30 hover:text-foreground',
            )}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage('nl')}
            className={cn(
              'rounded-md px-2 py-1 text-[11px] font-semibold transition-colors',
              language === 'nl' ? 'bg-white text-cores-navy' : 'text-foreground/85 hover:bg-white/30 hover:text-foreground',
            )}
          >
            NL
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <PortalBackgroundLayer>
      <CoresSidebar className="hidden md:flex md:h-screen" />
      <div className="min-w-0 flex h-full min-h-0 flex-1 flex-col overflow-hidden py-2 pr-2 pl-0 sm:py-3 sm:pr-3 sm:pl-0 lg:py-4 lg:pr-4 lg:pl-0">
        {header}

        <PortalMainContent className="flex-1 p-0 pt-1" contentClassName="h-full">
          {children}
        </PortalMainContent>
      </div>
    </PortalBackgroundLayer>
  );
};

export default AppLayout;
