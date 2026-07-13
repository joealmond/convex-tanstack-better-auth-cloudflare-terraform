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

## Generated architecture

- `src/start.tsx` installs Clerk's TanStack Start request middleware.
- `src/routes/__root.tsx` obtains a server token and uses `ConvexProviderWithClerk` in the browser.
- `convex/auth.config.ts` trusts the configured Clerk issuer for the `convex` application ID.
- `convex/lib/authHelpers.ts` converts `ctx.auth.getUserIdentity()` to ConvexKit's provider-neutral
  user shape.
- `src/lib/use-auth-session.ts` keeps example components independent of the auth provider.

Clerk hosts account management, so the Better Auth API route and component are not included in a
Clerk-generated project.

See the current [Clerk TanStack Start quickstart](https://clerk.com/docs/tanstack-react-start/getting-started/quickstart)
and [Convex TanStack Start with Clerk guide](https://docs.convex.dev/client/tanstack/tanstack-start/clerk).
