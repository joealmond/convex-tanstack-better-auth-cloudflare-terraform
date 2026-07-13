---
layout: home

hero:
  name: ConvexKit
  text: Realtime full-stack React, composed for production
  tagline: TanStack Start, Convex, Better Auth or Clerk, and Cloudflare/Vercel/Netlify in one tested scaffolder.
  actions:
    - theme: brand
      text: Get started
      link: /README
    - theme: alt
      text: Explore examples
      link: /EXAMPLES
    - theme: alt
      text: Live demo
      link: https://convexkit-preview.jozsef-mandula.workers.dev

features:
  - title: Realtime by default
    details: Convex queries, mutations, storage, pagination, optimistic UI, and secure server actions.
  - title: Auth you can choose
    details: Self-owned Better Auth by default, with a fully generated Clerk alternative.
  - title: Deploy where you work
    details: Cloudflare Workers, Vercel Nitro, or Netlify output generated from one command.
  - title: Trust built in
    details: Strict TypeScript and linting, coverage gates, Playwright smoke tests, dependency audits, and Terraform validation.
---

## Create an app

```bash
npm create convexkit@latest my-app
cd my-app
npm run setup
npm run dev
```

Email/password works with the default Better Auth setup, so OAuth is optional. Use the interactive
prompts to choose examples, authentication, deployment target, and Terraform.

## Start here

- [Documentation index](/README)
- [Architecture](/ARCHITECTURE)
- [Feature examples](/EXAMPLES)
- [Production deployment](/PRODUCTION_DEPLOYMENT_CHECKLIST)
- [Troubleshooting](/TROUBLESHOOTING)
