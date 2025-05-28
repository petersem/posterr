FROM node:24.1.0
# tzdata for timzone and net-tools
RUN apt update 
RUN apt install tzdata
RUN apt install net-tools

ENV NODE_ENV=production

WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]

RUN npm install --production --silent && mv node_modules ../

COPY . .
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=15s CMD node healthcheck.js > /dev/null || exit 1
CMD ["node", "index.js"]
