# Roadmap: Becoming the Go-To Template for This Stack

**Goal:** the most attractive, most-used starter for **TanStack Start + Convex + Better Auth + Cloudflare**, distributed as a CLI scaffolder (`npm create ...`), with multiple small, polished feature examples.

**Positioning:** competitors exist (dyeoman2/tanstack-start-template, TheOrcDev, gerkim62, official Convex examples) but none owns this niche. Our unique edges nobody else has together: **Cloudflare Workers deploy, Terraform IaC, rate limiting, RBAC, multi-target CI**. The stack itself is a 2026 winner — TanStack Start, Convex, Better Auth, and Tailwind v4 are all momentum picks. What's missing is first impression, zero-friction setup, tests, and distribution.

---

## Phase 0 — Cleanup (1–2 days)

Ship nothing new; remove everything that signals "personal project".

- [x] Delete internal artifacts: `docs/CODE_REVIEW_FINDINGS.md`, `docs/CODE_REVIEW_PLAN.md`, `docs/MOBILE_OLD.md`
- [x] Merge duplicates: `AI_INTEGRATION.md` + `AI_INTEGRATIONS.md` → one file
- [x] Remove legacy schema fields (`createdAt` "kept for backward compatibility" — a template has no legacy data)
- [x] Fix README placeholders (`git clone <this-repo>`)
- [x] Decide name + tagline. Current repo name is 6 words long; package.json says `convex-tanstack-cloudflare`. Pick one short, brandable name (this becomes the CLI name too)
- [x] Align `package.json` name/description with the repo

## Phase 1 — First impression (week 1)

A developer decides in ~10 seconds on the README.

- [x] **Hero section first**: logo/banner image, one-line pitch, badges (CI status, license, PRs-welcome, Convex/TanStack versions), then a screenshot or GIF of the running app — *before* any philosophy text
- [x] Replace ASCII architecture diagram with **Mermaid** (GitHub renders it natively)
- [ ] **Deploy a live demo** and link it at the top — single biggest attractiveness win
- [ ] Enable GitHub "Use this template" button; add repo social preview image, topics/tags
- [x] Add community files: `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue/PR templates
- [ ] Enable GitHub Discussions
- [x] Cut the 26-file docs table in the README to ~6 curated links; move the rest to a docs index page

## Phase 2 — Zero-friction onboarding (week 2)

First `npm run dev` must work with **zero accounts configured** except Convex.

- [x] `npm run setup` wizard: creates `.env.local`, generates `BETTER_AUTH_SECRET`, sets Convex env vars, optionally walks through Google OAuth
- [x] Make Google OAuth **optional**: email/password (or anonymous) auth works out of the box so the demo runs without any OAuth credentials
- [x] Devcontainer + Codespaces config (one-click cloud dev)
- [x] Troubleshooting doc generated from real first-run failures

## Phase 3 — Feature examples (weeks 3–4)

Multiple small, isolated examples — each is one route + one Convex module + a doc section, individually deletable.

- [x] `/examples` route group with an index page listing all examples
- [x] **Realtime chat** (exists — polish, move under examples)
- [ ] **Todos**: optimistic updates + cursor pagination + TanStack Table list view
- [x] **File uploads** (exists — polish)
- [x] **Admin / RBAC panel** (exists — polish, showcase impersonation)
- [x] **Forms**: react-hook-form + Zod (exists as ExampleForm — finish and surface)
- [ ] **AI streaming**: one Convex action streaming an LLM response to the UI
- [ ] **Stripe billing**: turn `docs/STRIPE_PAYMENTS.md` into working code (checkout + webhook)
- [ ] **Email**: turn `docs/EMAIL_WITH_RESEND.md` into working code (welcome email on signup)
- [ ] Adopt **shadcn/ui** (`components.json` + Button/Card/Input/Dialog) — it's the community default and makes every example prettier

## Phase 4 — Trust: tests & releases (week 5)

- [ ] `convex-test` unit tests for every Convex function (currently 2 test files total)
- [ ] Playwright e2e smoke test: sign up → send message → upload file
- [ ] Remove `--passWithNoTests`; add coverage + CI badges
- [x] Versioned releases with changesets/release-please; keep CHANGELOG automated
- [x] Renovate (or keep Dependabot) with auto-merge for patch updates

## Phase 5 — Distribution: the CLI (weeks 6–8)

This is how templates become defaults.

- [ ] `npm create <name>@latest` package with interactive prompts:
  - auth: Better Auth (default) / Clerk
  - deploy target: Cloudflare (default) / Vercel / Netlify
  - examples: multi-select, scaffold only what's chosen
  - Terraform: opt-in
- [ ] Restructure repo so the CLI composes from feature modules (the Phase 3 isolation pays off here)
- [ ] Publish to npm; README install becomes one command

## Phase 6 — Growth (ongoing)

- [ ] Docs site (Astro Starlight or VitePress) replacing the flat `docs/` folder
- [ ] Submit to the Convex templates gallery and TanStack community examples
- [ ] Launch posts: Convex Discord, TanStack Discord, r/reactjs, X; one dev.to/blog walkthrough
- [ ] Add to relevant awesome-lists
- [ ] Track: GitHub stars, CLI npm downloads, "Used by" count

---

## Success criteria

1. A stranger goes from `npm create` to a running real-time app in **under 5 minutes** with no OAuth setup.
2. Every advertised feature has working code, a test, and a live-demo page — not just a doc.
3. The README sells the template in one screen: pitch → screenshot → live demo → install command.

*Supersedes `docs/FUTURE_ROADMAP.md`.*
