#!/usr/bin/env bash
#
# Access — Install agent skill and MCP config
#
# Run this from the Access repo root:
#   bash scripts/install.sh
#
# What it does:
#   1. Checks for common agent harnesses on this machine
#   2. Copies the health-check skill file where supported (Y/n per harness)
#   3. Prints the MCP config JSON you need to add manually per client
#   4. Points you to the agent instruction block in AGENTS.md
#
# This script does NOT auto-modify your MCP configs — it shows you what to add.
# You can reject any step — nothing runs without confirmation.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
SKILL_SOURCE="$REPO_DIR/skills/health-check.md"
INSTALLED=()

echo ""
echo "  Access — Agent Setup"
echo "  ──────────────────────"
echo ""

# ── Detect installed harnesses ─────────────────────────────────────────────

echo "Detecting agent harnesses..."
echo ""

# Claude Code
if [ -d "$HOME/.claude" ]; then
  echo "  ✓ Claude Code detected"
  INSTALLED+=("claude")
fi

# Cursor
if [ -d "$HOME/.cursor" ] || [ -d "$HOME/Library/Application Support/Cursor" ] || [ -d "$HOME/.config/cursor" ]; then
  echo "  ✓ Cursor detected"
  INSTALLED+=("cursor")
fi

# Gemini CLI
if [ -d "$HOME/.gemini" ] || command -v gemini &>/dev/null; then
  echo "  ✓ Gemini CLI detected"
  INSTALLED+=("gemini")
fi

# Windsurf
if [ -d "$HOME/.windsurf" ] || [ -d "$HOME/Library/Application Support/Windsurf" ] || [ -d "$HOME/.config/windsurf" ]; then
  echo "  ✓ Windsurf detected"
  INSTALLED+=("windsurf")
fi

# VS Code
if [ -d "$HOME/.vscode" ] || command -v code &>/dev/null; then
  echo "  ✓ VS Code detected"
  INSTALLED+=("vscode")
fi

# Codex
if command -v codex &>/dev/null; then
  echo "  ✓ Codex detected"
  INSTALLED+=("codex")
fi

if [ ${#INSTALLED[@]} -eq 0 ]; then
  echo "  No agent harnesses detected. You can still use Access via HTTP."
  echo "  See AGENTS.md for manual setup instructions."
  echo ""
  exit 0
fi

echo ""

# ── MCP config block (shared across all clients) ──────────────────────────

# Sanitize repo path for JSON embedding (escape backslashes and quotes)
SAFE_REPO_DIR=$(printf '%s' "$REPO_DIR" | sed 's/\\/\\\\/g; s/"/\\"/g')

MCP_BLOCK='{
    "access": {
      "command": "node",
      "args": ["'"$SAFE_REPO_DIR"'/mcp-server.mjs"],
      "env": {
        "ACCESS_BASE_URL": "http://localhost:3000",
        "GLOBAL_AGENT_TOKEN": "your-token-here"
      }
    }
  }'

# ── Step 1: Install health-check skill ────────────────────────────────────

echo "Step 1: Install health-check skill"
echo ""
echo "  A periodic check that verifies your Access instance is healthy —"
echo "  auth, encryption, adapters, permissions."
echo ""

install_skill() {
  local name="$1"
  local target="$2"

  if [ -f "$target" ]; then
    echo "  $name: already installed at $target"
    return
  fi

  read -p "  Install for $name? ($target) [Y/n] " -n 1 -r
  echo ""

  if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    mkdir -p "$(dirname "$target")"
    cp "$SKILL_SOURCE" "$target"
    echo "  ✓ Installed"
  else
    echo "  ✗ Skipped"
  fi
}

for harness in "${INSTALLED[@]}"; do
  case "$harness" in
    claude)
      install_skill "Claude Code" "$HOME/.claude/commands/access-health-check.md"
      ;;
    cursor)
      # Cursor uses .cursor/commands or project-level
      install_skill "Cursor" "$HOME/.cursor/commands/access-health-check.md"
      ;;
    gemini)
      install_skill "Gemini CLI" "$HOME/.gemini/commands/access-health-check.md"
      ;;
    windsurf)
      install_skill "Windsurf" "$HOME/.windsurf/commands/access-health-check.md"
      ;;
  esac
done

echo ""

# ── Step 2: MCP server config ─────────────────────────────────────────────

echo "Step 2: Configure Access as an MCP server"
echo ""

show_mcp_config() {
  local name="$1"
  local config_path="$2"
  local key="$3"  # mcpServers or servers

  echo "  ── $name ──"

  if [ -f "$config_path" ]; then
    echo "  Config exists at $config_path"
    echo "  Add this to your \"$key\" block:"
  else
    echo "  Create $config_path with:"
  fi

  echo ""
  echo "  {"
  echo "    \"$key\": $MCP_BLOCK"
  echo "  }"
  echo ""
}

for harness in "${INSTALLED[@]}"; do
  case "$harness" in
    claude)
      show_mcp_config "Claude Code" "$HOME/.claude/mcp.json" "mcpServers"
      ;;
    cursor)
      show_mcp_config "Cursor" "$HOME/.cursor/mcp.json" "mcpServers"
      ;;
    gemini)
      show_mcp_config "Gemini CLI" "$HOME/.gemini/settings.json" "mcpServers"
      ;;
    windsurf)
      show_mcp_config "Windsurf" "$HOME/.windsurf/mcp.json" "mcpServers"
      ;;
    vscode)
      show_mcp_config "VS Code (Copilot)" ".vscode/mcp.json" "servers"
      ;;
    codex)
      echo "  ── Codex ──"
      echo "  Add Access to your Codex MCP config with the same pattern."
      echo ""
      ;;
  esac
done

# ── Step 3: Agent instructions ─────────────────────────────────────────────

echo "Step 3: Add to your agent instructions"
echo ""
echo "  Copy the 'For agents USING Access' section from AGENTS.md into your"
echo "  agent instruction file:"
echo ""

for harness in "${INSTALLED[@]}"; do
  case "$harness" in
    claude)  echo "    Claude Code:  CLAUDE.md" ;;
    gemini)  echo "    Gemini CLI:   GEMINI.md" ;;
    cursor)  echo "    Cursor:       .cursor/rules or project instructions" ;;
    windsurf) echo "    Windsurf:     .windsurf/rules" ;;
    vscode)  echo "    VS Code:      .github/copilot-instructions.md" ;;
    codex)   echo "    Codex:        AGENTS.md" ;;
  esac
done

echo ""
echo "  Source: $REPO_DIR/AGENTS.md"

# ── Done ───────────────────────────────────────────────────────────────────

echo ""
echo "  ──────────────────────"
echo ""
echo "  Setup complete."
echo "  Detected: ${INSTALLED[*]}"
echo "  Run the health check skill in your harness to verify."
echo ""
