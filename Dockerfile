# syntax=docker/dockerfile:1
FROM lwthiker/curl-impersonate:0.6-chrome-slim-bullseye

FROM node:22

RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
        fonts-ipafont-gothic \
        fonts-wqy-zenhei \
        fonts-thai-tlwg \
        fonts-kacst \
        fonts-kacst-one \
        fonts-freefont-ttf \
        fonts-dejavu \
        fonts-liberation \
        fonts-noto-color-emoji \
        fonts-opensymbol \
        libxss1 zstd \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY --from=0 /usr/local/lib/libcurl-impersonate.so /usr/local/lib/libcurl-impersonate.so

RUN groupadd -r jina
RUN useradd -g jina  -G audio,video -m jina
USER jina

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# COPY build ./build
# COPY licensed ./licensed
COPY integrity-check.cjs .
COPY tsconfig.json .
COPY src ./src
COPY public ./public

RUN rm -rf ~/.config/chromium && mkdir -p ~/.config/chromium

RUN mkdir -p licensed && curl -o licensed/GeoLite2-City.mmdb https://raw.githubusercontent.com/P3TERX/GeoLite.mmdb/download/GeoLite2-City.mmdb
RUN curl -o licensed/SourceHanSansSC-Regular.otf https://raw.githubusercontent.com/adobe-fonts/source-han-sans/refs/heads/release/OTF/SimplifiedChinese/SourceHanSansSC-Regular.otf

RUN NODE_COMPILE_CACHE=node_modules npm run build
RUN NODE_COMPILE_CACHE=node_modules npm run dry-run

ENV OVERRIDE_CHROME_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV LD_PRELOAD=/usr/local/lib/libcurl-impersonate.so CURL_IMPERSONATE=chrome116 CURL_IMPERSONATE_HEADERS=no
ENV NODE_COMPILE_CACHE=node_modules
ENV PORT=8080

EXPOSE 3000 3001 8080 8081
ENTRYPOINT ["node"]
CMD [ "build/stand-alone/crawl.js" ]
