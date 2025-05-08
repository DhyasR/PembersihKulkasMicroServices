FROM node:18

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

# Optional: If using Firebase Admin SDK
# Make sure to copy serviceAccountKey.json or use ENV config

EXPOSE 3001
CMD ["node", "index.js"]
