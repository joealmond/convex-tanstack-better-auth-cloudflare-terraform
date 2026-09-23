# Optional Cloudflare infrastructure

Wrangler is authoritative for the Worker, its environments, observability, bindings, and Custom Domain. Terraform intentionally manages only optional account-level KV, R2, Turnstile, and Web Analytics resources. This avoids two deployment tools overwriting the same Worker configuration.

## Preview bootstrap

From the repository root, choose a globally unique Worker name and run:

```sh
npm run infra:bootstrap -- --worker-name my-app-preview
npm run deploy:preview
```

The first command creates or reuses the Convex development deployment, creates the Better Auth secret there, verifies the selected Cloudflare account, and saves non-secret local state in `.convexkit/`. Re-running it reuses that state. The second command deploys the preview Worker, writes its exact URL to `SITE_URL` on Convex, runs a read-only app and backend health check, and records the commit and deployment identity locally.

To provision optional account resources in the same bootstrap, first create `terraform.tfvars` and then add `--with-terraform`. Terraform is idempotent after its first apply.

1. Copy `terraform.tfvars.example` to the ignored `terraform.tfvars` and use a narrowly scoped Cloudflare API token.
2. Run `terraform init`, `terraform plan`, and review the plan before `terraform apply`.
3. If you enable KV or R2 and the application will use it, add the resulting output as a binding in `wrangler.jsonc` and regenerate Cloudflare types.
4. If you enable Turnstile, treat its secret output as sensitive and store it in the application secret store; provisioning a widget does not enable application-side verification.

Custom Domains are configured at deployment with the `CLOUDFLARE_CUSTOM_DOMAIN_PREVIEW` and `CLOUDFLARE_CUSTOM_DOMAIN_PROD` GitHub environment variables. The build script writes a Wrangler `custom_domain` route; it does not create an invalid account-ID CNAME.

Commit `.terraform.lock.hcl`; never commit state, populated variable files, plans, or API tokens. Production should use a remote state backend with encryption, locking, access controls, and versioning.

## Recovery

The release record contains the Worker name, commit, backend deployment, and deployed URL. For a Worker-only rollback, use `wrangler versions list` followed by `wrangler rollback <VERSION_ID>`. Before returning the backend to an earlier commit, confirm that its Convex schema accepts the current data. Deploy that compatible commit, then rerun the read-only smoke check against the restored app and Convex health endpoint.
