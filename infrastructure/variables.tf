# =============================================================================
# Required Variables
# =============================================================================

variable "cloudflare_api_token" {
  description = "Cloudflare API token with Workers edit permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "worker_name" {
  description = "Name of the Cloudflare Worker"
  type        = string
  default     = "convex-tanstack-cf-production"
}

# =============================================================================
# Convex Configuration
# =============================================================================

variable "convex_url" {
  description = "Convex deployment URL (e.g., https://xxx.convex.cloud)"
  type        = string
}

variable "convex_site_url" {
  description = "Convex site URL for HTTP actions (e.g., https://xxx.convex.site)"
  type        = string
}

# =============================================================================
# Better Auth Configuration
# =============================================================================

variable "better_auth_secret" {
  description = "Secret for Better Auth (generate with: openssl rand -base64 32)"
  type        = string
  sensitive   = true
}

variable "site_url" {
  description = "Your application URL (for auth redirects)"
  type        = string
}

variable "google_client_id" {
  description = "Google OAuth client ID"
  type        = string
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  sensitive   = true
}

# =============================================================================
# Custom Domain (Optional but required for some features)
# =============================================================================

variable "custom_domain" {
  description = "Custom domain for the worker (leave empty to use workers.dev)"
  type        = string
  default     = ""
}

variable "custom_subdomain" {
  description = "Subdomain for the worker (leave empty for apex domain)"
  type        = string
  default     = ""
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID (required if using custom domain or zone features)"
  type        = string
  default     = ""
}

# =============================================================================
# Storage & Caching (Free Tier)
# =============================================================================

variable "enable_kv_cache" {
  description = "Enable Cloudflare KV namespace for caching (100k reads/day free)"
  type        = bool
  default     = false
}

variable "enable_r2_storage" {
  description = "Enable R2 bucket for file storage (10GB free)"
  type        = bool
  default     = false
}

# =============================================================================
# Security Features (Free Tier)
# =============================================================================

variable "enable_turnstile" {
  description = "Enable Turnstile CAPTCHA widget for bot protection (unlimited free)"
  type        = bool
  default     = false
}

variable "turnstile_domains" {
  description = "Domains allowed for Turnstile (e.g., ['example.com', 'localhost'])"
  type        = list(string)
  default     = ["localhost"]
}

variable "enable_rate_limiting" {
  description = "Enable rate limiting on auth endpoints (free tier)"
  type        = bool
  default     = false
}

variable "enable_security_headers" {
  description = "Add security headers (X-Frame-Options, etc.)"
  type        = bool
  default     = false
}

# =============================================================================
# Performance & Analytics (Free Tier)
# =============================================================================

variable "enable_cache_rules" {
  description = "Enable cache rules for static assets"
  type        = bool
  default     = false
}

variable "enable_analytics" {
  description = "Enable Cloudflare Web Analytics (free, privacy-friendly)"
  type        = bool
  default     = false
}
