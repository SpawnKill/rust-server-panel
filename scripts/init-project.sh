#!/bin/bash

echo "Инициализация проекта Rust Server Web Panel..."

# Создаем все необходимые директории
mkdir -p src/{routes,controllers,services,middleware,utils,models,socket}
mkdir -p public/{css,js,assets/{icons,images},pages}
mkdir -p scripts config logs data tmp/uploads

# Создаем базовые файлы
touch logs/{error.log,combined.log,http.log,access.log}
touch data/{shop.db,panel.db}
echo '[]' > data/users.json

# Создаем placeholder файлы
echo 'Placeholder icon' > public/assets/icons/favicon.ico
echo 'Placeholder logo' > public/assets/images/logo.png
echo 'Placeholder item image' > public/assets/images/default-item.png

# Создаем файлы конфигурации
cat > config/default.json << 'EOF'
{
  "app": {
    "name": "Rust Server Panel",
    "version": "1.0.0",
    "port": 3000,
    "wsPort": 3001,
    "host": "0.0.0.0",
    "environment": "development",
    "logLevel": "info",
    "maxFileSize": 104857600,
    "sessionSecret": "change-this-in-production",
    "jwtSecret": "change-this-in-production",
    "jwtExpiresIn": "7d"
  }
}
EOF

cat > config/production.json << 'EOF'
{
  "app": {
    "name": "Rust Server Panel",
    "version": "1.0.0",
    "port": 3000,
    "wsPort": 3001,
    "host": "0.0.0.0",
    "environment": "production",
    "logLevel": "warn",
    "maxFileSize": 104857600,
    "sessionSecret": "CHANGE_THIS_TO_RANDOM_STRING_IN_PRODUCTION",
    "jwtSecret": "CHANGE_THIS_TO_RANDOM_STRING_IN_PRODUCTION",
    "jwtExpiresIn": "7d"
  }
}
EOF

echo "Проект инициализирован!"
echo "Структура создана, не забудьте:"
echo "1. Установить зависимости: npm install"
echo "2. Настроить .env файл: cp .env.example .env"
echo "3. Запустить инициализацию базы данных"