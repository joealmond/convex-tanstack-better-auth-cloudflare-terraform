# Terraform Infrastructure

This directory contains Terraform configuration for deploying the Cloudflare Worker and managing secrets.

## Prerequisites

1. [Terraform](https://terraform.io) installed
2. Cloudflare account with Workers enabled
3. Cloudflare API token with these permissions:
   - Account: Workers Scripts:Edit
   - Account: Account Settings:Read
   - Zone: DNS:Edit (only if using custom domain)

## Setup

### 1. Copy Example Variables

```bash
cp terraform.tfvars.example terraform.tfvars
```

### 2. Fill in Variables

Edit `terraform.tfvars` with your values. Required:

- `cloudflare_api_token` - [Create here](https://dash.cloudflare.com/profile/api-tokens)
- `cloudflare_account_id` - From dashboard
- `convex_url` - From `npx convex dev`
- `convex_site_url` - Usually same as convex_url but with `.site`
- `better_auth_secret` - Generate with `openssl rand -base64 32`
- `site_url` - Your app's URL (workers.dev or custom domain)
- `google_client_id` / `google_client_secret` - From Google Cloud Console

### 3. Initialize and Apply

```bash
terraform init
terraform plan    # Review changes
terraform apply   # Apply changes
```

## Custom Domain (Optional)

To use a custom domain instead of `*.workers.dev`:

1. Add your domain to Cloudflare (if not already)
2. Get the Zone ID from the domain's overview page
3. Uncomment and fill in `terraform.tfvars`:

```hcl
custom_domain      = "example.com"
custom_subdomain   = "app"        # For app.example.com, or "" for apex
cloudflare_zone_id = "your-zone-id"
```

## What This Creates

- Worker secrets (Convex URL, auth secrets, OAuth credentials)
- (Optional) DNS record for custom domain
- (Optional) Worker route for custom domain

**Note:** This does NOT deploy the worker code itself. The worker is deployed via:
- `npm run deploy:prod` locally
- GitHub Actions on push to main
- `./scripts/deploy.sh`

## State Management

By default, Terraform stores state locally. For production:

1. Use Terraform Cloud (uncomment backend in `main.tf`)
2. Or use S3/GCS backend
3. Never commit `terraform.tfstate` to version control
