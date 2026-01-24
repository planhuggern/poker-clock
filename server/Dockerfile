
# Bruk Debian-basert image for bedre native støtte
FROM node:20-bullseye
WORKDIR /app
COPY package*.json ./
RUN npm install --production=false
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]
