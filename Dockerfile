FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better Docker layer caching
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Copy source and build
COPY . .

# Build renderer + main/preload output into dist/
RUN npm run build

# This image is intended as a build container.
# Use a bind mount to copy dist/ artifacts back to the host.
CMD ["npm", "run", "build"]
