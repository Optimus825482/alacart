# ==========================================
# 1. Base Image
# ==========================================
FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat openssl curl netcat-openbsd tzdata
ENV TZ=Asia/Nicosia
WORKDIR /app

# ==========================================
# 2. Dependencies
# ==========================================
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --foreground-scripts || npm ci --no-audit --no-fund
RUN npm rebuild esbuild @prisma/engines || true

# ==========================================
# 3. Builder
# ==========================================
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma istemcisini derle
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npx prisma generate

# Next.js uygulamasını derle
RUN npm run build

# ==========================================
# 4. Production Runner
# ==========================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Güvenli kullanıcı ve ev dizini oluştur
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 -G nodejs -h /home/nextjs nextjs
RUN mkdir -p /home/nextjs/.npm /app/public/uploads /var/lib/alacarte/backups

ENV HOME=/home/nextjs
ENV PATH="/app/node_modules/.bin:$PATH"

# Derlenmiş dosyaları kopyala
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh
RUN chown -R nextjs:nodejs /app /var/lib/alacarte/backups /home/nextjs

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=20s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
