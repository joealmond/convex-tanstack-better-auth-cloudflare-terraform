variable "cloudflare_api_token" {
  description = "Cloudflare API token for only the optional resources enabled below"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "resource_prefix" {
  description = "Prefix for optional Cloudflare resource names"
  type        = string
  default     = "convexkit-production"
}

variable "enable_kv_cache" {
  description = "Provision an optional KV namespace (the app does not bind it by default)"
  type        = bool
  default     = false
}

variable "enable_r2_storage" {
  description = "Provision an optional R2 bucket (uploads use Convex storage by default)"
  type        = bool
  default     = false
}

variable "r2_location" {
  description = "R2 location hint: apac, eeur, enam, weur, wnam, or oc"
  type        = string
  default     = "weur"

  validation {
    condition     = contains(["apac", "eeur", "enam", "weur", "wnam", "oc"], var.r2_location)
    error_message = "r2_location must be a supported lowercase Cloudflare location hint."
  }
}

variable "enable_turnstile" {
  description = "Provision a Turnstile widget; application integration is a separate opt-in"
  type        = bool
  default     = false
}

variable "turnstile_domains" {
  description = "Hostnames allowed to render the Turnstile widget"
  type        = list(string)
  default     = ["localhost"]
}

variable "enable_analytics" {
  description = "Enable privacy-reduced Cloudflare Web Analytics"
  type        = bool
  default     = false
}

variable "cloudflare_zone_id" {
  description = "Zone ID required only when enable_analytics is true"
  type        = string
  default     = ""

  validation {
    condition     = !var.enable_analytics || length(var.cloudflare_zone_id) > 0
    error_message = "cloudflare_zone_id is required when enable_analytics is true."
  }
}
