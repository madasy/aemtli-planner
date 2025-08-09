FROM node:20-alpine
WORKDIR /app

# Add OpenSSL 1.1 compatibility (may not exist on newer Alpine)
RUN apk add --no-cache openssl1.1-compat || apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY prisma ./prisma
RUN npx prisma generate


COPY src ./src
RUN npm run build

EXPOSE 4000
CMD npx prisma migrate deploy && node dist/seed.js && node dist/index.js
