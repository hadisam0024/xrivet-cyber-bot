FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY bot.js cyber.js server.js games.js menu.png ./
EXPOSE 3000
CMD ["node", "server.js"]
