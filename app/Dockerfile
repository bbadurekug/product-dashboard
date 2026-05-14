FROM node:20-alpine

ARG IMAGE_VERSION=v1

WORKDIR /app

COPY ./app/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY ./app/backend ./backend

LABEL version=$IMAGE_VERSION

EXPOSE 3000

USER node

ENV NODE_ENV=production PORT=3000

CMD ["node", "./backend/server.js"]