# Base stage for all services
FROM node:18-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package*.json ./
COPY apps/*/package.json apps/*/
COPY packages/*/package.json packages/*/
RUN npm install --no-audit --no-fund

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production stage for Bot
FROM base AS bot
ENV NODE_ENV=production
WORKDIR /app

# Copy necessary files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/bot/dist ./apps/bot/dist
COPY --from=builder /app/apps/bot/package.json ./apps/bot/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/providers/dist ./packages/providers/dist
COPY --from=builder /app/package.json ./

# Prisma client
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER node
EXPOSE 3000
CMD ["node", "apps/bot/dist/index.js"]

# Production stage for API
FROM base AS api
ENV NODE_ENV=production
WORKDIR /app

# Copy necessary files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/providers/dist ./packages/providers/dist
COPY --from=builder /app/package.json ./

# Prisma client
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER node
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]

# Production stage for Mini App
FROM base AS mini-app
ENV NODE_ENV=production
WORKDIR /app

# Copy necessary files
COPY --from=builder /app/apps/mini-app/.next ./apps/mini-app/.next
COPY --from=builder /app/apps/mini-app/public ./apps/mini-app/public
COPY --from=builder /app/apps/mini-app/package.json ./apps/mini-app/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

USER node
EXPOSE 3002
CMD ["npm", "run", "start", "--workspace=@real-estate-bot/mini-app"]