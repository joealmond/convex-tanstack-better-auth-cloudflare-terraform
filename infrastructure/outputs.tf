output "worker_url" {
  description = "URL of the deployed Cloudflare Worker"
  value       = "https://${var.worker_name}.${var.cloudflare_account_id}.workers.dev"
}

output "custom_domain_url" {
  description = "Custom domain URL (if configured)"
  value = var.custom_domain != "" ? (
    var.custom_subdomain != "" 
      ? "https://${var.custom_subdomain}.${var.custom_domain}" 
      : "https://${var.custom_domain}"
  ) : null
}

output "oauth_redirect_uri" {
  description = "Configure this redirect URI in Google Cloud Console"
  value       = "${var.site_url}/api/auth/callback/google"
}

# =============================================================================
# Storage Outputs
# =============================================================================

output "kv_namespace_id" {
  description = "KV namespace ID for caching (if enabled)"
  value       = var.enable_kv_cache ? cloudflare_workers_kv_namespace.cache[0].id : null
}

output "r2_bucket_name" {
  description = "R2 bucket name for file storage (if enabled)"
  value       = var.enable_r2_storage ? cloudflare_r2_bucket.storage[0].name : null
}

# =============================================================================
# Security Outputs
# =============================================================================

output "turnstile_site_key" {
  description = "Turnstile site key for frontend (if enabled)"
  value       = var.enable_turnstile ? cloudflare_turnstile_widget.main[0].id : null
}

output "turnstile_secret_key" {
  description = "Turnstile secret key for backend verification (if enabled)"
  value       = var.enable_turnstile ? cloudflare_turnstile_widget.main[0].secret : null
  sensitive   = true
}

# =============================================================================
# Feature Summary
# =============================================================================

output "enabled_features" {
  description = "Summary of enabled Cloudflare features"
  value = {
    kv_cache         = var.enable_kv_cache
    r2_storage       = var.enable_r2_storage
    turnstile        = var.enable_turnstile
    rate_limiting    = var.enable_rate_limiting
    security_headers = var.enable_security_headers
    cache_rules      = var.enable_cache_rules
    analytics        = var.enable_analytics
    custom_domain    = var.custom_domain != ""
    ddos_protection  = true  # Always on for free!
  }
}

output "setup_instructions" {
  description = "Next steps after Terraform apply"
  value       = <<-EOT
    
    ✅ Infrastructure provisioned!
    
    ${var.enable_turnstile ? "🔐 Turnstile enabled! Add site key to your frontend forms." : ""}
    ${var.enable_r2_storage ? "📦 R2 bucket created: ${var.worker_name}-storage" : ""}
    ${var.enable_rate_limiting ? "🛡️ Rate limiting active on /api/auth/*" : ""}
    ${var.enable_security_headers ? "🔒 Security headers configured" : ""}
    ${var.enable_cache_rules ? "⚡ Static asset caching enabled" : ""}
    
    Next steps:
    1. Deploy the worker: npm run deploy:prod
    2. Configure OAuth redirect: ${var.site_url}/api/auth/callback/google
    ${var.enable_turnstile ? "3. Add Turnstile to login form (see docs/CLOUDFLARE_FEATURES.md)" : ""}
    
    🛡️ DDoS protection is ALWAYS ON (free)!
    
  EOT
}
