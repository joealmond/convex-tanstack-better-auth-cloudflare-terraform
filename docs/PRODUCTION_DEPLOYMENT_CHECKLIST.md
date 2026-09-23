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
npx convex env set --prod SITE_URL "$SITE_URL"
printf %s "$BETTER_AUTH_SECRET" | npx convex env set --prod BETTER_AUTH_SECRET
# Optional, only when Google OAuth is enabled:
npx convex env set --prod GOOGLE_CLIENT_ID "$GOOGLE_CLIENT_ID"
printf %s "$GOOGLE_CLIENT_SECRET" | npx convex env set --prod GOOGLE_CLIENT_SECRET
```

For Better Auth apps, configure verification, recovery, and deletion email as described in [account email setup](AUTH_EMAIL.md). The production preflight requires `AUTH_EMAIL_PROVIDER=resend`, `AUTH_EMAIL_FROM`, and `RESEND_API_KEY` on the production Convex deployment. Keep the API key in Convex's environment variables or inject it from your team's secret manager; no credential belongs in this repository.

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

Before deployment, confirm that email-allowlisted administrators have verified email ownership.
An unverified email/password signup must remain a regular user even when the email is allowlisted.
Run the authenticated smoke test against a dedicated preview backend with
`E2E_RUN_AUTH=true E2E_BASE_URL=https://your-preview-host npm run test:e2e:auth`.
This creates a test account, message, and file; use a disposable preview project.

## 7. Deploy production

GitHub Actions path (runs preflight, application checks, deployment smoke, and records the release):

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
