FROM node:18-alpine

# Установка системных зависимостей
RUN apk add --no-cache \
    bash \
    curl \
    wget \
    tar \
    gzip \
    sudo \
    screen \
    libstdc++ \
    libgcc \
    libcurl \
    ca-certificates \
    tzdata

# Создание пользователей
RUN adduser -D -s /bin/bash rustserver && \
    adduser -D -s /bin/bash steamuser && \
    echo "rustserver ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers && \
    echo "steamuser ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

# Установка SteamCMD
RUN mkdir -p /home/steam/steamcmd && \
    cd /home/steam/steamcmd && \
    wget -q https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz && \
    tar -xvzf steamcmd_linux.tar.gz && \
    rm steamcmd_linux.tar.gz && \
    chown -R steamuser:steamuser /home/steam && \
    chown -R rustserver:rustserver /home/rustserver

# Настройка рабочей директории
WORKDIR /app

# Копирование package.json и установка зависимостей
COPY package*.json ./
RUN npm ci --only=production

# Копирование исходного кода
COPY . .

# Создание необходимых директорий
RUN mkdir -p /app/data /app/logs /app/public/shop/images && \
    chown -R node:node /app && \
    chmod +x /app/scripts/*.sh

# Настройка прав
RUN chown -R rustserver:rustserver /home/rustserver && \
    chown -R steamuser:steamuser /home/steam

# Переключение на непривилегированного пользователя
USER node

# Открытие портов
EXPOSE 3000 3001

# Настройка переменных окружения
ENV NODE_ENV=production \
    PORT=3000 \
    WS_PORT=3001 \
    RUST_SERVER_PATH=/home/rustserver \
    STEAMCMD_PATH=/home/steam/steamcmd

# Команда запуска
CMD ["node", "server.js"]