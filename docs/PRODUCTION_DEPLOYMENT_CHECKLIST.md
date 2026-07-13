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
VITE_GOOGLE_AUTH_ENABLED=false
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
CUSTOM_DOMAIN=your-production-domain.com
```

Generate a new production auth secret with:

```bash
openssl rand -base64 32
```

## 3. Provision production infrastructure

If using optional Terraform-managed KV, R2, Turnstile, or Web Analytics:

```bash
cp infrastructure/terraform.tfvars.example infrastructure/terraform.tfvars
terraform -chdir=infrastructure init
terraform -chdir=infrastructure plan
terraform -chdir=infrastructure apply
```

Wrangler and the Deploy workflow own the Worker and its Custom Domain; Terraform intentionally does not.

## 4. Set Convex production env vars

```bash
npx convex env set SITE_URL "$SITE_URL"
npx convex env set BETTER_AUTH_SECRET "$BETTER_AUTH_SECRET"
# Optional, only when Google OAuth is enabled:
npx convex env set GOOGLE_CLIENT_ID "$GOOGLE_CLIENT_ID"
npx convex env set GOOGLE_CLIENT_SECRET "$GOOGLE_CLIENT_SECRET"
```

## 5. Optionally configure Google OAuth for production

Google OAuth is optional. The app can launch with anonymous realtime messaging when `VITE_GOOGLE_AUTH_ENABLED=false`.

If you enable Google OAuth, set `VITE_GOOGLE_AUTH_ENABLED=true`, set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then add this authorized redirect URI in Google Cloud:

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
- Anonymous realtime messages work
- Google sign-in works if OAuth is enabled
- protected routes redirect unauthenticated users
- the Convex health endpoint responds with `200`

## 9. Cutover notes

- Keep preview and production secrets separate.
- Do not reuse preview OAuth redirect URLs in production when OAuth is enabled.
- Do not point production at the preview Convex deployment.
- Prefer doing one final manual production smoke check before inviting real users.
