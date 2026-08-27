FROM docker.arvancloud.ir/node:22-bookworm-slim

WORKDIR /app

# Install exactly what is pinned in package-lock.json.
# Disabling audit/funding keeps the image build deterministic and avoids
# unnecessary registry requests during Docker builds.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

RUN npm run build

# Static production server
RUN npm install -g serve --no-audit --no-fund

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
