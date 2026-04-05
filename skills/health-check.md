---
name: access-health-check
description: Verify Access is running correctly — checks connectivity, auth, encryption, service adapters, and consumer permissions. Run periodically or after making changes.
---

# Access Health Check

Run this to verify your Access instance is healthy. Especially important after:
- Adding or modifying consumers/agents
- Rotating encryption keys
- Updating service adapters
- Deploying a new version

## Steps

### 1. Connectivity
Check that Access is reachable:
```bash
curl -s -o /dev/null -w "%{http_code}" "$ACCESS_BASE_URL/api/health"
```
Expected: `200`. If you get anything else, the server is down or unreachable.

### 2. Authentication
Verify your token works:
```bash
curl -s -H "Authorization: Bearer $GLOBAL_AGENT_TOKEN" "$ACCESS_BASE_URL/api/v1/bootstrap" | head -c 200
```
Expected: JSON with `actor`, `env`, `services` fields. If you get `401`, your token is invalid or revoked.

### 3. Encryption integrity
Pull any known secret (NOT the encryption key itself) and verify it decrypts:
```bash
# Use any env var name you know exists in your store
curl -s -H "Authorization: Bearer $GLOBAL_AGENT_TOKEN" "$ACCESS_BASE_URL/api/v1/secrets/by-env/SOME_KNOWN_SECRET"
```
Expected: a JSON response with a `value` field. If you get a decryption error, your encryption key may have rotated without running the migration script. Run `npx tsx scripts/rotate-keys.ts`.

### 4. Service adapter spot check
Pick 2-3 services and verify they respond (not necessarily with data — just that the adapter loads and auth works):
```bash
# Google (if configured)
curl -s -H "Authorization: Bearer $GLOBAL_AGENT_TOKEN" "$ACCESS_BASE_URL/api/v1/google/profile" | head -c 200

# GitHub (if configured)
curl -s -H "Authorization: Bearer $GLOBAL_AGENT_TOKEN" "$ACCESS_BASE_URL/api/v1/github?action=repos&limit=1" | head -c 200

# HubSpot (if configured)
curl -s -H "Authorization: Bearer $GLOBAL_AGENT_TOKEN" "$ACCESS_BASE_URL/api/v1/hubspot?action=owners" | head -c 200
```
Expected: JSON response or a clear error like `"GITHUB_TOKEN not set"` (meaning the adapter works but isn't configured). A 500 with no message means something is broken.

### 5. Consumer permissions
Verify that scoped consumers only see what they should:
```bash
# If you have a scoped consumer token, bootstrap with it and check the service count
curl -s -H "Authorization: Bearer $SCOPED_TOKEN" "$ACCESS_BASE_URL/api/v1/bootstrap" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Services visible: {len(d.get(\"services\",[]))}')"
```
If a scoped consumer sees more services than expected, check your access grants in the admin UI.

### 6. Audit trail
Verify audit events are being recorded:
```bash
# Check the admin UI at /settings or query the database directly
# Every health check call above should have generated audit events
```

## What to do if something fails

| Check | Failure | Fix |
|-------|---------|-----|
| Connectivity | 502/503 | Server is down — check deployment logs |
| Auth | 401 | Token invalid — regenerate in admin UI |
| Encryption | Decryption error | Key rotated without migration — run `scripts/rotate-keys.ts` |
| Adapter | 500 | Check env vars for that service, check upstream API status |
| Permissions | Too broad | Review access grants in admin UI, tighten consumer scopes |
| Audit | No events | Check database connectivity, check Prisma connection |
