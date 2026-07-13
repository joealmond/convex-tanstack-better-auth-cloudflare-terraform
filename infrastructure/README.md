# Optional Cloudflare infrastructure

Wrangler is authoritative for the Worker, its environments, observability, bindings, and Custom Domain. Terraform intentionally manages only optional account-level KV, R2, Turnstile, and Web Analytics resources. This avoids two deployment tools overwriting the same Worker configuration.

1. Copy `terraform.tfvars.example` to the ignored `terraform.tfvars` and use a narrowly scoped Cloudflare API token.
2. Run `terraform init`, `terraform plan`, and review the plan before `terraform apply`.
3. If you enable KV or R2 and the application will use it, add the resulting output as a binding in `wrangler.jsonc` and regenerate Cloudflare types.
4. If you enable Turnstile, treat its secret output as sensitive and store it in the application secret store; provisioning a widget does not enable application-side verification.

Custom Domains are configured at deployment with the `CLOUDFLARE_CUSTOM_DOMAIN_PREVIEW` and `CLOUDFLARE_CUSTOM_DOMAIN_PROD` GitHub environment variables. The build script writes a Wrangler `custom_domain` route; it does not create an invalid account-ID CNAME.

Commit `.terraform.lock.hcl`; never commit state, populated variable files, plans, or API tokens. Production should use a remote state backend with encryption, locking, access controls, and versioning.
