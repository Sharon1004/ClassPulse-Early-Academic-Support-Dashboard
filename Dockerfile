# Works on any free container host (Render, Fly.io, Koyeb, Hugging Face Spaces, Railway...).
FROM node:20-alpine AS build
WORKDIR /app
COPY client/package*.json client/
RUN npm ci --prefix client
COPY client client
RUN npm run build --prefix client

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server/package*.json server/
RUN npm ci --omit=dev --prefix server
COPY server server
COPY sample-data sample-data
COPY --from=build /app/client/dist client/dist
RUN mkdir -p server/data && chown -R node:node /app
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:${PORT:-5000}/api/health || exit 1
CMD ["node", "server/index.js"]
