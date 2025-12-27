#!/bin/bash

# Настройка systemd сервиса для панели управления
set -e

echo "Настройка systemd сервиса для Rust Web Panel..."

# Параметры
PANEL_USER=${1:-$USER}
PANEL_DIR=${2:-$(pwd)}
PANEL_PORT=${3:-3000}
NODE_ENV=${4:-production}

# Создание пользователя для панели если нужно
if ! id "$PANEL_USER" >/dev/null 2>&1; then
    adduser --disabled-password --gecos '' $PANEL_USER
    echo "Пользователь $PANEL_USER создан"
fi

# Установка прав на директорию
chown -R $PANEL_USER:$PANEL_USER $PANEL_DIR

# Создание systemd сервиса
SERVICE_NAME="rust-web-panel"
cat > /etc/systemd/system/$SERVICE_NAME.service << EOF
[Unit]
Description=Rust Server Web Panel
After=network.target
Wants=network.target

[Service]
Type=simple
User=$PANEL_USER
Group=$PANEL_USER
WorkingDirectory=$PANEL_DIR
Environment=NODE_ENV=$NODE_ENV
Environment=PATH=/usr/bin:/usr/local/bin
ExecStart=/usr/bin/node $PANEL_DIR/server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=$SERVICE_NAME

# Ограничения безопасности
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$PANEL_DIR /home/rustserver
ReadOnlyPaths=/usr /lib /lib64
InaccessiblePaths=/boot /root /sys /proc /var/lib/docker

[Install]
WantedBy=multi-user.target
EOF

# Настройка sudoers для безопасного выполнения команд
cat > /etc/sudoers.d/rust-panel << EOF
# Разрешения для Rust Web Panel
$PANEL_USER ALL=(rustserver) NOPASSWD: /bin/systemctl start rust-server-*
$PANEL_USER ALL=(rustserver) NOPASSWD: /bin/systemctl stop rust-server-*
$PANEL_USER ALL=(rustserver) NOPASSWD: /bin/systemctl restart rust-server-*
$PANEL_USER ALL=(rustserver) NOPASSWD: /bin/systemctl status rust-server-*
$PANEL_USER ALL=(rustserver) NOPASSWD: /bin/journalctl -u rust-server-* -f
$PANEL_USER ALL=(rustserver) NOPASSWD: /bin/tail -f /home/rustserver/*/server.log
EOF

chmod 440 /etc/sudoers.d/rust-panel

# Настройка firewalld если установлен
if command -v ufw &> /dev/null; then
    ufw allow $PANEL_PORT/tcp
    echo "Порт $PANEL_PORT открыт в UFW"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=$PANEL_PORT/tcp
    firewall-cmd --reload
    echo "Порт $PANEL_PORT открыт в firewalld"
fi

# Обновление systemd и запуск сервиса
systemctl daemon-reload
systemctl enable $SERVICE_NAME
systemctl start $SERVICE_NAME

echo ""
echo "================================================"
echo "Rust Web Panel настроен как systemd сервис!"
echo "================================================"
echo "Сервис: $SERVICE_NAME"
echo "Пользователь: $PANEL_USER"
echo "Директория: $PANEL_DIR"
echo "Порт: $PANEL_PORT"
echo ""
echo "Управление:"
echo "  Запуск: systemctl start $SERVICE_NAME"
echo "  Остановка: systemctl stop $SERVICE_NAME"
echo "  Перезагрузка: systemctl restart $SERVICE_NAME"
echo "  Статус: systemctl status $SERVICE_NAME"
echo "  Логи: journalctl -u $SERVICE_NAME -f"
echo ""
echo "Панель доступна по адресу: http://your-server-ip:$PANEL_PORT"
echo "================================================"