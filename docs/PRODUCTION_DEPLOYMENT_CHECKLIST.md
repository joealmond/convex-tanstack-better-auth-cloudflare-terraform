# Production Deployment Checklist

Use this when you are ready to cut over from preview to a real production deployment.

## 1. Confirm the production targets

- App URL: your final Cloudflare Workers custom domain or production `workers.dev` URL
- Convex realtime URL: `https://<production-deployment>.convex.cloud`
- Convex HTTP/auth URL: `https://<production-deployment>.convex.site`

Notes:

- `SITE_URL` must match the exact public app URL users will open.
- Production should use a separate Convex deployment from preview.
- Production should use a separate Cloudflare Worker environment from preview.

## 2. Prepare production environment values

Make sure you have production values for:

```bash
CONVEX_DEPLOYMENT=prod:your-production-deployment-name
VITE_CONVEX_URL=https://your-production-deployment.convex.cloud
VITE_CONVEX_SITE_URL=https://your-production-deployment.convex.site
BETTER_AUTH_SECRET=your-production-secret
SITE_URL=https://your-production-domain.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
CUSTOM_DOMAIN=your-production-domain.com
```

Generate a new production auth secret with:

```bash
openssl rand -base64 32
```

## 3. Provision production infrastructure

If using Terraform:

```bash
DEPLOY_ENVIRONMENT=production bash infrastructure/apply-from-env.sh
```

Otherwise, configure the production Worker via wrangler or the Cloudflare dashboard.

## 4. Set Convex production env vars

```bash
npx convex env set SITE_URL "$SITE_URL"
npx convex env set BETTER_AUTH_SECRET "$BETTER_AUTH_SECRET"
npx convex env set GOOGLE_CLIENT_ID "$GOOGLE_CLIENT_ID"
npx convex env set GOOGLE_CLIENT_SECRET "$GOOGLE_CLIENT_SECRET"
```

## 5. Configure Google OAuth for production

Add this authorized redirect URI in Google Cloud:

```text
https://your-production-domain.com/api/auth/callback/google
```

If you are temporarily using the production `workers.dev` URL, use that exact URL instead.

## 6. Add GitHub production secrets

Before using the production deploy workflow, add these repository secrets:

- `VITE_CONVEX_URL_PROD`
- `VITE_CONVEX_SITE_URL_PROD`
- `CONVEX_DEPLOY_KEY_PROD` or shared `CONVEX_DEPLOY_KEY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## 7. Deploy production

Local deploy path:

```bash
./scripts/deploy.sh production
```

GitHub Actions path:

- Open the `Deploy` workflow
- Run it manually with `environment=production`

## 8. Production smoke check

After deploy, verify:

- the app home page loads on the production domain
- Google sign-in works
- protected routes redirect unauthenticated users
- the Convex health endpoint responds with `200`

## 9. Cutover notes

- Keep preview and production secrets separate.
- Do not reuse preview OAuth redirect URLs in production.
- Do not point production at the preview Convex deployment.
- Prefer doing one final manual production smoke check before inviting real users.
