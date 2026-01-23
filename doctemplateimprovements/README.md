# Template Improvements Documentation

## Purpose

This directory contains documentation of **issues, gaps, and improvement opportunities** discovered while building the G-Matrix application using the `convex-tanstack-cloudfare` template.

These findings are intended to be contributed back to the original template to improve it for future users.

---

## Original Template

**Repository**: `/Users/mandulaj/dev/source/convex-tanstack-cloudfare`

**Description**: A production-ready template combining:
- TanStack Start (React SSR with file-based routing)
- Convex (real-time database and serverless backend)
- Cloudflare Workers (edge deployment)
- Better Auth (self-hosted authentication)

---

## Documentation Structure

### 📋 Template Feedback (Contribute Back)
| File | Description |
|------|-------------|
| [MISSING_FEATURES.md](./MISSING_FEATURES.md) | Features missing from the template that are commonly needed |
| [DOCUMENTATION_GAPS.md](./DOCUMENTATION_GAPS.md) | Documentation that should be added or improved |
| [PATTERN_IMPROVEMENTS.md](./PATTERN_IMPROVEMENTS.md) | Better patterns and practices discovered |
| [TEMPLATE_IMPROVEMENTS.md](./TEMPLATE_IMPROVEMENTS.md) | **Critical** API patterns and fixes (TanStack Start v1.154+) |

### 🔧 Project-Specific Docs
| File | Description |
|------|-------------|
| [AI_AGENT_CONTEXT.md](./AI_AGENT_CONTEXT.md) | Comprehensive context for AI coding agents (stack, structure, patterns) |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Complete deployment guide for Cloudflare Workers |

---

## Quick Summary of Findings

### 🔴 Critical Issues (TEMPLATE_IMPROVEMENTS.md)
1. **TanStack Start API v1.154+** - Template uses outdated patterns
   - `StartClient` must import from `/client` subpath
   - `server.ts` must use `/server-entry` handler
   - Router prop removed from StartClient
2. **Cloudflare Vite Plugin** - `environment` prop invalid, use `config` function
3. **Better Auth User IDs** - Must use `v.string()` not `v.id('users')` in Convex schema
4. **Route Tree** - Must be generated via `@tanstack/router-cli generate`

### 🟡 Missing Features (MISSING_FEATURES.md)
1. **No UI Component Library** - Template lacks shadcn/ui or similar
2. **No Testing Setup** - No Vitest, Playwright, or test scripts
3. **Limited Routes** - Only 2 example routes, no protected route example
4. **No Form Handling** - No react-hook-form or similar integration
5. **No Toast Notifications** - Sonner mentioned but not included

### 🟢 Documentation Gaps (DOCUMENTATION_GAPS.md)
1. No contribution guide (CONTRIBUTING.md)
2. No changelog
3. No API reference for Convex functions
4. Typo in repo name ("cloudfare" vs "cloudflare")

---

## Recommended Template Changes

### Priority 1: Fix Breaking Issues
```bash
# These MUST be fixed in template for it to work:
```

1. **Update `src/start.tsx`**:
   ```tsx
   import { StartClient } from '@tanstack/react-start/client'
   import { StrictMode, startTransition } from 'react'
   import { hydrateRoot } from 'react-dom/client'

   startTransition(() => {
     hydrateRoot(document, <StrictMode><StartClient /></StrictMode>)
   })
   ```

2. **Update `src/server.ts`**:
   ```typescript
   import handler from '@tanstack/react-start/server-entry'

   export default {
     fetch(request: Request) {
       return handler.fetch(request)
     },
   }
   ```

3. **Fix `vite.config.ts` Cloudflare plugin**:
   ```typescript
   cloudflare({
     configPath: './wrangler.jsonc',
     config: (userConfig) => ({
       ...userConfig,
     }),
   })
   ```

4. **Add route tree generation script**:
   ```json
   "scripts": {
     "generate:routes": "npx @tanstack/router-cli generate"
   }
   ```

### Priority 2: Add Essential Dependencies
```json
{
  "dependencies": {
    "sonner": "^2.x.x",
    "react-hook-form": "^7.x.x",
    "@hookform/resolvers": "^3.x.x"
  },
  "devDependencies": {
    "vitest": "^3.x.x",
    "@testing-library/react": "^16.x.x"
  }
}
```

### Priority 3: Add Example Routes
- `src/routes/login.tsx` - Auth example
- `src/routes/_authenticated.tsx` - Protected route layout
- `src/routes/_authenticated/dashboard.tsx` - Protected page

---

## How to Contribute Findings

When you discover an issue or improvement opportunity:

1. **Identify the category** (missing feature, documentation gap, pattern improvement, critical fix)
2. **Add to the appropriate file** with:
   - Clear description of the issue
   - Why it matters
   - Suggested solution
   - Code examples if applicable
3. **Update this README** summary if it's a significant finding
4. **For critical issues** - Add to TEMPLATE_IMPROVEMENTS.md with ✅/❌ examples

---

## Document Status

| Document | Status | Priority |
|----------|--------|----------|
| README.md | ✅ Updated | - |
| TEMPLATE_IMPROVEMENTS.md | ✅ **Critical** | 🔴 High |
| MISSING_FEATURES.md | ✅ Complete | 🟡 Medium |
| DOCUMENTATION_GAPS.md | ✅ Complete | 🟡 Medium |
| PATTERN_IMPROVEMENTS.md | ✅ Complete | 🟢 Low |
| AI_AGENT_CONTEXT.md | ✅ Moved here | Reference |
| DEPLOYMENT.md | ✅ Moved here | Reference |
