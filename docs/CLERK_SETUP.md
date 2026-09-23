# Clerk Authentication

Choose Clerk when creating the project; the generator applies the provider, middleware, Convex
identity adapter, session hook, chat controls, environment wizard, and Clerk-compatible CSP.

```bash
npm create convexkit@latest my-app -- --auth clerk
cd my-app
npm run setup
```

## Configure Clerk

1. Create a Clerk application and copy its publishable and secret keys.
2. In Clerk, create the Convex JWT integration/template required by the current
   [Convex + Clerk guide](https://docs.convex.dev/auth/clerk).
3. Set these local/server values through `npm run setup`:

```bash
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_ISSUER_DOMAIN=https://your-domain.clerk.accounts.dev
```

4. Set the issuer on the Convex deployment:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN "https://your-domain.clerk.accounts.dev"
```

## Cloudflare deployment

For a generated Cloudflare app, `npm run infra:bootstrap` sets the issuer on the selected preview Convex deployment. `npm run deploy:preview` places the publishable key in the Worker configuration and installs `CLERK_SECRET_KEY` as a Worker secret before its smoke check. No Clerk key is committed.

For GitHub deployment, set `CLERK_SECRET_KEY` as a protected Environment Secret and `CLERK_PUBLISHABLE_KEY` plus `CLERK_JWT_ISSUER_DOMAIN` as Environment Variables for both preview and production. The workflow sets the Convex issuer and Worker secret for the selected environment. Keep distinct Clerk applications or keys for preview and production.

## Generated architecture

- `src/start.tsx` installs Clerk's TanStack Start request middleware.
- `src/routes/__root.tsx` obtains a server token with `getToken({ template: 'convex' })` and uses `ConvexProviderWithClerk` in the browser.
- `convex/auth.config.ts` trusts the configured Clerk issuer for the `convex` application ID.
- `convex/lib/authHelpers.ts` converts `ctx.auth.getUserIdentity()` to ConvexKit's provider-neutral
  user shape.
- `src/lib/use-auth-session.ts` keeps example components independent of the auth provider.

Clerk hosts account management, so the Better Auth API route and component are not included in a
Clerk-generated project.

See the current [Clerk TanStack Start quickstart](https://clerk.com/docs/tanstack-react-start/getting-started/quickstart)
and [Convex TanStack Start with Clerk guide](https://docs.convex.dev/client/tanstack/tanstack-start/clerk).

## Admin email allowlists

Include `email` and `email_verified` claims from Clerk's verified primary email in the Convex
JWT template. The backend requires `emailVerified === true` for an `ADMIN_EMAILS` match.
Missing verification fails closed. Server-managed `role: 'admin'` claims are also accepted;
never populate a role from client-editable unsafe metadata.
