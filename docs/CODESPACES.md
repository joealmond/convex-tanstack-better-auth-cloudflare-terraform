# Codespaces And Devcontainers

ConvexKit includes a devcontainer for GitHub Codespaces and VS Code Dev Containers.

## Start In Codespaces

1. Open the repository on GitHub.
2. Choose **Code → Codespaces → Create codespace on main**.
3. Wait for the container to finish `npm ci`.
4. Run:

   ```bash
   npm run setup
   npm run dev
   ```

5. Open the forwarded port `3000`.

## What The Container Provides

- Node.js 22
- npm dependencies installed with `npm ci`
- GitHub CLI
- VS Code extensions for ESLint, Prettier, Tailwind CSS, and containers
- Forwarded ports for the app (`3000`) and Convex dev tooling (`3210`)

## Secrets

Do not commit `.env.local` or `.dev.vars`. Use Codespaces secrets or run `npm run setup` inside the Codespace to create local environment files.

Google OAuth remains optional. Anonymous realtime messages work without OAuth credentials.
