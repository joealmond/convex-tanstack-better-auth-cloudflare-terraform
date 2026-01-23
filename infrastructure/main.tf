terraform {
  required_version = ">= 1.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 4.0, < 5.0"  # Pin to v4.x for stability
    }
  }

  # Uncomment for remote state management
  # backend "s3" {
  #   bucket = "your-terraform-state"
  #   key    = "convex-tanstack-cloudflare/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# =============================================================================
# IMPORTANT: Deploy your worker FIRST before applying this config!
# Run: npm run deploy (or wrangler deploy)
# Then: terraform apply
#
# The worker secrets and routes require an existing worker.
# =============================================================================

# =============================================================================
# KV Namespace (Optional - for caching/session storage)
# =============================================================================

resource "cloudflare_workers_kv_namespace" "cache" {
  count      = var.enable_kv_cache ? 1 : 0
  account_id = var.cloudflare_account_id
  title      = "${var.worker_name}-cache"
}

# =============================================================================
# R2 Bucket (Optional - for file storage)
# Free: 10GB storage, 10M reads, 1M writes/month
# =============================================================================

resource "cloudflare_r2_bucket" "storage" {
  count      = var.enable_r2_storage ? 1 : 0
  account_id = var.cloudflare_account_id
  name       = "${var.worker_name}-storage"
  location   = "WNAM"  # Western North America, or ENAM, WEUR, EEUR, APAC
}

# =============================================================================
# Turnstile Widget (Bot Protection - FREE)
# Use on login, signup, and forms
# =============================================================================

resource "cloudflare_turnstile_widget" "main" {
  count      = var.enable_turnstile ? 1 : 0
  account_id = var.cloudflare_account_id
  name       = var.worker_name
  domains    = var.turnstile_domains
  mode       = "managed"  # managed, non-interactive, or invisible
}

# =============================================================================
# Custom Domain (Optional)
# =============================================================================

resource "cloudflare_record" "worker_cname" {
  count   = var.custom_domain != "" ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = var.custom_subdomain != "" ? var.custom_subdomain : "@"
  content = "${var.worker_name}.${var.cloudflare_account_id}.workers.dev"
  type    = "CNAME"
  proxied = true
  ttl     = 1

  lifecycle {
    create_before_destroy = true
  }
}

# =============================================================================
# Worker Secrets
# NOTE: Secrets are better managed via wrangler.jsonc or wrangler CLI:
#   wrangler secret put SECRET_NAME
# This avoids Terraform state containing sensitive values.
#
# If you prefer Terraform, uncomment below AFTER deploying the worker:
# =============================================================================

# resource "cloudflare_worker_secret" "convex_url" {
#   account_id  = var.cloudflare_account_id
#   script_name = var.worker_name
#   name        = "VITE_CONVEX_URL"
#   secret_text = var.convex_url
# }

# resource "cloudflare_worker_secret" "better_auth_secret" {
#   account_id  = var.cloudflare_account_id
#   script_name = var.worker_name
#   name        = "BETTER_AUTH_SECRET"
#   secret_text = var.better_auth_secret
# }

# resource "cloudflare_worker_secret" "site_url" {
#   account_id  = var.cloudflare_account_id
#   script_name = var.worker_name
#   name        = "SITE_URL"
#   secret_text = var.site_url
# }

# resource "cloudflare_worker_secret" "google_client_id" {
#   account_id  = var.cloudflare_account_id
#   script_name = var.worker_name
#   name        = "GOOGLE_CLIENT_ID"
#   secret_text = var.google_client_id
# }

# resource "cloudflare_worker_secret" "google_client_secret" {
#   account_id  = var.cloudflare_account_id
#   script_name = var.worker_name
#   name        = "GOOGLE_CLIENT_SECRET"
#   secret_text = var.google_client_secret
# }

# =============================================================================
# Cache Rules (FREE - replaces Page Rules)
# NOTE: Uncomment if you have a custom domain configured
# =============================================================================

# resource "cloudflare_ruleset" "cache_rules" {
#   count   = var.custom_domain != "" && var.enable_cache_rules ? 1 : 0
#   zone_id = var.cloudflare_zone_id
#   name    = "Cache Rules"
#   kind    = "zone"
#   phase   = "http_request_cache_settings"
#
#   rules {
#     action = "set_cache_settings"
#     action_parameters {
#       cache = true
#       edge_ttl {
#         mode    = "override_origin"
#         default = 86400
#       }
#       browser_ttl {
#         mode    = "override_origin"
#         default = 3600
#       }
#     }
#     expression  = "(http.request.uri.path matches \".*\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$\")"
#     description = "Cache static assets"
#     enabled     = true
#   }
# }

# =============================================================================
# Rate Limiting (FREE tier: 10 rules)
# NOTE: Uncomment if you have a custom domain configured
# =============================================================================

# resource "cloudflare_ruleset" "rate_limiting" {
#   count   = var.custom_domain != "" && var.enable_rate_limiting ? 1 : 0
#   zone_id = var.cloudflare_zone_id
#   name    = "Rate Limiting"
#   kind    = "zone"
#   phase   = "http_ratelimit"
#
#   rules {
#     action = "block"
#     ratelimit {
#       characteristics     = ["ip.src"]
#       period              = 60
#       requests_per_period = 10
#       mitigation_timeout  = 600
#     }
#     expression  = "(http.request.uri.path contains \"/api/auth\")"
#     description = "Rate limit auth endpoints"
#     enabled     = true
#   }
# }

# =============================================================================
# Security Headers (FREE)
# NOTE: Uncomment if you have a custom domain configured
# =============================================================================

# resource "cloudflare_ruleset" "security_headers" {
#   count   = var.custom_domain != "" && var.enable_security_headers ? 1 : 0
#   zone_id = var.cloudflare_zone_id
#   name    = "Security Headers"
#   kind    = "zone"
#   phase   = "http_response_headers_transform"
#
#   rules {
#     action = "rewrite"
#     action_parameters {
#       headers {
#         name      = "X-Content-Type-Options"
#         operation = "set"
#         value     = "nosniff"
#       }
#       headers {
#         name      = "X-Frame-Options"
#         operation = "set"
#         value     = "DENY"
#       }
#     }
#     expression  = "true"
#     description = "Add security headers"
#     enabled     = true
#   }
# }

# =============================================================================
# Web Analytics (FREE)
# =============================================================================

resource "cloudflare_web_analytics_site" "main" {
  count        = var.enable_analytics && var.custom_domain != "" ? 1 : 0
  account_id   = var.cloudflare_account_id
  zone_tag     = var.cloudflare_zone_id
  auto_install = true
}

# =============================================================================
# DDoS Protection
# NOTE: Basic DDoS protection is ALWAYS ON for all Cloudflare sites (FREE)
# No Terraform config needed - it's automatic!
# =============================================================================
