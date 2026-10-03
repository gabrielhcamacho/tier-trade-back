FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.33.3 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build

FROM base AS production-dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM node:22-alpine AS runtime
RUN apk add --no-cache ca-certificates \
  && addgroup --system --gid 1001 tiertrade \
  && adduser --system --uid 1001 --ingroup tiertrade tiertrade
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=tiertrade:tiertrade /app/node_modules ./node_modules
COPY --from=build --chown=tiertrade:tiertrade /app/dist ./dist
COPY --chown=tiertrade:tiertrade package.json ./package.json
COPY --chown=tiertrade:tiertrade docker-entrypoint.sh ./docker-entrypoint.sh
COPY --chown=root:root certs/supabase-root-2021.crt /etc/ssl/certs/supabase-root-2021.crt
RUN chmod 755 ./docker-entrypoint.sh
USER tiertrade
EXPOSE 3001 9464
ENTRYPOINT ["/app/docker-entrypoint.sh"]
