FROM apify/actor-node-playwright-chrome:24-1.63.0-slim

WORKDIR /home/myuser

COPY --chown=myuser:myuser package*.json Dockerfile ./
RUN npm --quiet set progress=false \
    && npm install --omit=dev --include=optional \
    && rm -rf ~/.npm

COPY --chown=myuser:myuser . ./

ENV APIFY_LOG_LEVEL=INFO

CMD npm start --silent
