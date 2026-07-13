output "kv_namespace_id" {
  description = "Optional KV namespace ID to add to wrangler.jsonc if the app uses it"
  value       = var.enable_kv_cache ? cloudflare_workers_kv_namespace.cache[0].id : null
}

output "r2_bucket_name" {
  description = "Optional R2 bucket name to add to wrangler.jsonc if the app uses it"
  value       = var.enable_r2_storage ? cloudflare_r2_bucket.storage[0].name : null
}

output "turnstile_site_key" {
  description = "Optional Turnstile public site key"
  value       = var.enable_turnstile ? cloudflare_turnstile_widget.main[0].sitekey : null
}

output "turnstile_secret_key" {
  description = "Optional Turnstile secret; move it to the application secret store"
  value       = var.enable_turnstile ? cloudflare_turnstile_widget.main[0].secret : null
  sensitive   = true
}

output "web_analytics_site_tag" {
  description = "Optional Web Analytics site tag"
  value       = var.enable_analytics ? cloudflare_web_analytics_site.main[0].site_tag : null
}
