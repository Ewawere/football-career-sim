FROM node:20-alpine
WORKDIR /app

# Install ALL deps (tsx is required at runtime)
COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Railway injects PORT at runtime
ENV NODE_ENV=production
EXPOSE 8080

CMD ["npx", "tsx", "src/ui/server.ts"]
