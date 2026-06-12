# Security Policy

## Supported Versions

ConvexKit is a starter template. Security fixes are applied to the `main` branch and released through normal repository updates.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| Older forks | No |

## Reporting A Vulnerability

Please do not open a public issue for suspected vulnerabilities.

Report security concerns by emailing the repository maintainer or opening a private security advisory on GitHub if advisories are enabled for the repository.

Include:

- A short description of the issue
- Steps to reproduce or a proof of concept
- Affected files, routes, Convex functions, or deployment settings
- Any known impact or mitigation

We aim to acknowledge valid reports within 72 hours and will coordinate a fix before public disclosure when appropriate.

## Security Expectations

When contributing security-sensitive changes:

- Keep secrets out of source control
- Use Convex validators for all Convex function arguments
- Use `ConvexError` for user-facing failures
- Prefer server-side calls for third-party APIs and credentials
- Update docs when environment variables or deployment assumptions change
