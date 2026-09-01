FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev=false
COPY . .
ENV PORT=3847
EXPOSE 3847
CMD ["npx", "tsx", "src/ui/server.ts"]
