FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package.json ./

# Fresh install with optional deps (needed for @tailwindcss/oxide native binary)
RUN npm install --include=optional

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build frontend
RUN npm run build

EXPOSE $PORT

CMD ["npm", "run", "start"]
