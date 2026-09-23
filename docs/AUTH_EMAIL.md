# Account verification and recovery email

Fresh local apps need no email account. `AUTH_EMAIL_PROVIDER` defaults to `disabled`, so email/password sign-in works while developing. Before a production Better Auth deployment, configure account email on that **Convex deployment**. Production preflight then checks the configuration without printing the API key.

## Enable Resend

1. Verify a sending domain with Resend and choose a sender such as `Your App <auth@your-domain.example>`.
2. Select the intended Convex deployment, then set these values. For Convex Cloud production, add `--prod` to each `npx convex env set` command or use a production deploy key. Verify the selected deployment before setting a secret.

   ```bash
   npx convex env set AUTH_EMAIL_FROM    # paste the sender at the prompt
   npx convex env set RESEND_API_KEY     # paste the API key at the prompt
   npx convex env set AUTH_EMAIL_PROVIDER resend
   ```

3. Run `npm run preflight:deploy -- --environment production` with the production deploy key and app URL selected. Deploy only after it passes.

Verification, password reset, and account-deletion messages then use the configured sender. Signed links and account addresses are sent to the app owner's Resend account when users request those flows. The template includes no Resend credential and makes no email request during scaffolding, setup, or CI.

## Where secrets live

- Keep `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `AUTH_EMAIL_PROVIDER`, and `BETTER_AUTH_SECRET` in each Convex deployment's environment variables. Never use a `VITE_` prefix for them.
- Keep Convex and Cloudflare deploy keys in protected GitHub Environment Secrets. Preview and production should have separate values.
- If your team uses a secret manager, keep the master values there and inject them into Convex and GitHub through your existing protected process. No secret-manager account or SDK is required by the generated app.

Do not put API keys, signed links, or account email addresses in Git, Terraform state, build artifacts, logs, or release records. Rotate a provider key in the secret store and update the affected Convex deployment when needed.
