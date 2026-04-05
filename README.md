# Access

Self-hosted secret, context, and bootstrap service for agents and scripts.

Your agent should call Gmail, not do OAuth. Your agent should ask for an API key, not juggle `.env` files across six machines.

That's what this is.

```mermaid
flowchart LR
    A[Any MCP client\nor HTTP caller] -->|Bearer token| B["Access\n(Next.js + Postgres)"]
    B -->|OAuth 2.0| C[Google · GitHub · Sentry · Oura]
    B -->|API key| D[HubSpot · Linear · Jira · Stripe\nNotion · Apollo · Cal · Porkbun]
    B -->|Token| E[Slack · Cloudflare · Vercel\nGitLab · AWS]
```

## What it does

You put every credential in it — API keys, OAuth tokens, passwords, service secrets, whatever your agents and scripts need. Then:

- **Stores everything encrypted** — AES-256-GCM at rest, HMAC-hashed access tokens, audit trail on every read
- **Handles OAuth** — token refresh, consent flows, multi-account Google — your agent never participates
- **Proxies API calls** — for services with adapters, agents hit Access and get JSON back without ever seeing the underlying key
- **Serves credentials directly** — for everything else, agents pull keys via `/bootstrap` or `/secrets/by-env/WHATEVER`
- **Logs everything** — every secret access, every API call, every auth attempt, with actor and IP
- **Bootstraps sessions** — one `/bootstrap` call gives an agent all its env vars, docs, and context at once

## 30-second example

```bash
# Your agent searches Gmail through Access
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-access-instance/api/v1/google/gmail?action=search&q=from:alice&account=work"

# Or bootstraps an entire session in one call
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-access-instance/api/v1/bootstrap"
```

With MCP, your agent gets tools like `gmail_search`, `calendar_list`, `drive_list` — no configuration per service, no expired tokens, no credential management.

## Who this is for

**Good fit:**
- Running AI agents (Claude Code, Cursor, Gemini CLI, Codex) across multiple sessions or machines
- Self-hosted personal or small-team setups
- Multi-service workflows where agents need Gmail, Slack, GitHub, etc.
- Anyone tired of bootstrapping agent sessions with scattered `.env` files

**Not a fit:**
- Enterprise secrets management with compliance requirements (use HashiCorp Vault)
- High-compliance infrastructure with KMS/HSM requirements
- Large team IAM or multi-tenant access control

**How it differs from a password manager:** 1Password stores credentials for humans to copy-paste. Access stores credentials and *uses them* — proxying API calls, refreshing OAuth tokens, bootstrapping agent sessions. Your agent never sees the raw key for proxied services.

## Security posture

**What Access protects against:**
- Agents seeing or storing raw credentials
- Expired OAuth tokens breaking agent sessions
- Unaudited credential access across machines
- Plaintext secrets in databases (AES-256-GCM encryption at rest)
- Brute-force token guessing (HMAC-SHA256 hashed, constant-time comparison)

**What Access does not protect against:**
- A compromised Access instance (if someone gets your server, they get everything)
- Cloud-grade key management (no KMS/HSM integration yet — see roadmap)
- Multi-tenant isolation (this is a single-owner system)
- Network-level attacks (deploy behind HTTPS, use a firewall)

## Why not just use `.env` files?

- **OAuth tokens expire.** Google access tokens last 60 minutes. Your agent can't refresh them — Access can.
- **Credentials scatter.** Each agent session needs its own copy. Rotate a key and you're updating it in 6 places.
- **No audit trail.** Which agent accessed which service? When? From where? No idea.
- **Bootstrapping is painful.** Every new session starts with loading env vars and hoping nothing expired.

## How it compares

| | Access | `.env` files | Composio / Nango |
|---|--------|-------------|-----------------|
| Self-hosted | Yes | Yes | Cloud-first |
| OAuth refresh | Automatic | Manual | Automatic |
| MCP server | Built-in | No | No |
| Audit trail | Yes | No | Varies |
| Agent bootstrapping | One call | Manual | No |
| Complexity | One Next.js app | None | Platform |
| Cost | Free | Free | Paid plans |

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL (or use the included Docker Compose)
- A Google Cloud OAuth app (if you want Google API proxying)

### 1. Clone and install

```bash
git clone https://github.com/Scottpedia0/access.git
cd access
npm install
```

### 2. Set up the database

```bash
# Option A: Use Docker Compose
docker compose up -d

# Option B: Use your own Postgres
# Set DATABASE_URL and DIRECT_DATABASE_URL in .env
```

### 3. Configure environment

```bash
cp .env.example .env

# Generate required secrets
openssl rand -base64 32  # -> SECRET_ENCRYPTION_KEY
openssl rand -base64 32  # -> NEXTAUTH_SECRET
openssl rand -base64 32  # -> CONSUMER_TOKEN_HASH_SECRET
```

Edit `.env` with your values. At minimum you need:
- `DATABASE_URL` / `DIRECT_DATABASE_URL`
- `SECRET_ENCRYPTION_KEY`
- `NEXTAUTH_SECRET`
- `OWNER_EMAILS` (comma-separated list of emails allowed to log in)
- One auth provider (Google OAuth, email magic link, or owner password)

### 4. Run migrations and seed

```bash
npx prisma migrate deploy
npm run db:seed  # Creates example services and a consumer token
```

### 5. Start the app

```bash
npm run dev
```

Visit `http://localhost:3000` and sign in with an email from your `OWNER_EMAILS` list.

## Supported Services

27 service endpoints across `/api/v1/*`. Each adapter handles auth and proxies requests upstream.

**Google Workspace** (OAuth 2.0, multi-account) — Gmail, Calendar, Drive, Sheets, Docs, Contacts, Analytics, Search Console, Tag Manager, Admin Reports, Profile

**Developer tools** — GitHub, GitLab, Linear, Jira, Notion, Sentry, Vercel

**Business** — HubSpot, Slack, Stripe (read-only), Apollo.io, Cal.com

**Infrastructure** — AWS (S3, EC2, Lambda, CloudWatch — optional SDK deps), Cloudflare

**Other** — Oura Ring, Porkbun

Google services support multiple accounts — configure via the `GOOGLE_ACCOUNTS` env var (e.g., `work:me@company.com,personal:me@gmail.com`). Adding a new adapter is ~100 lines — see [Adding a New Service](#adding-a-new-service).

### Core Endpoints

These aren't service proxies — they're Access itself:

| Endpoint | What it does |
|----------|-------------|
| `GET /api/v1/bootstrap` | One pull that returns all secrets as env vars + service metadata + docs + linked resources. This is how agents bootstrap a session. |
| `POST /api/v1/intake` | Write-only endpoint for submitting new credentials without read access to the store. |
| `GET /api/v1/secrets/by-env/:name` | Look up a single decrypted secret by its env var name. |
| `GET /api/v1/services/:slug` | Service metadata, docs, and linked resources. |
| `GET /api/v1/services/:slug/secrets` | Decrypted secrets for a specific service. |

## Authentication

Access supports three token types for agent authentication:

| Token Type | Scope | Use case |
|-----------|-------|----------|
| **Global Agent Token** | Full access to all services and secrets | Trusted single-operator setups |
| **Consumer Tokens** | Granular per-service or per-secret access grants | Multi-agent setups where each agent gets different permissions |
| **Shared Intake Token** | Write-only credential submission | Let team members drop keys without read access |

```bash
# Search Gmail with a global token
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/v1/google/gmail?action=search&q=from:alice&account=work"

# Bootstrap an agent session — pull everything at once
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/v1/bootstrap"
```

Human authentication for the admin UI uses Google OAuth, email magic links, or a simple password — configured via env vars. Only emails in `OWNER_EMAILS` can log in.

## Adding a New Service

Each proxy adapter is a Next.js route handler under `src/app/api/v1/<service>/route.ts`. To add one:

1. Create `src/app/api/v1/your-service/route.ts`
2. Use `authenticateRequestActor()` from `@/lib/access` for auth
3. Read the API key from the encrypted store (via Prisma) or env vars
4. Proxy the request to the upstream API
5. Return the result

Most adapters are under 100 lines. See `src/app/api/v1/hubspot/route.ts` for a clean example.

## MCP Server

Access includes an MCP server (`mcp-server.mjs`) that exposes Google Workspace tools via stdio transport. Works with any MCP-compatible client.

Add the following config to your client. The JSON is the same — only the file path changes per client:

| Client | Config location |
|--------|----------------|
| **Claude Code** | `~/.claude/mcp.json` or project `.mcp.json` |
| **Cursor** | Cursor MCP settings |
| **Gemini CLI** | `.gemini/settings.json` |
| **Windsurf** | Windsurf MCP settings |
| **VS Code (Copilot)** | `.vscode/mcp.json` (use `"servers"` instead of `"mcpServers"`) |
| **Codex / other** | Any MCP-compatible config |

```json
{
  "mcpServers": {
    "access": {
      "command": "node",
      "args": ["/path/to/access/mcp-server.mjs"],
      "env": {
        "ACCESS_BASE_URL": "http://localhost:3000",
        "GLOBAL_AGENT_TOKEN": "your-token-here"
      }
    }
  }
}
```

> **VS Code note:** Use `"servers"` as the top-level key instead of `"mcpServers"`.

Once connected, your agent gets tools like `gmail_search`, `calendar_list`, `drive_list`, `contacts_search`, and more — all authenticated through Access.

### Direct API (No MCP)

You don't need MCP. Any HTTP client works:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/google/gmail?action=search&q=is:unread"
```

## Architecture

### How a request flows

```
1. Agent sends:     GET /api/v1/google/gmail?action=search&q=from:alice&account=work
                    Authorization: Bearer amb_live_xxxx

2. Middleware:       Rate limit check → Body size check → Pass

3. Auth:            Validate Bearer token (HMAC comparison)
                    Look up consumer permissions or verify global token

4. Proxy:           Load OAuth credentials from Postgres (encrypted)
                    Refresh access token if expired
                    Forward request to Gmail API

5. Response:        Return Gmail results as JSON to agent
                    Log access in audit_events table
```

### Design principles

- **Agents never see credentials.** They send a Bearer token, get back API results.
- **OAuth is handled server-side.** Token refresh, consent flows, multi-account management — all inside Access.
- **Everything is audited.** Every secret access, every API proxy call, every login attempt is logged with actor, timestamp, and IP.
- **Secrets are encrypted at rest.** AES-256-GCM with versioned payloads (`v1.iv.authTag.ciphertext`).
- **Consumer tokens use HMAC.** Constant-time comparison, only the prefix is stored — never the raw token.
- **Stateless proxy.** Access doesn't cache or store API responses. It's a pass-through.

## Security

- AES-256-GCM encryption for all stored secrets
- HMAC-SHA256 consumer token hashing with constant-time comparison
- Zod input validation on all API endpoints
- Audit logging for all access events and auth failures
- Owner email allowlist for admin UI access
- Error messages in production never leak upstream details
- Health endpoint requires auth to expose inventory counts
- Rate limiting on auth and API endpoints (configurable, in-memory by default)
- Request body size limits on all mutating endpoints

### Security Roadmap

- [ ] Per-service scoped tokens (split global token into granular permissions)
- [ ] Key rotation support
- [ ] Redis-backed rate limiting for serverless
- [ ] Envelope encryption / KMS integration

## Deployment

Access deploys well on **Vercel** with a **Neon** or **Supabase** Postgres database:

1. Push to GitHub
2. Import in Vercel
3. Set all env vars from `.env.example`
4. Set `NEXTAUTH_URL` to your production URL
5. Add `your-domain.com/api/google/callback` as an authorized redirect URI in Google Cloud Console
6. Run `npx prisma migrate deploy` via Vercel build command

Works anywhere Node.js runs — Vercel, Railway, Fly.io, a VPS, your laptop.

## Development

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run db:studio    # Prisma Studio (GUI for database)
npm run db:seed      # Seed example data
```

## License

MIT
