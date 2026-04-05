# Access — Agent Instructions

## For agents developing on this codebase

### What this is
Access is a self-hosted credential store + API proxy + MCP server for agents and scripts. Next.js App Router + Prisma + PostgreSQL.

### Architecture
- `src/app/api/v1/<service>/route.ts` — proxy route handlers (Zod validation, auth, proxy upstream)
- `src/lib/<service>/client.ts` — upstream API client functions
- `src/lib/access.ts` — request authentication (global token, consumer token, session)
- `src/lib/security/encryption.ts` — AES-256-GCM encrypt/decrypt with key rotation support
- `src/lib/security/tokens.ts` — HMAC-SHA256 consumer token generation and verification
- `src/lib/env.ts` — environment variable helpers and encryption key loading
- `src/lib/audit.ts` — audit event logging
- `src/middleware.ts` — rate limiting and body size enforcement
- `prisma/schema.prisma` — data model (Service, Secret, Consumer, AccessGrant, AuditEvent, etc.)
- `mcp-server.mjs` — standalone MCP server exposing Google Workspace tools
- `scripts/rotate-keys.ts` — encryption key rotation script

### Key patterns
- Every route uses `isValidGlobalAgentToken()` or `authenticateRequestActor()` for auth
- Every route has Zod schemas for input validation
- Every route catches errors with `process.env.NODE_ENV === "development"` gating on details
- `export const runtime = "nodejs"` on all POST route handlers
- Google services use `authenticateGoogleRequest()` which handles multi-account resolution

### Adding a new service adapter
1. Create `src/lib/<service>/client.ts` with API functions
2. Create `src/app/api/v1/<service>/route.ts` following the hubspot pattern
3. Add env vars to `.env.example`
4. Update the Supported Services section in `README.md`

### Data model
- `Service` — a registered service (name, slug, description, visibility mode)
- `Secret` — encrypted credential belonging to a service (envVarName, encryptedValue)
- `Consumer` — an agent identity (name, slug, hashed token)
- `AccessGrant` — links a consumer to a service or specific secret
- `AuditEvent` — log of every access, reveal, copy, login, and API call
- `GoogleToken` — OAuth tokens for Google multi-account broker

### Commands
```bash
npm run dev          # Dev server
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run db:studio    # Prisma Studio
npm run db:seed      # Seed example data
npm run db:deploy    # Apply migrations
```

---

## For agents USING Access (paste this into your CLAUDE.md or agent instructions)

```markdown
## Access — Credential & API Gateway

Your credentials are managed by Access. Do NOT store API keys in .env files or hardcode them.

### Bootstrap a session
Pull all authorized credentials and context in one call:
```
curl -H "Authorization: Bearer $GLOBAL_AGENT_TOKEN" \
  "$ACCESS_BASE_URL/api/v1/bootstrap"
```
This returns: env vars (decrypted), service metadata, docs, and linked resources — scoped to your token's permissions.

### Pull a single secret by env var name
```
curl -H "Authorization: Bearer $GLOBAL_AGENT_TOKEN" \
  "$ACCESS_BASE_URL/api/v1/secrets/by-env/OPENROUTER_API_KEY"
```

### Proxy API calls (don't use raw credentials)
For services with proxy adapters, call Access instead of the upstream API:
```
# Gmail
curl -H "Authorization: Bearer $GLOBAL_AGENT_TOKEN" \
  "$ACCESS_BASE_URL/api/v1/google/gmail?action=search&q=is:unread&account=work"

# GitHub
curl -H "Authorization: Bearer $GLOBAL_AGENT_TOKEN" \
  "$ACCESS_BASE_URL/api/v1/github?action=issues&owner=myorg&repo=myrepo"

# Slack
curl -H "Authorization: Bearer $GLOBAL_AGENT_TOKEN" \
  "$ACCESS_BASE_URL/api/v1/slack?action=channels"
```

Access handles OAuth refresh, token management, and audit logging. You never see the underlying credentials.

### MCP
If Access is configured as an MCP server, use tools like `gmail_search`, `calendar_list`, `drive_list`, etc. directly.

### Health check
Run `skills/health-check.md` periodically or after making changes to verify Access is healthy — connectivity, auth, encryption, adapters, and permissions.

### Rules
- Always check Access first before asking the user to paste API keys
- Use the proxy endpoints when available instead of raw API calls
- Your token only returns what you're authorized to see
- Every call is logged with your identity, timestamp, and IP
- Run the health check after modifying consumers, rotating keys, or deploying updates
```
