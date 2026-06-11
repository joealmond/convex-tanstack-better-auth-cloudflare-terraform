# Security Policy

## Supported Versions

As a template repository, only the latest version on the `main` branch receives security fixes.

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in this template, please report it privately via [GitHub Security Advisories](https://github.com/joealmond/convex-tanstack-better-auth-cloudflare-terraform/security/advisories/new).

Include as much detail as possible:
- A description of the vulnerability and its potential impact
- Steps to reproduce (if known)
- Any suggested fixes or mitigations

You can expect an acknowledgement within **48 hours** and a status update within **7 days**.

## Security Considerations for Deployments

When using this template in production, ensure you:

1. **Set a strong `BETTER_AUTH_SECRET`** — generate with `openssl rand -base64 32`
2. **Restrict `ADMIN_EMAILS`** in `convex/lib/config.ts` to only trusted addresses
3. **Enable Convex rate limiting** — already configured in `convex/lib/services/rateLimitService.ts`
4. **Review Cloudflare WAF rules** — the Terraform config provides a starting point
5. **Rotate secrets regularly** and never commit `.env.local` files

## Scope

This is a template repository. Security reports about vulnerabilities in the template's own code (auth flows, Convex functions, Cloudflare config) are in scope. Vulnerabilities in upstream dependencies should be reported to those projects directly.
