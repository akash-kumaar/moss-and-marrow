FROM node:20-alpine

# Set node environment
ENV NODE_ENV=production

WORKDIR /app

# Copy package manifests first for caching
COPY package.json package-lock.json ./

# Install production dependencies cleanly
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Ensure non-root node user owns the working directory
RUN chown -R node:node /app

# Switch to non-root user for security
USER node

# Expose default port
EXPOSE 5000

# Start Express server using existing npm start script
CMD ["npm", "start"]

