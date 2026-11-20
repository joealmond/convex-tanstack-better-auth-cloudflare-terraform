# Account verification and recovery email

Fresh local apps need no email account. `AUTH_EMAIL_PROVIDER` defaults to `disabled`, so email/password sign-in works while developing. Before a production Better Auth deployment, configure account email on that **Convex deployment**. Production preflight then checks the configuration without printing the API key.

## Enable Resend

1. Verify a sending domain with Resend and choose a sender such as `Your App <auth@your-domain.example>`.
2. Select the intended Convex deployment, then set these values. The first block targets the selected development or preview deployment. The second targets Convex Cloud production; use it only with production values.

   ```bash
   npx convex env set AUTH_EMAIL_FROM    # paste the sender at the prompt
   npx convex env set RESEND_API_KEY     # paste the API key at the prompt
   npx convex env set AUTH_EMAIL_PROVIDER resend
   ```

   ```bash
   npx convex env set --prod AUTH_EMAIL_FROM    # paste the production sender at the prompt
   npx convex env set --prod RESEND_API_KEY     # paste the production API key at the prompt
   npx convex env set --prod AUTH_EMAIL_PROVIDER resend
   ```

3. Run `npm run preflight:deploy -- --environment production` with the production deploy key and app URL selected. Deploy only after it passes.

Verification, password reset, and account-deletion messages then use the configured sender. Signed links and account addresses are sent to the app owner's Resend account when users request those flows. The template includes no Resend credential and makes no email request during scaffolding, setup, or CI.

## Where secrets live

- Keep `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `AUTH_EMAIL_PROVIDER`, and `BETTER_AUTH_SECRET` in each Convex deployment's environment variables. Never use a `VITE_` prefix for them.
- Transactional welcome and test mail reuse `AUTH_EMAIL_FROM`. Set `RESEND_FROM_EMAIL` only for a separately verified transactional sender.
- Keep Convex and Cloudflare deploy keys in protected GitHub Environment Secrets. Preview and production should have separate values.
- If your team uses a secret manager, keep the master values there and inject them into Convex and GitHub through your existing protected process. No secret-manager account or SDK is required by the generated app.

Do not put API keys, signed links, or account email addresses in Git, Terraform state, build artifacts, logs, or release records. Rotate a provider key in the secret store and update the affected Convex deployment when needed.

## Passwordless email links

With Resend configured above, set `VITE_MAGIC_LINK_AUTH_ENABLED=true` in the web app's build environment (local `.env.local`, or your preview/production build environment), then rebuild. The sign-in menu defaults to email links; password and Google options remain available. New readers can join without a password. The backend enables this endpoint only when `AUTH_EMAIL_PROVIDER=resend`.

Links expire after five minutes, are single-use, and are stored as hashes. Requests are limited to five per ten minutes per client IP. Failed or expired links return to the sign-in menu with instructions to request another. Email scanners that open links may consume them; request another if necessary. Delivery uses the existing Resend timeout and reports failure without retrying an uncertain send.

## Apple sign-in

1. In Apple Developer, enable Sign in with Apple on an App ID and associate a web Services ID. Register the app's public HTTPS domain and return URL `https://your-domain.com/api/auth/callback/apple`. Apple does not support localhost return URLs.
2. Create an Apple signing key. Generate an ES256 client-secret JWT using the key ID, Team ID and `.p8` private key, with the Services ID as subject and `https://appleid.apple.com` as audience. Follow [Better Auth's Apple setup](https://better-auth.com/docs/authentication/apple). Keep the key and JWT private; rotate the JWT before its expiry (maximum six months).
3. Set `APPLE_CLIENT_ID` (Services ID) and `APPLE_CLIENT_SECRET` (JWT) on the target Convex deployment. The backend enables Apple only when both exist. Keep both out of `VITE_*` variables.
4. Set `VITE_APPLE_AUTH_ENABLED=true` in the web build environment, then rebuild. The app already trusts Apple's callback origin and accepts its POST callback through the auth proxy.
5. Test on the registered HTTPS domain: Apple consent, returning login, Hide My Email, canceled consent, and email-link delivery/sign-in/reuse/expiry. Automated tests check local behavior; they cannot verify Apple credentials or mailbox delivery.

For Apple's private email relay addresses, register the sending domain/address with Apple's Private Email Relay service and configure its required email authentication. See [Apple's relay setup](https://developer.apple.com/help/account/capabilities/configure-private-email-relay-service/).

These changes enable web sign-in. A future native iPhone flow also needs its bundle identifier configured as an accepted Apple ID-token audience and a native callback flow.
