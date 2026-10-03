# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
ARG VITE_API_BASE_URL=/api
ARG VITE_RSA_KEY_ID=rsa-2026-08
ARG VITE_RSA_PUBLIC_KEY
ENV VITE_USE_MOCK=false \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_RSA_KEY_ID=$VITE_RSA_KEY_ID \
    VITE_RSA_PUBLIC_KEY=$VITE_RSA_PUBLIC_KEY
RUN npm run build

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s CMD wget -q --spider http://127.0.0.1/ || exit 1
