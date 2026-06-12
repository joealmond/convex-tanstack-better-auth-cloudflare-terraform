# ConvexKit

The edge-ready starter kit for TanStack Start, Convex, Better Auth, and Cloudflare Workers.

![ConvexKit banner](docs/assets/convexkit-banner.svg)

[![License: MIT](https://img.shields.io/badge/license-MIT-0f172a.svg)](LICENSE)
[![CI](https://github.com/joealmond/convex-tanstack-better-auth-cloudflare-terraform/actions/workflows/ci.yml/badge.svg)](https://github.com/joealmond/convex-tanstack-better-auth-cloudflare-terraform/actions/workflows/ci.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-2563eb.svg)](CONTRIBUTING.md)
![Node >=22](https://img.shields.io/badge/node-%3E%3D22-14b8a6.svg)
![Convex](https://img.shields.io/badge/Convex-1.31.7-111827.svg)
![TanStack Start](https://img.shields.io/badge/TanStack_Start-1.159.0-ef4444.svg)
![Better Auth](https://img.shields.io/badge/Better_Auth-1.4.9-7c3aed.svg)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-ready-f97316.svg)

```bash
git clone https://github.com/joealmond/convex-tanstack-better-auth-cloudflare-terraform.git
cd convex-tanstack-better-auth-cloudflare-terraform
npm install
npm run dev
```

![ConvexKit app preview](docs/assets/convexkit-preview.svg)

## Philosophy

This template embodies **opinionated simplicity**:

- **Real-time first**: Convex provides instant data sync without configuration
- **Edge-native**: Cloudflare Workers for global, low-latency deployment
- **Type-safe**: End-to-end TypeScript with Zod validation
- **Self-hostable**: Works with Convex Cloud or self-hosted Convex
- **Portable**: GitHub Actions support Cloudflare, Vercel, or Netlify

### Stack Choices

| Layer         | Choice             | Why                                           |
| ------------- | ------------------ | --------------------------------------------- |
| **Framework** | TanStack Start     | Modern React SSR with file-based routing      |
| **Database**  | Convex             | Real-time sync, serverless, TypeScript-native |
| **Auth**      | Better Auth        | Free, self-hosted, data ownership             |
| **Edge**      | Cloudflare Workers | Fast, cheap, global edge network              |
| **Styling**   | Tailwind CSS v4    | Utility-first, zero-runtime                   |
| **IaC**       | Terraform          | Declarative infrastructure                    |

### Architecture Flow

```mermaid
sequenceDiagram
    participant User as User (Browser)
    participant Edge as Cloudflare Workers (Edge)
    participant Convex as Convex Backend
    participant DB as Database + Auth

    User->>Edge: 1. Initial request
    Edge->>Convex: 2. SSR fetch data (queries)
    Convex->>DB: Read data and session state
    DB-->>Convex: 3. Return data
    Convex-->>Edge: Query results
    Edge-->>User: 4. HTML + JS bundle
    User->>User: 5. Client hydration (TanStack Router)
    User->>Convex: 6. WebSocket connection (real-time subscriptions)
    Convex-->>User: 7. Live updates (mutations, auth events)
    User->>Convex: 8. User actions (mutations)
    Convex-->>User: 9. Optimistic UI + confirmation
```

**Key Points:**

- **Steps 1-4**: Server-Side Rendering (SSR) on Cloudflare Workers for fast initial load
- **Steps 5-6**: Client-side hydration with TanStack Start and WebSocket connection to Convex
- **Steps 7-9**: Real-time data sync and mutations with optimistic UI updates
- **Auth**: Better Auth integrated with Convex for session management

---

## Quick Start

```bash
# 1. Clone & install
git clone https://github.com/joealmond/convex-tanstack-better-auth-cloudflare-terraform.git
cd convex-tanstack-better-auth-cloudflare-terraform
npm install

# 2. Configure Vite environment
cp .env.example .env.local
# Edit .env.local with your Convex URL

# 3. Set Convex backend environment variables
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set SITE_URL "https://your-project.convex.site"
npx convex env set GOOGLE_CLIENT_ID "your-google-client-id"
npx convex env set GOOGLE_CLIENT_SECRET "your-google-client-secret"

# 4. Start development (Convex + Vite concurrently)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Available Scripts

| Script                    | Description                                |
| ------------------------- | ------------------------------------------ |
| `npm run dev`             | Start dev server (Vite + Convex)           |
| `npm run build`           | Build for production                       |
| `npm run preview`         | Preview production build with Wrangler     |
| `npm run typecheck`       | Run TypeScript checks                      |
| `npm run lint`            | Run ESLint                                 |
| `npm run generate:routes` | Regenerate TanStack Router route tree      |
| `npm run deploy:preview`  | Deploy to preview environment              |
| `npm run deploy:prod`     | Deploy to production                       |
| `npm run sync:wrangler-config` | Generate Wrangler deploy config from build |

---

## Configuration

### Environment Variables

| Variable               | Description                               |
| ---------------------- | ----------------------------------------- |
| `VITE_CONVEX_URL`      | Convex deployment URL (`.convex.cloud`)   |
| `VITE_CONVEX_SITE_URL` | Convex HTTP URL (`.convex.site`)          |
| `BETTER_AUTH_SECRET`   | Auth secret (`openssl rand -base64 32`)   |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                    |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret                       |

### Cloudflare Workers

Key settings in `wrangler.jsonc`:

```jsonc
{
  "compatibility_flags": ["nodejs_compat"],
  "compatibility_date": "2025-01-01",
  "main": "@tanstack/react-start/server-entry",
}
```

---

## Deployment

### Local Deploy

```bash
./scripts/deploy.sh preview     # deploy preview (default)
./scripts/deploy.sh production  # deploy production
```

### GitHub Actions (Automatic)

Pushing to `main` triggers CI. On success, the Deploy workflow auto-deploys to **preview**.

To deploy to **production**, manually trigger the Deploy workflow with `environment=production`.

**Required GitHub Secrets** (for Cloudflare):

| Secret                   | Description                              |
| ------------------------ | ---------------------------------------- |
| `CLOUDFLARE_API_TOKEN`   | Cloudflare API token (Workers Edit)      |
| `CLOUDFLARE_ACCOUNT_ID`  | Cloudflare account ID                    |
| `VITE_CONVEX_URL`        | Convex URL for preview builds            |
| `VITE_CONVEX_SITE_URL`   | Convex site URL for preview builds       |
| `CONVEX_DEPLOY_KEY`      | Convex deploy key (shared or per-env)    |

See [docs/PUBLIC_PREVIEW_CHECKLIST.md](docs/PUBLIC_PREVIEW_CHECKLIST.md) for the full bootstrap guide.

**Optional Repository Variables:**

| Variable         | Options                           | Default      |
| ---------------- | --------------------------------- | ------------ |
| `DEPLOY_TARGET`  | `cloudflare`, `vercel`, `netlify` | `cloudflare` |
| `CONVEX_HOSTING` | `cloud`, `self-hosted`            | `cloud`      |

### Terraform (Infrastructure)

```bash
cd infrastructure
cp terraform.tfvars.example terraform.tfvars
terraform init && terraform apply
```

---

## Project Structure

```
├── convex/             # Backend (queries, mutations, auth)
├── src/routes/         # Frontend pages
├── src/lib/            # Utilities (auth, env, utils)
├── infrastructure/     # Terraform IaC
├── docs/               # Extended documentation
└── scripts/            # Deploy scripts
```

---

## Documentation

| Topic | Link |
| --- | --- |
| **Docs Index** | [docs/README.md](docs/README.md) |
| **Architecture Guide** | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| **Preview Checklist** ⚡ | [docs/PUBLIC_PREVIEW_CHECKLIST.md](docs/PUBLIC_PREVIEW_CHECKLIST.md) |
| **Production Checklist** | [docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md](docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md) |
| **Rate Limiting** ⚡ | [docs/RATE_LIMITING.md](docs/RATE_LIMITING.md) |
| **Feature Guides** | [docs/README.md#features](docs/README.md#features) |

⚡ = Production-ready implementations included

### External Docs

- [TanStack Start](https://tanstack.com/start/latest)
- [Convex](https://docs.convex.dev)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Better Auth](https://www.better-auth.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Terraform](https://developer.hashicorp.com/terraform/docs)
- [TypeScript](https://www.typescriptlang.org/docs/)
- [React](https://react.dev)

---

## Troubleshooting

| Issue                    | Solution                                                                   |
| ------------------------ | -------------------------------------------------------------------------- |
| Convex types missing     | Run `npx convex login` then `npx convex dev`                               |
| Workers build fails      | Check `nodejs_compat` in `wrangler.jsonc`                                  |
| Auth not persisting      | Verify `SITE_URL` matches your app URL                                     |
| Missing env vars warning | Set Convex env vars: `npx convex env set SITE_URL "url"`                   |
| Route types invalid      | Run `npm run generate:routes` to regenerate route tree                     |
| CORS errors on auth      | Check `trustedOrigins` in `convex/auth.ts`                                 |
| SSR QueryClient error    | Verify `ConvexProvider` and `QueryClientProvider` are in `router.tsx` Wrap |

---

## Credits

This template was inspired by:

- [srinivas-gangji/tanstack-convex-template](https://github.com/srinivas-gangji/tanstack-convex-template) - Production patterns and vite config

Co-authored with AI assistance powered by [Claude](https://anthropic.com/claude) (Anthropic).

---

## License

MIT
