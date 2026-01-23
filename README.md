# Convex + TanStack Start + Cloudflare Workers

A modern, production-ready full-stack template.

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

```
┌─────────────────────┐          ┌──────────────────────────┐          ┌─────────────────────────┐
│   User (Browser)    │          │  Cloudflare Workers      │          │   Convex (Backend)      │
│                     │          │       (Edge)             │          │                         │
└─────────────────────┘          └──────────────────────────┘          └─────────────────────────┘
          │                                   │                                     │
          │  1. Initial Request               │                                     │
          │──────────────────────────────────>│                                     │
          │                                   │                                     │
          │                                   │  2. SSR: Fetch Data (Queries)       │
          │                                   │────────────────────────────────────>│
          │                                   │                                     │
          │                                   │                                     │  ┌──────────┐
          │                                   │  3. Return Data                     │  │ Database │
          │                                   │<────────────────────────────────────│<─┤          │
          │                                   │                                     │  │  + Auth  │
          │  4. HTML + JS Bundle              │                                     │  └──────────┘
          │<──────────────────────────────────│                                     │
          │                                   │                                     │
          │                                   │                                     │
          │  5. Client Hydration              │                                     │
          │     (TanStack Router)             │                                     │
          │                                   │                                     │
          │  6. WebSocket Connection (Real-time Subscriptions)                      │
          │────────────────────────────────────────────────────────────────────────>│
          │                                   │                                     │
          │  7. Live Updates (Mutations, Auth Events)                               │
          │<────────────────────────────────────────────────────────────────────────│
          │                                   │                                     │
          │  8. User Actions (Mutations)      │                                     │
          │────────────────────────────────────────────────────────────────────────>│
          │                                   │                                     │
          │  9. Optimistic UI + Confirmation  │                                     │
          │<────────────────────────────────────────────────────────────────────────│
          │                                   │                                     │
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
git clone <this-repo> && cd convex-tanstack-cloudflare
npm install

# 2. Configure
cp .env.example .env.local
# Edit .env.local with your values

# 3. Start Convex
npx convex dev

# 4. Run locally
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Configuration

### Environment Variables

| Variable               | Description                             |
| ---------------------- | --------------------------------------- |
| `VITE_CONVEX_URL`      | Convex deployment URL                   |
| `BETTER_AUTH_SECRET`   | Auth secret (`openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                  |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret                     |

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
./scripts/deploy.sh production
```

### GitHub Actions (Automatic)

Configure via repository variables:

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

| Topic                   | Link                                                       |
| ----------------------- | ---------------------------------------------------------- |
| **RBAC & Permissions**  | [docs/RBAC.md](docs/RBAC.md)                               |
| **AI Guidelines**       | [docs/AI_GUIDELINES.md](docs/AI_GUIDELINES.md)             |
| **Cloudflare Features** | [docs/CLOUDFLARE_FEATURES.md](docs/CLOUDFLARE_FEATURES.md) |
| **AI & Integrations**   | [docs/AI_INTEGRATIONS.md](docs/AI_INTEGRATIONS.md)         |
| **CI/CD Options**       | [docs/CI_CD_OPTIONS.md](docs/CI_CD_OPTIONS.md)             |
| **Optional Features**   | [docs/OPTIONAL_FEATURES.md](docs/OPTIONAL_FEATURES.md)     |
| **Clerk Auth Setup**    | [docs/CLERK_SETUP.md](docs/CLERK_SETUP.md)                 |
| **Vercel Deploy**       | [docs/VERCEL_SETUP.md](docs/VERCEL_SETUP.md)               |
| **Netlify Deploy**      | [docs/NETLIFY_SETUP.md](docs/NETLIFY_SETUP.md)             |
| **Terraform**           | [infrastructure/README.md](infrastructure/README.md)       |

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

| Issue                | Solution                                     |
| -------------------- | -------------------------------------------- |
| Convex types missing | Run `npx convex login` then `npx convex dev` |
| Workers build fails  | Check `nodejs_compat` in `wrangler.jsonc`    |
| Auth not persisting  | Verify `SITE_URL` matches your app URL       |

---

## Credits

This template was inspired by:

- [srinivas-gangji/tanstack-convex-template](https://github.com/srinivas-gangji/tanstack-convex-template) - Production patterns and vite config

Co-authored with [Antigravity](https://deepmind.google/) powered by [Claude Opus 4.5](https://anthropic.com/claude) (Anthropic).

---

## License

MIT
