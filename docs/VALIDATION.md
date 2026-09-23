# Validation and releases

Cloudflare Workers with Better Auth is the default release path. Keep that path working before
adding new providers or examples. Build validation does not replace a deployed authentication test.

## Automated checks

- `npm run check`: formatting, lint, coverage gates, CLI composition, setup tests, typecheck,
  dependency audit, app build, and docs build.
- `npm run test:e2e:public`: public catalog rendering, security headers, and form submission. The chat homepage needs a real backend and is covered by the live smoke.
- `npm run test:e2e:local-auth`: generate a fresh default app, install its dependencies, initialize
  an anonymous local Convex backend, and verify signup, reload/session persistence, sign-out,
  sign-in, chat, and upload in Chromium. No Convex account or cloud credentials are needed.
  Run `npx playwright install chromium` first. The runner uses temporary directories and ports,
  stops its servers, and removes successful runs. It requires macOS or Linux and internet access
  for dependencies and Convex's backend binary. CI runs it after the public smoke.
- `npm run test:scaffold -- better-auth cloudflare all`: create a separate app in a temporary
  directory, install its own dependencies, generate routes, lint, test, typecheck, build, audit,
  and perform a Worker deployment dry run. No cloud resources are deployed.
- CI repeats generated-app checks for both auth providers, each of the three targets, and
  `all`/`none` examples. It also checks each individual example with Better Auth + Cloudflare.
- The Deploy workflow always runs a read-only smoke against the selected public app and Convex
  health endpoint. Run `E2E_RUN_AUTH=true E2E_BASE_URL=https://your-preview-host npm run test:e2e:auth`
  separately on a disposable preview backend when live authenticated verification is needed;
  it creates account, message, and file data.
- Account-email tests use a fake Resend response to complete sign-up verification, password
  reset, and confirmed account deletion. Before the first public production release, repeat
  those clicks on a protected preview deployment with a disposable inbox. CI does not send live
  account email.
- Account export tests page through more than 100 owned records, check every included feature
  table, and embed selected file bytes without retaining signed download URLs in the exported JSON.

The matrix covers representative boundaries, not every feature subset. When a composition bug
is reported, add its exact selection as a regression case. Temporary failures retain their logs
at the path printed by the validation script; successful cases are removed.

## First-run usability session

Before calling onboarding complete, ask three developers unfamiliar with ConvexKit to use the
README without coaching. Use fresh directories and disposable backend projects.

1. Record the release, Node version, selected providers/examples, and starting time.
2. Run the documented create, setup, and development commands.
3. Sign up, send a message, reload, and confirm the session persists.
4. Deploy a preview and repeat the sign-in/message/upload flow there.
5. Record time to local success and deployed success separately, every confusing prompt, and
   every manual correction. Never record credentials.

| Release | Platform / Node | Selection | Local success | Preview success | Friction / issue |
| ------- | --------------- | --------- | ------------- | --------------- | ---------------- |
| Pending |                 |           |               |                 |                  |

The under-five-minute local setup goal is a target to measure, not a verified result. The local
backend smoke passed during the September 2026 stack update. Deployed preview verification and
human sessions still need to be recorded separately; local automation does not substitute for them.

## Release contract

The published CLI defaults to `create-convexkit-v<its package version>`. Publish from that tag;
the publish workflow verifies the tag and checkout and validates the default generated app.
Protect release tags from updates/deletion. Never use a moving branch as the published default.

Direct package versions and the repository lockfile define the tested base stack. Composition
can change the dependency graph, so commit each generated app's resulting lockfile and use
`npm ci` for subsequent installs. Upgrading the generator does not modify existing apps.

`--template-ref main` is an explicit development opt-in. No tag is created or npm package
published merely by running local validation.
