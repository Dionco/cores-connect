import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PortalMainContentProps {
  children: ReactNode;
  header?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function PortalMainContent({
  children,
  header,
  className,
  contentClassName,
}: PortalMainContentProps) {
  return (
    <section className={cn('min-w-0 min-h-0 flex-1 p-1 pl-0 sm:p-1 sm:pl-0 lg:p-2 lg:pl-0', className)}>
      <main
        className={cn(
          'flex h-full min-h-0 flex-col overflow-y-auto rounded-[26px] border border-white/60 border-l-0 bg-white/70 shadow-[20px_30px_60px_-34px_rgba(15,23,42,0.45)] backdrop-blur-xl',
          contentClassName,
        )}
      >
        {header ? <div className="border-b border-border/70 px-4 py-3 sm:px-5">{header}</div> : null}
        <div className="flex-1 p-4 sm:p-5 lg:p-6">{children}</div>
      </main>
    </section>
  );
}