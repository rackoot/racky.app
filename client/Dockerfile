FROM node:20-alpine

WORKDIR /app

# Install global npm as root
RUN npm install -g npm@11.6.2

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Copy package files
COPY --chown=nodejs:nodejs package*.json ./

# Switch to nodejs user for the rest
USER nodejs

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY --chown=nodejs:nodejs . .

# Expose port
EXPOSE 5173

# Start development server with verbose output
CMD ["sh", "-c", "echo '=== Starting Vite ===' && echo 'Node version:' && node --version && echo 'NPM version:' && npm --version && echo 'Files in /app:' && ls -la /app && echo '=== Running dev server ===' && npm run dev -- --host 0.0.0.0 --port 5173 --debug"]