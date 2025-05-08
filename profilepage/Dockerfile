FROM node:18

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

# Make sure DB connection is based on ENV (DB_HOST etc.)

EXPOSE 3002
CMD ["node", "index.js"]
