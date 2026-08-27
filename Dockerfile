FROM docker.arvancloud.ir/node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./

ARG DOCKERFILE_NPM_MIRROR=https://registry.npmmirror.com

RUN npm config set registry ${DOCKERFILE_NPM_MIRROR} \
    && npm ci --no-audit --no-fund

COPY . .

RUN npm run build

RUN npm install -g serve --no-audit --no-fund

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]