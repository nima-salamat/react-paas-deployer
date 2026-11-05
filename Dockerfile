FROM docker.arvancloud.ir/node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./

ARG DOCKERFILE_NPM_MIRROR=https://registry.npmmirror.com

RUN npm config set registry ${DOCKERFILE_NPM_MIRROR} \
    && npm ci --no-audit --no-fund

COPY . .

# Vite/Rollup needs more than Node's default ~2 GiB heap for this application.
# Override at build time with --build-arg NODE_MAX_OLD_SPACE_SIZE=<MiB>.
ARG NODE_MAX_OLD_SPACE_SIZE=4096
RUN NODE_OPTIONS="--max-old-space-size=${NODE_MAX_OLD_SPACE_SIZE}" npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]