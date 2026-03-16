# Public Preview Checklist

Use this for a limited public preview before the full production cutover.

Current repo behavior:

- After the one-time preview bootstrap is done, pushes to `main` run `CI` first.
- If `CI` succeeds, GitHub Actions then runs the `Deploy` workflow in preview mode.
- The deploy workflow rebuilds from the same commit; it does not reuse the CI build artifact.
- Production remains a separate later step.

## 1. Pick the preview URLs

- App URL: use the Cloudflare preview Worker domain, for example `https://<project>-preview.<your-workers-subdomain>.workers.dev`
- Convex realtime URL: `https://<preview-deployment>.convex.cloud`
- Convex HTTP/auth URL: `https://<preview-deployment>.convex.site`

Notes:

- Cloudflare gives the public app domain on `workers.dev`.
- The format is `https://<worker-name>.<workers-subdomain>.workers.dev`.
- `<workers-subdomain>` is your Cloudflare Workers subdomain, not your numeric account ID.
- Convex gives the backend domains on `convex.cloud` and `convex.site`.
- For auth, `SITE_URL` must match the public app URL that users open.

## 2. Fill `.env.local`

Set at least these values:

```bash
CONVEX_DEPLOYMENT=dev:your-preview-deployment-name
VITE_CONVEX_URL=https://your-preview-deployment.convex.cloud
VITE_CONVEX_SITE_URL=https://your-preview-deployment.convex.site
BETTER_AUTH_SECRET=your-generated-secret
SITE_URL=https://<project>-preview.<your-workers-subdomain>.workers.dev
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_WORKERS_SUBDOMAIN=your-workers-subdomain
```

Generate the auth secret with:

```bash
openssl rand -base64 32
```

## 3. Provision preview infrastructure

If using Terraform:

```bash
DEPLOY_ENVIRONMENT=preview bash infrastructure/apply-from-env.sh
```

Otherwise, manually create the Cloudflare Worker via wrangler or the dashboard.

## 4. Set Convex backend env vars

```bash
npx convex env set SITE_URL "$SITE_URL"
npx convex env set BETTER_AUTH_SECRET "$BETTER_AUTH_SECRET"
npx convex env set GOOGLE_CLIENT_ID "$GOOGLE_CLIENT_ID"
npx convex env set GOOGLE_CLIENT_SECRET "$GOOGLE_CLIENT_SECRET"
```

## 5. Configure Google OAuth for preview

Add this authorized redirect URI in Google Cloud:

```text
https://<project>-preview.<your-workers-subdomain>.workers.dev/api/auth/callback/google
```

If you later change the preview app URL, update Google OAuth to match the new URL exactly.

## 6. Deploy preview

Run:

```bash
./scripts/deploy.sh preview
```

## 7. Smoke-test before inviting users

- Open the `workers.dev` preview URL in a private window
- Sign in with Google
- Confirm new users see expected post-login flow
- Confirm protected routes redirect unauthenticated users

## 8. GitHub Actions preview secrets

Add these repository secrets for automated preview deploys:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL`
- `CONVEX_DEPLOY_KEY_PREVIEW` or shared `CONVEX_DEPLOY_KEY`

Once these are set and the preview environment has been bootstrapped once, pushing to `main` is enough to auto-deploy preview after CI passes.

Optional production-only later:

- `VITE_CONVEX_URL_PROD`
- `VITE_CONVEX_SITE_URL_PROD`
- `CONVEX_DEPLOY_KEY_PROD`

## 9. Add a custom domain later

When you are ready to stop using `workers.dev`:

1. Put your domain on Cloudflare.
2. Configure the custom domain in your Terraform config or Wrangler settings.
3. Set `SITE_URL` to the new domain.
4. Re-deploy.
5. Update Google OAuth redirect URI to match the new domain.
