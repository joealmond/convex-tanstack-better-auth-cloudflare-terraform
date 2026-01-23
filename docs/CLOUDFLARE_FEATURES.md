# Cloudflare Features Guide

This template includes Terraform configuration for many Cloudflare features, all in the **free tier**.

## Free Tier Limits

| Feature | Free Limit | Included |
|---------|------------|----------|
| **Workers** | 100k requests/day | ✅ Core |
| **KV** | 100k reads, 1k writes/day | Optional |
| **R2 Storage** | 10GB, 10M reads/month | Optional |
| **Turnstile** | Unlimited | Optional |
| **Rate Limiting** | 10 rules | Optional |
| **Cache Rules** | Unlimited | Optional |
| **Security Headers** | Unlimited | Optional |
| **Web Analytics** | Unlimited | Optional |
| **DDoS Protection** | Always on | ✅ Automatic |

---

## Enabling Features

Edit `terraform.tfvars`:

```hcl
# Production recommended
enable_turnstile        = true
enable_rate_limiting    = true   # Requires custom domain
enable_security_headers = true   # Requires custom domain  
enable_cache_rules      = true   # Requires custom domain
enable_analytics        = true   # Requires custom domain
```

Then apply:
```bash
terraform plan
terraform apply
```

---

## Feature Details

### Turnstile (Bot Protection)

**What**: CAPTCHA alternative that's invisible to most users.

**Enable**:
```hcl
enable_turnstile  = true
turnstile_domains = ["localhost", "your-domain.com"]
```

**After applying**, get your keys:
```bash
terraform output turnstile_site_key
terraform output turnstile_secret_key
```

**Frontend integration**:
```tsx
// Install: npm install @marsidev/react-turnstile

import { Turnstile } from '@marsidev/react-turnstile'

function LoginForm() {
  const [token, setToken] = useState('')
  
  return (
    <form>
      {/* Your form fields */}
      <Turnstile
        siteKey="YOUR_SITE_KEY"
        onSuccess={(token) => setToken(token)}
      />
      <button type="submit">Login</button>
    </form>
  )
}
```

**Backend verification**:
```ts
// In your Convex mutation or API route
const verifyTurnstile = async (token: string) => {
  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY!,
        response: token,
      }),
    }
  )
  const data = await response.json()
  return data.success
}
```

---

### R2 Storage

**What**: S3-compatible object storage at the edge.

**When to use**:
- Large files (videos, large images)
- Public assets that don't need auth
- CDN for static content

**When to use Convex storage instead**:
- User files tied to authentication
- Files that need real-time sync
- Simpler integration

**Enable**:
```hcl
enable_r2_storage = true
```

**Usage in Workers**:
```ts
// In your Worker
export default {
  async fetch(request, env) {
    // Upload
    await env.R2_BUCKET.put('key', 'value')
    
    // Download
    const object = await env.R2_BUCKET.get('key')
    
    // Delete
    await env.R2_BUCKET.delete('key')
  }
}
```

**Add binding to wrangler.jsonc**:
```jsonc
{
  "r2_buckets": [
    {
      "binding": "R2_BUCKET",
      "bucket_name": "convex-tanstack-cf-production-storage"
    }
  ]
}
```

---

### Rate Limiting

**What**: Protect auth endpoints from brute force attacks.

**Default rules**:
1. `/api/auth/*` - 10 requests/minute per IP
2. `/api/auth/sign-in/*` - 5 requests/5 minutes per IP (stricter)

**Blocked users** see a Cloudflare error page for:
- 10 minutes (general auth)
- 1 hour (login attempts)

**Enable**:
```hcl
enable_rate_limiting = true  # Requires custom domain
```

**Customize** in `main.tf`:
```hcl
requests_per_period = 20     # Allow more requests
period              = 120    # Per 2 minutes
mitigation_timeout  = 300    # Block for 5 minutes
```

---

### Security Headers

**What**: HTTP headers that protect against common attacks.

**Headers added**:
| Header | Value | Protects Against |
|--------|-------|------------------|
| X-Content-Type-Options | nosniff | MIME sniffing |
| X-Frame-Options | DENY | Clickjacking |
| Referrer-Policy | strict-origin-when-cross-origin | Referrer leaks |
| Permissions-Policy | geolocation=(), etc. | Feature abuse |

**Enable**:
```hcl
enable_security_headers = true  # Requires custom domain
```

---

### Cache Rules

**What**: Cache static assets at Cloudflare's edge for faster loading.

**Default caching**:
- JS, CSS, images, fonts, icons
- Edge TTL: 1 day
- Browser TTL: 1 hour

**Enable**:
```hcl
enable_cache_rules = true  # Requires custom domain
```

---

### Web Analytics

**What**: Privacy-friendly, GDPR-compliant analytics.

**Features**:
- No cookies
- No personal data
- Page views, visitors, countries
- Core Web Vitals

**Enable**:
```hcl
enable_analytics = true  # Requires custom domain
```

**View**: Cloudflare Dashboard → Analytics → Web Analytics

---

### DDoS Protection

**What**: Automatic protection against DDoS attacks.

**Status**: **Always ON** for all Cloudflare sites. No configuration needed!

**Features**:
- Layer 3/4/7 protection
- Automatic mitigation
- No impact on legitimate traffic

---

## Requirement: Custom Domain

Some features require a custom domain because they work at the DNS/zone level:

| Feature | workers.dev | Custom Domain |
|---------|-------------|---------------|
| Workers | ✅ | ✅ |
| KV | ✅ | ✅ |
| R2 | ✅ | ✅ |
| Turnstile | ✅ | ✅ |
| Rate Limiting | ❌ | ✅ |
| Security Headers | ❌ | ✅ |
| Cache Rules | ❌ | ✅ |
| Analytics | ❌ | ✅ |
| DDoS | ✅ | ✅ |

**To add a custom domain**:
1. Add domain to Cloudflare
2. Update nameservers at your registrar
3. Configure in terraform.tfvars:
```hcl
custom_domain      = "example.com"
custom_subdomain   = "app"           # or "" for apex
cloudflare_zone_id = "your-zone-id"  # From Cloudflare dashboard
```

---

## API Token Permissions

Your Cloudflare API token needs these permissions:

**Account level**:
- Workers Scripts: Edit
- Workers KV Storage: Edit (if using KV)
- Workers R2 Storage: Edit (if using R2)
- Turnstile: Edit (if using Turnstile)

**Zone level** (if using custom domain):
- DNS: Edit
- Cache Rules: Edit
- Rate Limiting: Edit
- Transform Rules: Edit (for security headers)
- Analytics: Read (if using analytics)
