# Documentation Gaps

Documentation improvements needed for the `convex-tanstack-cloudfare` template.

---

## 1. Repository Name Typo

### Issue
Repository is named `convex-tanstack-cloudfare` but should be `convex-tanstack-cloudflare`.

### Impact
- Confusing for users
- Hard to search for
- Looks unprofessional

### Fix
Rename repository or create redirect.

---

## 2. Missing CONTRIBUTING.md

### Issue
No contribution guidelines for the template.

### Why It Matters
- Open source projects need clear contribution process
- Reduces friction for contributors
- Sets expectations for PRs

### Suggested Content
```markdown
# Contributing

## Getting Started
1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature`

## Development
- Run `npm run dev` for local development
- Run `npm run typecheck` before committing
- Run `npm run lint` to check code style

## Pull Requests
- Write clear PR descriptions
- Include tests for new features
- Update documentation as needed
```

---

## 3. Missing CHANGELOG.md

### Issue
No changelog to track version history.

### Why It Matters
- Users need to know what changed between versions
- Important for upgrade decisions
- Standard practice for templates

### Suggested Format
```markdown
# Changelog

## [Unreleased]
### Added
### Changed
### Fixed

## [0.1.0] - 2026-01-XX
### Added
- Initial release
- TanStack Start + Convex + Cloudflare Workers
- Better Auth integration
- Basic RBAC
```

---

## 4. Missing API Reference

### Issue
No documentation for Convex functions API.

### Why It Matters
- Developers need to understand available functions
- Parameters and return types should be documented
- Speeds up development

### Suggested Solution
Add to convex/README.md:

```markdown
## API Reference

### Queries

#### `messages.list`
Returns all messages ordered by creation time.
- **Auth**: Not required
- **Returns**: `Array<Message>`

#### `users.current`
Returns the currently authenticated user.
- **Auth**: Required
- **Returns**: `User | null`

### Mutations

#### `messages.send`
Creates a new message.
- **Auth**: Required
- **Args**: `{ content: string }`
- **Returns**: `Id<"messages">`
```

---

## 5. Incomplete Terraform Documentation

### Issue
Infrastructure README is minimal, many features commented out.

### Why It Matters
- Users might not know what's available
- Commented code suggests incomplete work
- Terraform is powerful but complex

### Suggested Improvements
- Explain each resource with examples
- Document when to use vs. when to skip
- Add architecture diagram
- Include cost estimates

---

## 6. Missing Troubleshooting Section

### Issue
README has "Common Issues" but it's incomplete.

### Why It Matters
- New users will hit common problems
- Reduces support burden
- Improves onboarding experience

### Suggested Additions
```markdown
## Troubleshooting

### "convex dev" fails to start
- Ensure you've run `npx convex dev` first
- Check that `.env.local` has `CONVEX_DEPLOYMENT` set

### Authentication not working
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
- Check that redirect URIs match in Google Console

### TypeScript errors after clone
- Run `npm install` first
- Run `npx convex dev` to generate types
- Delete `node_modules` and reinstall if issues persist

### Cloudflare Workers deployment fails
- Ensure `wrangler.jsonc` has correct account_id
- Run `wrangler login` to authenticate
```

---

## 7. Missing Environment Variable Descriptions

### Issue
`.env.example` lists variables but doesn't explain them all.

### Why It Matters
- New users don't know where to get values
- Some variables are Convex-generated
- Reduces confusion

### Suggested Improvements
```bash
# .env.example with better comments

# Convex Configuration
# Get this from running `npx convex dev` - it will auto-populate
CONVEX_DEPLOYMENT=dev:your-deployment-name

# Public Convex URL (for client-side)
# Format: https://your-deployment.convex.cloud
VITE_CONVEX_URL=

# Convex Site URL (for HTTP endpoints)
# Format: https://your-deployment.convex.site
VITE_CONVEX_SITE_URL=

# Google OAuth (from Google Cloud Console)
# Create at: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Site URL (used for OAuth redirects)
# Local: http://localhost:3000
# Production: https://your-domain.com
SITE_URL=http://localhost:3000
```

---

## 8. Missing Architecture Decision Records (ADRs)

### Issue
No explanation of why certain choices were made.

### Why It Matters
- Users want to understand trade-offs
- Helps with decision-making for modifications
- Documents team knowledge

### Suggested ADRs
- ADR-001: Why Better Auth over Clerk
- ADR-002: Why Cloudflare Workers as primary target
- ADR-003: Why TanStack Start over Next.js
- ADR-004: Why Convex over traditional databases

---

## 9. Missing Upgrade Guide

### Issue
No guide for upgrading dependencies.

### Why It Matters
- TanStack, Convex, and dependencies update frequently
- Breaking changes are common
- Users need guidance

### Suggested Content
```markdown
# Upgrade Guide

## Upgrading TanStack Packages
TanStack packages are versioned together. Update all at once:
```bash
npm update @tanstack/react-start @tanstack/react-router @tanstack/react-query
```

## Upgrading Convex
```bash
npx convex update
npm update convex @convex-dev/better-auth @convex-dev/react-query
```

## Breaking Changes Log
- **TanStack Start 1.x**: File-based routing changed in v1.50
- **Convex 1.30+**: New auth patterns
```

---

## 10. Missing Security Best Practices

### Issue
No security guidance for production deployment.

### Why It Matters
- Templates are often deployed to production as-is
- Security misconfigurations are common
- Users need guidance

### Suggested Section
```markdown
# Security Checklist

## Before Going to Production
- [ ] Set strong `SESSION_SECRET` (32+ random characters)
- [ ] Configure CSP headers in Cloudflare
- [ ] Enable rate limiting on auth endpoints
- [ ] Set up monitoring and alerting
- [ ] Review admin email whitelist
- [ ] Enable Cloudflare security features
- [ ] Test OAuth redirect URI restrictions
```

---

## Priority Matrix

| Documentation | Effort | Impact | Priority |
|---------------|--------|--------|----------|
| Fix repo name typo | Low | High | 🔴 Critical |
| API Reference | Medium | High | 🔴 Critical |
| Troubleshooting | Low | High | 🟡 High |
| Environment Variables | Low | Medium | 🟡 High |
| CONTRIBUTING.md | Low | Medium | 🟢 Medium |
| CHANGELOG.md | Low | Medium | 🟢 Medium |
| Security Best Practices | Medium | High | 🟢 Medium |
| Upgrade Guide | Medium | Medium | 🟢 Medium |
| ADRs | High | Low | ⚪ Optional |
| Terraform docs | High | Low | ⚪ Optional |
