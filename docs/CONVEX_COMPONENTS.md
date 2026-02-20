# Recommended Convex Components

Convex Components are independent, modular, TypeScript building blocks that drop right into your backend. For a full list of components, check out the [Convex Components Directory](https://www.convex.dev/components).

Here are the most useful components we recommend adopting for any production-grade application built with this template:

## 1. Core Utilities

### Action Retrier (`@convex-dev/retrier`)
Add reliability to unreliable external services (like webhooks, AI APIs, or email providers). Retries idempotent calls a set number of times with exponential backoff.
- **Use Case**: Push notifications, webhooks, OpenAI calls, or any third-party API.
- **Why it matters**: Serverless functions can fail due to network blips. A retrier ensures your app handles these gracefully without manual intervention.

### Geospatial (`@convex-dev/geospatial`)
Efficiently query points on a map within a selected region of the globe.
- **Use Case**: "Find products near me", store locators, location-based feeds.
- **Why it matters**: Doing distance math in client code or scanning all rows is slow. This component natively indexes Geohashes for lightning-fast radius searches directly in the database.

## 2. File Storage & CDNs

### ConvexFS (`@convex-dev/convex-fs`)
A powerful, globally distributed file storage and serving component natively integrated with Bunny.net.
- **Use Case**: Heavy image delivery, video hosting, profile avatars.
- **Why it matters**: Removes all the boilerplate of setting up a custom Cloudflare R2 bucket and CDN. 

### Files Control (`@convex-dev/files-control`)
Secure file uploads, access control, download grants, and lifecycle cleanup.
- **Use Case**: Internal document uploads, private PDFs, controlled access images.
- **Why it matters**: If you don't need a global CDN like ConvexFS, this is the perfect default for adding permissions and automatic cleanups to native Convex Storage.

## 3. Product & SaaS Features

### Stripe (`@convex-dev/stripe`)
Integrates Stripe payments, subscriptions, and billing into your Convex application.
- **Use Case**: Pro tiers, paywalls, e-commerce.
- **Why it matters**: Syncs Stripe webhook events directly to your database, meaning you can do `await userHasSubscription(ctx)` synchronously without API calls.

### Resend (`@convex-dev/resend`)
Send reliable transactional emails to your users.
- **Use Case**: Welcome emails, password resets, notification digests.
- **Why it matters**: Encapsulates the Resend SDK and tracks email statuses within Convex.

## 4. Community & UX

### Presence (`@convex-dev/presence`)
Track user presence in real-time.
- **Use Case**: "Who's online", "user is typing...", live cursors.
- **Why it matters**: Built-in heartbeat mechanics mean you don't have to write your own complex timestamp-diff logic.

### Database Chat (`@convex-dev/database-chat`)
Lets users ask questions about your data in plain English.
- **Use Case**: Internal admin dashboards, analytics pages.
- **Why it matters**: Instantly provides natural language querying capabilities over your data without writing complex SQL/Convex queries yourself.
