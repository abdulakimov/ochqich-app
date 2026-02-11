FROM node:20-alpine AS deps
WORKDIR /app

COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package.json ./apps/api/package.json
RUN npm --prefix apps/api install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared ./packages/shared
COPY . .
RUN npm --prefix apps/api run prisma:generate
RUN npm --prefix apps/api run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm --prefix apps/api install --omit=dev

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/scripts ./apps/api/scripts
COPY --from=builder /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

EXPOSE 3000
CMD ["sh", "-c", "npm --prefix apps/api run prisma:deploy && npm --prefix apps/api run start"]
