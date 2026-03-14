FROM node:22-alpine

WORKDIR /app

# Copy package config and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

EXPOSE 5173

# Run Vite in dev mode, bound to all network interfaces (required in Docker)
CMD ["npm", "run", "dev", "--", "--host"]
