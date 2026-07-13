# Privacy implementation notes

This starter processes account name and email, authentication/session records, user messages, uploaded files and metadata, basic request security data, and sampled operational telemetry. Replace this note with counsel-approved public terms and privacy notice before collecting real user data.

Document the controller, purposes, legal bases, processors (at minimum Cloudflare, Convex, the configured OAuth/email provider, and observability vendors), regions, retention, user rights, and contact method. Collect only fields the product uses. Do not put personal data in analytics events or logs.

Users can delete individual files/messages and can permanently delete their account from the authenticated chat header. Production support needs a verified process for access, correction, export, and deletion requests, including processor-side and backup handling. Record request completion without retaining the deleted content.

Current application retention is 90 days for messages, 15 minutes for active upload intents (expired intents are purged daily), and user-controlled retention for files and accounts. Infrastructure logs and backups must have separately documented retention matching the configured vendors.
