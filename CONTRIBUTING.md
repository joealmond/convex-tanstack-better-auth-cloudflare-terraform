# Contributing

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

### Prerequisites

- **Node.js** >= 22.0.0
- A [Convex](https://convex.dev) account (free tier available)
- A [Cloudflare](https://cloudflare.com) account (Workers free tier available)

### Setup

```bash
# 1. Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/convex-tanstack-cloudflare.git
cd convex-tanstack-cloudflare

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp .env.example .env.local

# 4. Start development
npm run dev
```

## Development Workflow

### Branch Naming

- `feat/description` — New features
- `fix/description` — Bug fixes
- `docs/description` — Documentation updates
- `refactor/description` — Code refactoring

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add file upload progress bar
fix: resolve auth redirect loop on SSR
docs: update RBAC setup instructions
refactor: extract message list into component
```

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear, focused commits
3. Run checks before submitting:

   ```bash
   npm run typecheck   # TypeScript checks
   npm run lint         # ESLint
   npm run test         # Vitest
   ```

4. Open a PR with a clear description of what changed and why
5. Reference any related issues

## Code Standards

### TypeScript

- **Strict mode** is enabled — no `any` unless explicitly justified
- Use Convex validators (`v.string()`, `v.number()`) for all Convex function args
- Prefer `interface` for object shapes, `type` for unions/intersections

### File Naming

- `camelCase` for files and variables: `authHelpers.ts`, `rateLimitService.ts`
- `PascalCase` for components: `AdminToolbar.tsx`, `ErrorBoundary.tsx`
- `kebab-case` for hooks: `use-admin.ts`, `use-impersonate.tsx`

### Convex Functions

- Always validate args with Convex validators (`v.string()`, `v.number()`) — NOT Zod
- Use custom wrappers from `lib/customFunctions.ts` (`authQuery`, `authMutation`, `adminMutation`, `publicQuery`, etc.) — NEVER raw `query`/`mutation` from `_generated/server`
- Use `ConvexError` (from `convex/values`) for user-facing errors — NOT raw `Error`
- Keep mutations focused — one responsibility per function

### Frontend

- Functional components with hooks
- Use `cn()` from `@/lib/cn` for conditional classNames
- Use `logger` from `@/lib/logger` for logging — NOT raw `console.error`/`console.warn`
- Use Tailwind design tokens — avoid arbitrary values like `text-[#ff0000]`

## Project Structure

```text
convex/          # Backend — queries, mutations, auth, schema
src/routes/      # Frontend pages (file-based routing)
src/components/  # React components
src/hooks/       # Custom hooks
src/lib/         # Utilities (auth, env, cn, utils)
docs/            # Extended documentation
scripts/         # Deployment and dev scripts
infrastructure/  # Terraform IaC
```

## What We're Looking For

### Good First Issues

- Improving documentation
- Adding tests for existing components
- Fixing TypeScript warnings
- Adding examples to pattern files

### Feature Contributions

- New Convex function patterns
- UI components for common use cases
- Additional auth provider examples
- Integration examples (Stripe, Resend, etc.)

## Reporting Issues

When filing an issue, include:

1. **Description** — What happened vs. what you expected
2. **Steps to reproduce** — Minimal steps to trigger the issue
3. **Environment** — Node version, OS, browser
4. **Logs** — Any error messages or console output

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
