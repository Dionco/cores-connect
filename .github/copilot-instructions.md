# Project Guidelines

## Code Style
- Use TypeScript React function components and keep new code consistent with existing files in src/pages and src/components.
- Prefer the @ alias for imports from src (example: @/components/ui/button).
- Keep utility-class styling in Tailwind, and reuse existing shadcn/ui primitives before introducing new UI building blocks.
- Keep comments short and only for non-obvious logic.

## Architecture
- Application shell and providers are composed in src/App.tsx in this order: QueryClientProvider, LanguageProvider, AuthProvider, TooltipProvider, then Router.
- Routing is centralized in src/App.tsx, with authenticated pages rendered through AppLayout.
- Global state uses React Context in src/contexts/AuthContext.tsx and src/contexts/LanguageContext.tsx.
- Domain data and mock types live in src/data/mockData.ts. Treat this repo as frontend-first with mocked data flows (no backend API integration yet).
- Shared presentational primitives live in src/components/ui. Feature components belong in src/components, page-level composition belongs in src/pages.

## Build and Test
- Install dependencies with bun install.
- Start development server with bun run dev (runs on port 8080).
- Build with bun run build.
- Lint with bun run lint.
- Run tests once with bun run test and in watch mode with bun run test:watch.
- If Bun is unavailable in the execution environment, use the equivalent npm scripts.

## Conventions
- Keep localization keys and text in src/contexts/LanguageContext.tsx and use useLanguage().t(key) in UI.
- Follow existing controlled-form patterns for dialogs and forms (see src/components/AddEmployeeDialog.tsx).
- For status-driven styling, use explicit mapping patterns like src/components/StatusBadge.tsx.
- Prefer extending feature components and page components before editing generated primitives in src/components/ui.
- Keep route additions aligned with existing authenticated routing structure in src/App.tsx.

## Pitfalls
- TypeScript strictness is intentionally loose (strict=false, noImplicitAny=false). Do not assume strict compiler enforcement; add explicit types for new logic where practical.
- Auth is currently mocked in src/contexts/AuthContext.tsx (no real credential validation or backend session).
- Data mutations are currently local/mock and may not persist across reloads.
- Vite includes lovable-tagger during development mode; avoid relying on dev-only behavior in production logic.
- When changing database schema or policies, keep Supabase migrations in sync under supabase/migrations and validate with local push/reset flows.

## Documentation
- Use README.md for local setup and Supabase environment configuration instead of duplicating steps here.
- Use supabase/config.toml for local Supabase service configuration details.
- Use supabase/migrations for schema and RLS evolution history.

## Key References
- src/App.tsx
- src/contexts/AuthContext.tsx
- src/contexts/LanguageContext.tsx
- src/components/AppLayout.tsx
- src/components/AddEmployeeDialog.tsx
- src/components/StatusBadge.tsx
- src/data/mockData.ts
- src/lib/automation/client.ts
- package.json
- supabase/functions/onboarding-trigger/index.ts
- vite.config.ts
- vitest.config.ts
