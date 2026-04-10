import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PortalBackgroundLayerProps {
  children: ReactNode;
  className?: string;
}

export function PortalBackgroundLayer({ children, className }: PortalBackgroundLayerProps) {
  return (
    <div
      className={cn(
        'relative h-screen w-full overflow-hidden bg-[linear-gradient(120deg,#8be9e8_0%,#8ce7b0_55%,#b3f1ca_100%)] text-foreground',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-white/35 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-5rem] left-[-4rem] h-80 w-80 rounded-full bg-emerald-200/50 blur-3xl"
      />

      <div className="relative z-10 flex h-full w-full overflow-hidden">{children}</div>
    </div>
  );
}