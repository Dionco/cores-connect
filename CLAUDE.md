# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install          # Install dependencies
bun run dev          # Start dev server (port 8080)
bun run build        # Production build
bun run lint         # ESLint
bun run test         # Run tests once (Vitest)
bun run test:watch   # Run tests in watch mode
```

## Environment Setup

Copy `.env.example` to `.env` and fill in:
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` — if omitted, the app falls back to mock auth mode automatically

## Architecture

**Provider stack (App.tsx):** `QueryClientProvider → LanguageProvider → AuthProvider → TooltipProvider → Router`

**Auth (src/contexts/AuthContext.tsx):** Dual-mode — Supabase real auth (email/password + Azure SSO) when env vars are set, otherwise falls back to mock user `{ name: 'HR Admin', email: 'admin@cores.nl' }`. Check `authMode: 'mock' | 'supabase'` from `useAuth()`.

**i18n (src/contexts/LanguageContext.tsx):** All UI strings go through `useLanguage().t(key)`. Two locales: `en` and `nl`. Add new keys to both locale objects in this file.

**Data layer:** Domain data (employees, onboarding, provisioning jobs) is fully mocked in `src/data/mockData.ts` — mutations are local state and don't persist. Supabase integration exists only for auth and notifications.

**Notifications (src/hooks/useNotifications.ts):** Dual storage — Supabase Realtime + DB when configured, otherwise `localStorage` with a `cores:notifications:changed` CustomEvent. Create notifications via `createAppNotification()` from `src/lib/notifications.ts`.

**Automation (src/lib/automation/client.ts):** `triggerOnboardingAutomation()` and `retryProvisioningAutomation()` call Supabase Edge Functions (Deno runtime in `supabase/functions/`), which handle Microsoft Graph API provisioning. The shared logic lives in `supabase/functions/_shared/`.

## Conventions

- **Imports:** Use `@/` alias for `src/` (e.g. `import { cn } from '@/lib/utils'`)
- **Components:** Prefer shadcn/ui primitives from `src/components/ui` before adding new UI blocks. Extend feature/page components before editing `src/components/ui/`.
- **TypeScript:** Intentionally loose config (`strict: false`, `noImplicitAny: false`) — don't tighten it
- **Routing:** All routes defined in `src/App.tsx`; add new authenticated routes alongside existing ones
- **Status styling:** Use explicit status→color mappings (see `StatusBadge.tsx` pattern)
- **Forms:** Follow controlled-form pattern from `AddEmployeeDialog.tsx` (React Hook Form + Zod)
- **Supabase migrations:** Keep in sync under `supabase/migrations/` when changing DB schema
