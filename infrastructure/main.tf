terraform {
  required_version = ">= 1.8"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "5.21.1"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# Wrangler owns Worker code, bindings, observability, environments, and custom
# domains. Terraform only provisions optional account-level services so the two
# tools never fight over the same resource.
resource "cloudflare_workers_kv_namespace" "cache" {
  count      = var.enable_kv_cache ? 1 : 0
  account_id = var.cloudflare_account_id
  title      = "${var.resource_prefix}-cache"
}

resource "cloudflare_r2_bucket" "storage" {
  count         = var.enable_r2_storage ? 1 : 0
  account_id    = var.cloudflare_account_id
  name          = "${var.resource_prefix}-storage"
  location      = var.r2_location
  storage_class = "Standard"
}

resource "cloudflare_turnstile_widget" "main" {
  count      = var.enable_turnstile ? 1 : 0
  account_id = var.cloudflare_account_id
  name       = var.resource_prefix
  domains    = var.turnstile_domains
  mode       = "managed"
  region     = "world"
}

resource "cloudflare_web_analytics_site" "main" {
  count        = var.enable_analytics ? 1 : 0
  account_id   = var.cloudflare_account_id
  zone_tag     = var.cloudflare_zone_id
  auto_install = true
  enabled      = true
  lite         = true
}
