FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/

RUN npm install

COPY . .

RUN npm --prefix apps/api run prisma:generate && npm --prefix apps/api run build

EXPOSE 3000
CMD ["sh", "-c", "npm --prefix apps/api run prisma:deploy && npm --prefix apps/api run start"]
