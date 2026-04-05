#!/usr/bin/env bash
#
# Access — Install agent skill and MCP config
#
# Run this from the Access repo root:
#   bash scripts/install.sh
#
# What it does:
#   1. Installs the health-check skill into your Claude Code commands
#   2. Offers to configure Access as an MCP server
#   3. Shows you what to add to your agent instructions (CLAUDE.md)
#
# You can reject any step — nothing runs without confirmation.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "  Access — Agent Setup"
echo "  ──────────────────────"
echo ""

# ── Step 1: Install health check skill ─────────────────────────────────────

SKILL_SOURCE="$REPO_DIR/skills/health-check.md"
SKILL_TARGETS=(
  "$HOME/.claude/commands/access-health-check.md"
)

echo "Step 1: Install health-check skill"
echo ""
echo "  This installs a periodic health check skill that verifies your Access"
echo "  instance is working — auth, encryption, adapters, permissions."
echo ""
echo "  Source:  $SKILL_SOURCE"
echo "  Target:  ${SKILL_TARGETS[0]}"
echo ""

read -p "  Install the health check skill? [Y/n] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Nn]$ ]]; then
  mkdir -p "$(dirname "${SKILL_TARGETS[0]}")"
  cp "$SKILL_SOURCE" "${SKILL_TARGETS[0]}"
  echo "  ✓ Installed to ${SKILL_TARGETS[0]}"
else
  echo "  ✗ Skipped"
fi

echo ""

# ── Step 2: MCP server config ──────────────────────────────────────────────

echo "Step 2: Configure Access as an MCP server"
echo ""
echo "  This adds Access to your Claude Code MCP config so your agent gets"
echo "  tools like gmail_search, calendar_list, drive_list, etc."
echo ""

MCP_CONFIG="$HOME/.claude/mcp.json"

if [ -f "$MCP_CONFIG" ]; then
  echo "  Found existing MCP config at $MCP_CONFIG"
  echo "  You may want to add this manually to avoid overwriting other servers."
  echo ""
  echo "  Add this to your mcpServers:"
  echo ""
else
  echo "  No MCP config found. You can create one at $MCP_CONFIG"
  echo ""
  echo "  Add this:"
  echo ""
fi

cat << 'MCPJSON'
  {
    "mcpServers": {
      "access": {
        "command": "node",
        "args": ["REPO_PATH/mcp-server.mjs"],
        "env": {
          "ACCESS_BASE_URL": "http://localhost:3000",
          "GLOBAL_AGENT_TOKEN": "your-token-here"
        }
      }
    }
  }
MCPJSON

echo ""
echo "  Replace REPO_PATH with: $REPO_DIR"
echo ""

# ── Step 3: Agent instructions ─────────────────────────────────────────────

echo "Step 3: Add to your agent instructions"
echo ""
echo "  Copy the 'For agents USING Access' section from AGENTS.md into your"
echo "  CLAUDE.md (or equivalent agent instruction file)."
echo ""
echo "  File: $REPO_DIR/AGENTS.md"
echo ""

# ── Done ───────────────────────────────────────────────────────────────────

echo "──────────────────────"
echo ""
echo "  Setup complete. Run /access-health-check in Claude Code to verify."
echo ""
