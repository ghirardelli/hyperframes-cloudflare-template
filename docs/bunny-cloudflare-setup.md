# Bunny Storage + Stream on Cloudflare

This app uses Bunny for project bytes and rendered video delivery, but the Worker remains the only component that talks to Bunny. Do not expose Bunny access keys to browser code, Studio responses, generated project files, or logs.

## Bunny Resources

Create separate staging and production resources.

1. Create a Bunny Storage Zone for project workspaces.
2. Use the HTTP Storage API endpoint for the selected region, for example `https://la.storage.bunnycdn.com`.
3. Create a Bunny Stream library for final rendered videos.
4. Create one staging Stream collection while testing.

Hold off on direct browser uploads, public Pull Zone URLs, token-auth CDN delivery, webhooks, transcription, smart generation, premium/JIT encoding, and broad replication until the app has been tested end to end.

## Cloudflare Worker Vars

Non-sensitive values can be committed in `wrangler.jsonc`:

```jsonc
"vars": {
  "BUNNY_STORAGE_ZONE_NAME": "motionframes-projects-staging",
  "BUNNY_STORAGE_ENDPOINT": "https://la.storage.bunnycdn.com",
  "BUNNY_STREAM_LIBRARY_ID": "693756",
  "BUNNY_STREAM_API_BASE": "https://video.bunnycdn.com",
  "BUNNY_STREAM_COLLECTION_ID": "739591c5-cc47-4647-a270-4fdb3f9e54b5"
}
```

## Cloudflare Secrets

Sensitive values must be set with Wrangler or the Cloudflare dashboard:

```bash
npx wrangler secret put BUNNY_STORAGE_ACCESS_KEY
npx wrangler secret put BUNNY_STREAM_ACCESS_KEY
```

Only add these when the corresponding features are implemented and tested:

```bash
npx wrangler secret put BUNNY_TOKEN_AUTH_KEY
npx wrangler secret put BUNNY_WEBHOOK_SECRET
```

Existing app secrets still apply:

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL
npx wrangler secret put OPENROUTER_API_KEY
```

Optional existing app values include `OPENROUTER_MODEL` and `INITIAL_ADMIN_EMAILS`.

## Storage Layout

New Bunny Storage objects use immutable database IDs:

```txt
orgs/{organizationId}/users/{ownerUserId}/projects/{projectId}/workspace/{path}
orgs/{organizationId}/users/{ownerUserId}/projects/{projectId}/versions/{entryVersionId}/{basename}
orgs/{organizationId}/users/{ownerUserId}/projects/{projectId}/renders/{renderId}/{filename}
```

Studio file trees come from Postgres `project_entries`, not Bunny listings. Bunny stores bytes; Postgres owns paths, permissions, versions, snapshots, search text, and provider pointers.
