FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev=false

COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Bind quickly; world boots on first /api/start
CMD ["npx", "tsx", "src/ui/server.ts"]
