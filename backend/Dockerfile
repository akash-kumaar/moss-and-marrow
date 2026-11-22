# Pin the supported Node 22 maintenance-LTS release and Alpine variant so
# security scans are repeatable instead of depending on the mutable 22-alpine tag.
FROM node:22.23.5-alpine3.24

# Set node environment
ENV NODE_ENV=production

WORKDIR /app

# Copy package manifests first for caching
COPY package.json package-lock.json ./

# Install production dependencies cleanly
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# npm is only required to build this image. Remove the bundled CLI and its
# dependency tree from the runtime image after dependencies are installed.
# This prevents build tooling (including its transitive packages) from
# increasing the production container's attack surface.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Ensure non-root node user owns the working directory
RUN chown -R node:node /app

# Switch to non-root user for security
USER node

# Expose default port
EXPOSE 5000

# Start Express directly so the runtime image does not need npm.
CMD ["node", "src/server.js"]

