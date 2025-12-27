#!/bin/bash

# Автоматическая установка сервера Rust
set -e

echo "Установка сервера Rust..."

# Параметры
SERVER_NAME=${1:-"My Rust Server"}
WORLD_SIZE=${2:-3000}
MAX_PLAYERS=${3:-50}
SERVER_PORT=${4:-28015}
RCON_PORT=${5:-28016}
RCON_PASSWORD=${6:-$(openssl rand -base64 12)}

# Проверка SteamCMD
STEAMCMD_DIR="/home/steam/steamcmd"
if [ ! -f "$STEAMCMD_DIR/steamcmd.sh" ]; then
    echo "SteamCMD не найден. Сначала запустите install-steamcmd.sh"
    exit 1
fi

# Создание директории для сервера
SERVER_ID=$(date +%s)
SERVER_DIR="/home/rustserver/server-$SERVER_ID"
mkdir -p $SERVER_DIR

echo "Установка в директорию: $SERVER_DIR"
echo "Параметры сервера:"
echo "  Имя: $SERVER_NAME"
echo "  Размер мира: $WORLD_SIZE"
echo "  Макс. игроков: $MAX_PLAYERS"
echo "  Порт: $SERVER_PORT"
echo "  RCON порт: $RCON_PORT"

# Установка сервера через SteamCMD
sudo -u rustserver bash << EOF
cd $STEAMCMD_DIR
echo "Начинаем загрузку сервера Rust..."
./steamcmd.sh +force_install_dir $SERVER_DIR +login anonymous +app_update 258550 validate +quit
EOF

# Создание конфигурационных файлов
echo "Создание конфигурационных файлов..."

# server.cfg
cat > $SERVER_DIR/server.cfg << EOF
hostname "$SERVER_NAME"
description "Rust Server managed by Web Panel"
port $SERVER_PORT
rcon.port $RCON_PORT
rcon.password "$RCON_PASSWORD"
rcon.web 1
server.maxplayers $MAX_PLAYERS
server.seed $RANDOM
server.worldsize $WORLD_SIZE
server.saveinterval 300
server.tickrate 30
server.identity "server"
server.level "Procedural Map"
server.url ""
server.headerimage ""
server.logo ""
EOF

# Создание директории идентификации
mkdir -p $SERVER_DIR/serveridentity/cfg

# users.cfg (добавьте свои SteamID)
cat > $SERVER_DIR/serveridentity/cfg/users.cfg << EOF
// Формат: ownerid "STEAMID" "username" "group"
// Пример: ownerid "76561197960287930" "admin" "admin"
EOF

# Создание systemd сервиса
SERVICE_NAME="rust-server-$SERVER_ID"
cat > /etc/systemd/system/$SERVICE_NAME.service << EOF
[Unit]
Description=Rust Server $SERVER_ID
After=network.target

[Service]
Type=simple
User=rustserver
Group=rustserver
WorkingDirectory=$SERVER_DIR
ExecStart=$SERVER_DIR/RustDedicated -batchmode \\
  +server.port $SERVER_PORT \\
  +server.level "Procedural Map" \\
  +server.seed $RANDOM \\
  +server.worldsize $WORLD_SIZE \\
  +server.maxplayers $MAX_PLAYERS \\
  +server.hostname "$SERVER_NAME" \\
  +server.description "Rust Server" \\
  +server.url "" \\
  +server.headerimage "" \\
  +server.logo "" \\
  +rcon.port $RCON_PORT \\
  +rcon.password "$RCON_PASSWORD" \\
  +rcon.web 1
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

# Ограничения ресурсов
LimitNOFILE=100000
LimitNPROC=100000

[Install]
WantedBy=multi-user.target
EOF

# Обновление systemd и запуск сервиса
systemctl daemon-reload
systemctl enable $SERVICE_NAME
systemctl start $SERVER_NAME

# Установка прав
chown -R rustserver:rustserver $SERVER_DIR

echo ""
echo "================================================"
echo "Сервер Rust успешно установлен!"
echo "================================================"
echo "ID сервера: $SERVER_ID"
echo "Директория: $SERVER_DIR"
echo "Systemd сервис: $SERVICE_NAME"
echo ""
echo "RCON пароль: $RCON_PASSWORD"
echo "RCON порт: $RCON_PORT"
echo ""
echo "Управление:"
echo "  Запуск: systemctl start $SERVICE_NAME"
echo "  Остановка: systemctl stop $SERVICE_NAME"
echo "  Статус: systemctl status $SERVICE_NAME"
echo "  Логи: journalctl -u $SERVICE_NAME -f"
echo ""
echo "Web панель: http://your-server-ip:3000"
echo "================================================"