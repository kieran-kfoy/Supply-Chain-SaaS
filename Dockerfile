FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package.json ./

# Fresh install with optional deps (needed for @tailwindcss/oxide native binary)
RUN npm install --include=optional

# Copy source
COPY . .

# Build frontend
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
