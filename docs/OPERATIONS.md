# Production operations

## Monitoring and alerts

Probe the public Worker route and Convex `/api/health` every minute from at least two regions. Alert when either fails twice, when p95 latency exceeds 1 second for 10 minutes, when Worker 5xx exceeds 1%, or when Convex function failures exceed 1%. Page immediately for authentication failure spikes, scheduler lag above five minutes, quota exhaustion, or a confirmed security event.

Cloudflare logs sample 10% of production invocations and 1% of traces; errors should be retained by the configured exception service. Use `npx convex logs --prod --jsonl`, the Convex Health page, and Cloudflare Workers Observability during triage. Do not log tokens, passwords, cookies, upload URLs, or file contents.

## Backup and restore

Enable Convex periodic backups with file storage in production, or schedule `npx convex export --path <timestamp>.zip` into encrypted, versioned storage. Keep at least seven daily and four weekly recovery points. Convex code, environment variables, and scheduled functions are not in data backups; preserve them through Git and an encrypted secret inventory.

Quarterly restore drill:

1. Create an isolated deployment with no public route.
2. Deploy the release matching the backup schema.
3. Import the selected ZIP with `npx convex import <backup>.zip`.
4. Verify authentication, message counts, file metadata and downloads, then record RPO/RTO and destroy the isolated deployment.

Never test restoration over production. Review destructive imports and Terraform plans with a second operator.

## Deploy, rollback, incident response

Production deploys require CI success and GitHub environment approval. After deploy, smoke-test health, email sign-in, upload/download/delete, rate limiting, and account deletion. Roll Worker code back with `wrangler versions list` and `wrangler rollback <VERSION_ID>`; redeploy the previous Convex commit after confirming schema compatibility.

For an incident: assign an incident lead, preserve request/error IDs and timelines, contain by revoking credentials or rolling back, notify affected users when required, restore service, then publish a blameless review with owners and dates. Avoid changing data until evidence and recovery options are preserved.

## Data lifecycle

The daily Convex cron removes messages after 90 days and expired upload intents. Files remain until their owner deletes them or deletes the account. Account deletion queues removal of the user's files, file metadata, messages, intents, usage record, and Better Auth identity. Review the scheduler and deletion backlog after any outage.
