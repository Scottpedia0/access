FROM node:20-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the MCP server and its dependencies
COPY mcp-server.mjs ./
COPY src/lib/google/ ./src/lib/google/

# The MCP server uses stdio transport
# It starts without GLOBAL_AGENT_TOKEN for introspection/tool discovery
# Set GLOBAL_AGENT_TOKEN and ACCESS_BASE_URL for actual API calls
ENTRYPOINT ["node", "mcp-server.mjs"]
