FROM node:22-slim

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

# Copy package files
COPY package.json ./

# Install ALL deps (including devDeps like tsx, vite, typescript needed for build + runtime)
RUN npm install --include=optional

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build frontend
RUN npm run build

# Set production env AFTER install so devDeps (tsx) are available at runtime
ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "run", "start"]
