# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-13

### Added

- Publish-ready `create-convexkit` scaffolder with Better Auth/Clerk, Cloudflare/Vercel/Netlify,
  selectable examples, and optional Terraform.
- Working Todos, AI streaming, Stripe billing, and Resend email examples.
- shadcn-compatible Button, Card, Input, and Dialog primitives.
- Convex integration coverage, enforced coverage thresholds, and Playwright public/authenticated
  smoke suites.
- VitePress documentation site with GitHub Pages deployment.

### Changed

- Hardened integration secrets, webhook validation/idempotency, ownership checks, rate limits,
  pagination, and upload policies.
- CI now validates the CLI package, documentation, browser flows, Terraform, dependency audit, and
  production Worker bundle.
- Example routing now uses a proper nested layout so every `/examples/*` page renders correctly.

### Removed

- The unused rate-limit middleware wrapper and permissive empty-test behavior.

## [0.2.0] - 2026-02-07

### Changed

- **Dependencies Updated**: All packages updated to latest stable versions
  - `convex`: 1.31.6 → 1.31.7
  - `@tanstack/react-start`: 1.154.14 → 1.159.0
  - `@tanstack/react-router`: 1.154.14 → 1.158.4
  - `@tanstack/react-router-with-query`: 1.130.17 (unchanged, already latest)
  - `wrangler`: 4.60.0 → 4.63.0

## [0.1.0] - 2025-02-07

### Added

- **Core Stack**: TanStack Start + Convex + Cloudflare Workers + Better Auth
- **Authentication**: Google OAuth via Better Auth with Convex adapter
- **RBAC**: Admin detection via email whitelist and database role field
- **Admin Toolbar**: "View as User" impersonation for admins
- **Real-time Messaging**: Live message board with Convex subscriptions
- **File Uploads**: Upload/download/delete files with Convex storage
- **Rate Limiting**: Two-layer rate limiting (Cloudflare + Convex) with role-based multipliers
- **Error Handling**: ErrorBoundary component with optional Sentry integration
- **Form Validation**: react-hook-form + Zod example (`ExampleForm`)
- **404 Page**: Custom `NotFound` component with navigation
- **Toast Notifications**: Sonner integration in root layout
- **Testing**: Vitest + React Testing Library setup with example tests
- **SSR**: Server-side rendering on Cloudflare Workers edge
- **Terraform**: Infrastructure-as-code for Cloudflare resources
- **Deploy Scripts**: Automated deployment for preview and production
- **Design Patterns**: Repository, Factory, Service Adapter, Middleware examples
- **Comprehensive Docs**: Architecture, RBAC, Rate Limiting, Optional Features, and more
- **Protected Routes**: `_authenticated` layout route with auth guard
- **Environment Validation**: Zod-based env var validation (`src/lib/env.ts`)
- **Seed Script**: Example data seeding for development (`convex/seed.ts`)
