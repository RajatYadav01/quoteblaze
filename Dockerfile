# Use Node.js 22 (LTS) and Corepack so pnpm can be managed by packageManager in package.json.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# Copy the root and workspace manifests first. This lets Docker reuse the dependency
# installation layer when application source changes but package manifests do not.
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/schemas/package.json packages/schemas/package.json
COPY packages/constants/package.json packages/constants/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/pricing-engine/package.json packages/pricing-engine/package.json
COPY packages/e2e-tests/package.json packages/e2e-tests/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json

# Install workspace dependencies. --no-frozen-lockfile allows this image to build if a
# lockfile has not yet been committed; once pnpm-lock.yaml is checked in, prefer
# --frozen-lockfile for reproducible CI and production image builds.
RUN pnpm install --no-frozen-lockfile

# Add source and workspace packages after dependency installation to preserve layer caching.
# .dockerignore excludes local .env files, dependencies, build output, and test artifacts.
COPY . .

# Next.js can evaluate server modules during build. This placeholder DATABASE_URL is only
# for build-time module analysis; do not use it for real queries or migrations. The build
# does not migrate or seed the database. Supply the actual DATABASE_URL at runtime.
ARG DATABASE_URL
ARG NODE_ENV
RUN DATABASE_URL=${DATABASE_URL} pnpm --filter @quoteblaze/web build

# The same image runs the production Next.js server. Runtime secrets/database settings
# must be passed by the host (for example Vercel environment variables or docker run -e).
ENV NODE_ENV=$NODE_ENV
EXPOSE 3000
CMD ["pnpm", "--filter", "@quoteblaze/web", "start"]
