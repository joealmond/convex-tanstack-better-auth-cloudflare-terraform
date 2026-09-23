# create-convexkit

Create a production-minded TanStack Start + Convex app with an interactive prompt:

```bash
npm create convexkit@latest my-app
```

Choices include Better Auth or Clerk, Cloudflare/Vercel/Netlify deployment, isolated feature
examples, and optional Terraform. Run `npm create convexkit@latest -- --help` for automation flags.

## Versioned templates

Each CLI version defaults to the matching `create-convexkit-vX.Y.Z` repository tag. The
publisher checks that the package version, release tag, and checkout agree. Protect published
tags from being moved. A missing tag is an error; the generator never falls back to `main`.

Use `--template-ref main` to opt into unreleased source, or `--template-dir /path/to/checkout`
when developing locally. Commit the generated `package-lock.json` and use `npm ci` thereafter.
Direct dependencies are exact versions; the first install for a composed variant still resolves
transitive dependencies, which are then fixed by its generated lockfile.

The `--no-install` path prints the required install and route-generation commands. Generated
CI validates that app's selected features and deployment target. Local template copies omit
credentials, Terraform state, runtime caches, and build output.
