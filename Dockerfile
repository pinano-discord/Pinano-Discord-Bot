FROM node:10
COPY ./package.json ./package.json
COPY ./package-lock.json ./package-lock.json
COPY ./tsconfig.json ./tsconfig.json
RUN npm install
COPY ./src ./src
RUN npm run build
RUN node ./dist/app.js