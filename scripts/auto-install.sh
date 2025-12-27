#!/bin/bash

# Полный скрипт автоматической установки Rust Web Panel
set -e

echo "================================================"
echo "Установка Rust Server Web Panel"
echo "================================================"

# Проверка root прав
if [ "$EUID" -ne 0 ]; then 
    echo "Пожалуйста, запустите скрипт с правами root: sudo $0"
    exit 1
fi

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функции для вывода
print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Переменные
PANEL_USER="rustpanel"
PANEL_DIR="/opt/rust-server-panel"
PANEL_PORT="3000"
DOMAIN=""
EMAIL=""

# Получение параметров
while getopts "u:d:p:e:" opt; do
    case $opt in
        u) PANEL_USER="$OPTARG" ;;
        d) DOMAIN="$OPTARG" ;;
        p) PANEL_PORT="$OPTARG" ;;
        e) EMAIL="$OPTARG" ;;
        *) echo "Использование: $0 [-u пользователь] [-d домен] [-p порт] [-e email]"
           exit 1 ;;
    esac
done

print_info "Начинаем установку Rust Web Panel..."

# 1. Обновление системы
print_info "Обновление системы..."
apt-get update
apt-get upgrade -y
print_success "Система обновлена"

# 2. Установка Node.js
print_info "Установка Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
print_success "Node.js установлен: $(node --version)"

# 3. Установка системных зависимостей
print_info "Установка системных зависимостей..."
apt-get install -y \
    git \
    curl \
    wget \
    tar \
    gzip \
    screen \
    unzip \
    nginx \
    certbot \
    python3-certbot-nginx \
    ufw \
    fail2ban \
    lib32gcc1 \
    lib32stdc++6 \
    libc6-i386 \
    libcurl4-gnutls-dev:i386
print_success "Системные зависимости установлены"

# 4. Создание пользователя для панели
print_info "Создание пользователя $PANEL_USER..."
if ! id "$PANEL_USER" >/dev/null 2>&1; then
    adduser --disabled-password --gecos '' $PANEL_USER
    print_success "Пользователь $PANEL_USER создан"
else
    print_warning "Пользователь $PANEL_USER уже существует"
fi

# 5. Клонирование репозитория
print_info "Клонирование репозитория..."
if [ -d "$PANEL_DIR" ]; then
    print_warning "Директория $PANEL_DIR уже существует, обновляем..."
    cd $PANEL_DIR
    git pull
else
    git clone https://github.com/yourusername/rust-server-panel.git $PANEL_DIR
    cd $PANEL_DIR
fi
print_success "Репо клонирован/обновлен"

# 6. Установка Node.js зависимостей
print_info "Установка Node.js зависимостей..."
npm ci --only=production
print_success "Зависимости установлены"

# 7. Настройка переменных окружения
print_info "Настройка переменных окружения..."
if [ ! -f .env ]; then
    cp .env.example .env
    
    # Генерация секретных ключей
    JWT_SECRET=$(openssl rand -base64 32)
    SESSION_SECRET=$(openssl rand -base64 32)
    
    # Замена значений в .env
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
    sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" .env
    sed -i "s|PORT=.*|PORT=$PANEL_PORT|" .env
    sed -i "s|HOST=.*|HOST=0.0.0.0|" .env
    
    print_success "Файл .env создан"
else
    print_warning "Файл .env уже существует, пропускаем..."
fi

# 8. Установка SteamCMD
print_info "Установка SteamCMD..."
bash scripts/install-steamcmd.sh
print_success "SteamCMD установлен"

# 9. Настройка прав
print_info "Настройка прав доступа..."
chown -R $PANEL_USER:$PANEL_USER $PANEL_DIR
chmod +x scripts/*.sh
print_success "Права настроены"

# 10. Настройка systemd сервиса
print_info "Настройка systemd сервиса..."
bash scripts/setup-systemd.sh $PANEL_USER $PANEL_DIR $PANEL_PORT production
print_success "Systemd сервис настроен"

# 11. Настройка UFW
print_info "Настройка фаервола..."
ufw allow ssh
ufw allow $PANEL_PORT/tcp
ufw allow 28015:28020/tcp  # Порты Rust сервера
ufw --force enable
print_success "Фаервол настроен"

# 12. Настройка Nginx (если указан домен)
if [ -n "$DOMAIN" ]; then
    print_info "Настройка Nginx для домена $DOMAIN..."
    
    # Создание конфига Nginx
    cat > /etc/nginx/sites-available/rust-panel << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    location / {
        proxy_pass http://127.0.0.1:$PANEL_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
    
    location /static/ {
        alias $PANEL_DIR/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    # Активация сайта
    ln -sf /etc/nginx/sites-available/rust-panel /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Перезагрузка Nginx
    nginx -t
    systemctl restart nginx
    
    # Получение SSL сертификата
    if [ -n "$EMAIL" ]; then
        print_info "Получение SSL сертификата Let's Encrypt..."
        certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL
        print_success "SSL сертификат получен"
    else
        print_warning "Email не указан, SSL сертификат не получен"
    fi
    
    print_success "Nginx настроен"
fi

# 13. Настройка fail2ban
print_info "Настройка fail2ban..."
cat > /etc/fail2ban/jail.local << EOF
[rust-panel]
enabled = true
port = $PANEL_PORT
filter = rust-panel
logpath = /var/log/rust-panel/access.log
maxretry = 5
bantime = 3600
EOF

cat > /etc/fail2ban/filter.d/rust-panel.conf << EOF
[Definition]
failregex = ^<HOST> -.*"(GET|POST|PUT|DELETE).*" 4[0-9][0-9] .*$
ignoreregex =
EOF

systemctl restart fail2ban
print_success "Fail2ban настроен"

# 14. Настройка логирования
print_info "Настройка ротации логов..."
cat > /etc/logrotate.d/rust-panel << EOF
$PANEL_DIR/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 $PANEL_USER $PANEL_USER
    sharedscripts
    postrotate
        systemctl reload rust-web-panel > /dev/null 2>&1 || true
    endscript
}
EOF
print_success "Ротация логов настроена"

# 15. Настройка бэкапов
print_info "Настройка ежедневных бэкапов..."
cat > /etc/cron.daily/rust-panel-backup << EOF
#!/bin/bash
BACKUP_DIR="/backup/rust-panel"
DATE=\$(date +%Y%m%d)
mkdir -p \$BACKUP_DIR

# Бэкап базы данных
if [ -f "$PANEL_DIR/data/panel.db" ]; then
    cp "$PANEL_DIR/data/panel.db" "\$BACKUP_DIR/panel-\$DATE.db"
fi

# Бэкап конфигов
tar -czf "\$BACKUP_DIR/config-\$DATE.tar.gz" -C $PANEL_DIR .env config/

# Удаление старых бэкапов (старше 30 дней)
find \$BACKUP_DIR -name "*.db" -mtime +30 -delete
find \$BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
EOF

chmod +x /etc/cron.daily/rust-panel-backup
mkdir -p /backup/rust-panel
chown -R $PANEL_USER:$PANEL_USER /backup/rust-panel
print_success "Бэкапы настроены"

# 16. Запуск панели
print_info "Запуск панели..."
systemctl start rust-web-panel
systemctl enable rust-web-panel

# Ждем запуска
sleep 3

# Проверка статуса
if systemctl is-active --quiet rust-web-panel; then
    print_success "Панель успешно запущена"
else
    print_error "Ошибка запуска панели"
    journalctl -u rust-web-panel -n 50 --no-pager
    exit 1
fi

# 17. Вывод информации
echo ""
echo "================================================"
echo "Установка завершена успешно!"
echo "================================================"
echo ""
echo "Данные для доступа:"
echo "  • Панель управления: http://$(hostname -I | awk '{print $1}'):$PANEL_PORT"
if [ -n "$DOMAIN" ]; then
    echo "  • Домен: https://$DOMAIN"
fi
echo "  • Логин по умолчанию: admin"
echo "  • Пароль по умолчанию: admin123"
echo ""
echo "Важные команды:"
echo "  • Статус панели: systemctl status rust-web-panel"
echo "  • Логи панели: journalctl -u rust-web-panel -f"
echo "  • Перезагрузка: systemctl restart rust-web-panel"
echo "  • Установка сервера Rust: через веб-панель"
echo ""
echo "Рекомендуется:"
echo "  1. Сразу сменить пароль администратора"
echo "  2. Настроить бэкапы серверов"
echo "  3. Добавить свой Steam API ключ"
echo "================================================"

# Создание файла с информацией об установке
cat > $PANEL_DIR/INSTALL_INFO.txt << EOF
Установка Rust Web Panel завершена
Дата: $(date)
Версия: 1.0.0
Пользователь: $PANEL_USER
Директория: $PANEL_DIR
Порт: $PANEL_PORT
Домен: ${DOMAIN:-не указан}
Email: ${EMAIL:-не указан}

Доступ к панели: http://$(hostname -I | awk '{print $1}'):$PANEL_PORT
${DOMAIN:+Домен: https://$DOMAIN}

Логин: admin
Пароль: admin123

ВАЖНО: Немедленно смените пароль администратора!

Команды управления:
  systemctl status rust-web-panel    # Статус
  journalctl -u rust-web-panel -f    # Логи
  systemctl restart rust-web-panel   # Перезагрузка
  systemctl stop rust-web-panel      # Остановка

Бэкапы хранятся в: /backup/rust-panel
Логи панели: $PANEL_DIR/logs/
EOF

print_info "Информация об установке сохранена в $PANEL_DIR/INSTALL_INFO.txt"