#!/bin/bash

# Установка SteamCMD для Ubuntu Server
set -e

echo "Установка SteamCMD..."

# Обновление системы
apt-get update
apt-get upgrade -y

# Установка зависимостей
apt-get install -y \
    lib32gcc1 \
    lib32stdc++6 \
    libc6-i386 \
    libcurl4-gnutls-dev:i386 \
    screen \
    wget \
    tar \
    curl

# Создание пользователя для сервера
if ! id "rustserver" >/dev/null 2>&1; then
    adduser --disabled-login --gecos '' rustserver
    echo "Пользователь rustserver создан"
fi

# Создание директории для SteamCMD
STEAMCMD_DIR="/home/steam/steamcmd"
mkdir -p $STEAMCMD_DIR
chown rustserver:rustserver $STEAMCMD_DIR

# Переключение на пользователя rustserver для установки SteamCMD
sudo -u rustserver bash << EOF
cd $STEAMCMD_DIR
if [ ! -f steamcmd.sh ]; then
    echo "Загрузка SteamCMD..."
    wget -q https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz
    tar -xvzf steamcmd_linux.tar.gz
    rm steamcmd_linux.tar.gz
fi

# Первый запуск SteamCMD для обновления
echo "Первичная настройка SteamCMD..."
./steamcmd.sh +quit
EOF

echo "SteamCMD установлен в $STEAMCMD_DIR"

# Создание директории для серверов
SERVER_DIR="/home/rustserver"
mkdir -p $SERVER_DIR
chown rustserver:rustserver $SERVER_DIR

echo "Установка завершена!"
echo ""
echo "Для установки сервера Rust выполните:"
echo "cd $STEAMCMD_DIR"
echo "./steamcmd.sh +force_install_dir /home/rustserver/server1 +login anonymous +app_update 258550 validate +quit"