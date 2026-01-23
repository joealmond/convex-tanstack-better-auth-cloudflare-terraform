# G-Matrix Deployment Guide

Complete deployment instructions for G-Matrix on Cloudflare Workers.

## Prerequisites

- Node.js >= 22.0.0
- npm or pnpm
- Cloudflare account (free tier works)
- Google Cloud Console account (for OAuth)
- Convex account (free tier: https://convex.dev)

## Part 1: Convex Setup

### 1. Create Convex Project

```bash
# Login to Convex
npx convex login

# Initialize Convex in development
npx convex dev
```

Follow the prompts to:
- Create a new project or select existing
- Name your project (e.g., "g-matrix-prod")
- Choose deployment settings

### 2. Deploy Convex to Production

```bash
# Deploy functions and schema to production
npx convex deploy --prod
```

After deployment, you'll get a production URL like:
```
https://your-project-name.convex.cloud
```

Save this URL for environment configuration.

### 3. Set Up Admin User

After first login with Google OAuth:

1. Go to Convex dashboard: https://dashboard.convex.dev
2. Select your project
3. Open "Data" tab → "profiles" table
4. Find your user by email
5. Click "Edit" and add/set:
   ```json
   {
     "isAdmin": true
   }
   ```

## Part 2: Google OAuth Setup

### 1. Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Navigate to "APIs & Services" → "Credentials"
4. Click "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure OAuth consent screen if not done:
   - User Type: External
   - App name: G-Matrix
   - Support email: your-email@example.com
   - Scopes: email, profile (openid is automatic)

### 2. Configure OAuth Client

- Application type: **Web application**
- Name: G-Matrix Production
- Authorized redirect URIs:
  ```
  https://your-domain.com/api/auth/callback/google
  ```
  
  For development, also add:
  ```
  http://localhost:3000/api/auth/callback/google
  ```

### 3. Save Credentials

Copy the Client ID and Client Secret - you'll need these for environment variables.

## Part 3: Cloudflare Workers Setup

### 1. Install Wrangler CLI

```bash
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### 2. Configure wrangler.jsonc

Verify your `wrangler.jsonc` has:

```jsonc
{
  "name": "g-matrix",
  "compatibility_date": "2025-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "main": "@tanstack/react-start/server-entry",
  "minify": true,
  "assets": {
    "directory": ".output/public",
    "binding": "ASSETS"
  }
}
```

### 3. Set Environment Variables

**Option A: Via Wrangler CLI (Recommended)**

```bash
# Production Convex URL
wrangler secret put VITE_CONVEX_URL
# Enter: https://your-project.convex.cloud

# Better Auth secret (generate with: openssl rand -base64 32)
wrangler secret put BETTER_AUTH_SECRET
# Enter: your-generated-secret

# Better Auth URL (your production domain)
wrangler secret put BETTER_AUTH_URL
# Enter: https://your-domain.com

# Google OAuth credentials
wrangler secret put GOOGLE_CLIENT_ID
# Enter: your-client-id.apps.googleusercontent.com

wrangler secret put GOOGLE_CLIENT_SECRET
# Enter: your-google-client-secret
```

**Option B: Via Cloudflare Dashboard**

1. Go to Cloudflare Workers dashboard
2. Select your worker
3. Go to "Settings" → "Variables"
4. Add each environment variable as "Secret"

## Part 4: Build and Deploy

### 1. Build for Production

```bash
# Install dependencies
npm install

# Build optimized bundle
npm run build
```

This creates `.output/` directory with:
- `client/` - Static assets
- `server/` - Worker entry point

### 2. Deploy to Cloudflare

```bash
# Deploy to production
wrangler deploy
```

You'll get a URL like:
```
https://g-matrix.your-subdomain.workers.dev
```

### 3. Add Custom Domain (Optional)

1. Go to Cloudflare dashboard → Workers & Pages
2. Select your worker (g-matrix)
3. Go to "Settings" → "Domains & Routes"
4. Click "Add Custom Domain"
5. Enter your domain (e.g., g-matrix.yourdomain.com)
6. Cloudflare will automatically configure DNS

Update OAuth redirect URI in Google Console:
```
https://g-matrix.yourdomain.com/api/auth/callback/google
```

And update `BETTER_AUTH_URL`:
```bash
wrangler secret put BETTER_AUTH_URL
# Enter: https://g-matrix.yourdomain.com
```

## Part 5: Seed Data (Optional)

Populate initial products:

```bash
# Run seed script
npx convex run seed:seedProducts
```

This adds 12 sample gluten-free products across all quadrants.

## Part 6: Verification

### 1. Test Production Deployment

1. Visit your production URL
2. Verify home page loads with matrix chart
3. Test anonymous voting (should work without login)
4. Click "Sign In" → test Google OAuth
5. After login, test:
   - Registered voting (2x weight)
   - Profile page (points, badges)
   - Leaderboard
   - Product detail pages
6. Login as admin user:
   - Visit `/admin`
   - Test adding/editing/deleting products

### 2. Monitor Performance

**Convex Dashboard:**
- Real-time function calls
- Database queries
- Error logs

**Cloudflare Dashboard:**
- Request volume
- Response times
- Error rates
- Bandwidth usage

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_CONVEX_URL` | Convex production deployment URL | `https://your-project.convex.cloud` |
| `BETTER_AUTH_SECRET` | Auth encryption secret (32+ chars) | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Your production app URL | `https://g-matrix.yourdomain.com` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | `GOCSPX-xxx` |

## Troubleshooting

### Issue: "Failed to fetch" on API calls

**Solution:** Check CORS settings in Convex. Add to `convex/http.ts`:

```typescript
http.route({
  path: "/api/auth/*",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    // ... existing code
  })
});
```

### Issue: OAuth redirect fails

**Solution:**
1. Verify redirect URI in Google Console matches exactly
2. Check `BETTER_AUTH_URL` is set correctly
3. Ensure no trailing slashes

### Issue: Admin routes return 401

**Solution:**
1. Check Convex profiles table - user has `isAdmin: true`
2. Clear browser cache and cookies
3. Re-login to refresh session

### Issue: Rate limiter errors

**Solution:**
1. Verify `@convex-dev/rate-limiter` is installed
2. Check Convex function logs for detailed errors
3. Increase rate limit in `convex/votes.ts` if needed

### Issue: Worker deployment fails

**Solution:**
1. Verify `nodejs_compat` flag in wrangler.jsonc
2. Check build output in `.output/`
3. Run `wrangler tail` to see live logs

## Rollback Strategy

### Convex Rollback

Convex deployments are versioned:

```bash
# View deployment history
npx convex deployments

# Rollback to previous version
npx convex rollback <deployment-id>
```

### Cloudflare Rollback

Workers maintain version history:

1. Go to Cloudflare dashboard
2. Select worker → "Deployments"
3. Click "Rollback" on previous version

## Monitoring & Analytics

### Recommended Tools

- **Sentry**: Error tracking (add `@sentry/node`)
- **Cloudflare Analytics**: Built-in, no setup needed
- **Convex Logs**: Real-time function monitoring
- **Google Analytics**: User behavior tracking

### Health Checks

Add to monitoring:

```
https://your-domain.com/          # Should return 200
https://your-domain.com/admin     # Should return 200 or 401
https://your-domain.com/api/auth  # Should return auth response
```

## Scaling Considerations

### Cloudflare Workers

- Free tier: 100,000 requests/day
- Paid tier: $5/month for 10M requests
- Auto-scales globally

### Convex

- Free tier: 1GB storage, 1M function calls/month
- Paid tier: $25/month for more resources
- Auto-scales with load

### Rate Limiting

Current: 10 votes/minute per user

To adjust, edit `convex/votes.ts`:

```typescript
const rateLimit = await rateLimiter.limit(ctx, "vote", {
  key: userId,
  rate: 10,  // <- Change this
  period: 60000, // 1 minute
});
```

## Security Checklist

- [ ] `BETTER_AUTH_SECRET` is strong (32+ characters)
- [ ] Google OAuth credentials are kept secret
- [ ] Convex deployment is in production mode
- [ ] Admin users are manually verified
- [ ] Rate limiting is enabled
- [ ] HTTPS is enforced (automatic on Cloudflare)
- [ ] Environment variables are not committed to git

## Cost Estimate (Free Tier)

- Cloudflare Workers: **Free** (100k requests/day)
- Convex: **Free** (1M calls/month, 1GB storage)
- Google OAuth: **Free**

**Total**: $0/month for moderate traffic

Paid tier needed when:
- > 100k requests/day (Cloudflare: $5/month)
- > 1M Convex calls/month (Convex: $25/month)

## Post-Deployment

1. Monitor error logs for first 24 hours
2. Test all features in production
3. Seed initial products via `/admin`
4. Share link with community for testing
5. Gather feedback and iterate

---

**Deployment complete! 🎉**

For support, check:
- [Convex Docs](https://docs.convex.dev)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [TanStack Start Docs](https://tanstack.com/start)
