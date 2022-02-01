FROM node:16

WORKDIR /opt/app/ipblocker

COPY package*.json ./

RUN npm install

COPY app.js .
COPY ./src/ .
COPY ./config/ .


EXPOSE 3000

CMD [ "npm", "start" ]
