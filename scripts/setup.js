#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function setup() {
  console.log('🎮 Настройка Rust Server Web Panel');
  console.log('==================================');
  
  try {
    // 1. Проверка Node.js
    const nodeVersion = process.version;
    console.log(`✅ Node.js ${nodeVersion}`);
    
    // 2. Установка зависимостей
    console.log('\n📦 Установка зависимостей...');
    execSync('npm install', { stdio: 'inherit' });
    
    // 3. Копирование .env файла
    if (!fs.existsSync('.env')) {
      fs.copyFileSync('.env.example', '.env');
      console.log('✅ Файл .env создан');
    }
    
    // 4. Запрос настроек
    rl.question('\nВведите порт панели (по умолчанию 3000): ', (port) => {
      port = port || '3000';
      
      rl.question('Введите секретный ключ JWT (оставьте пустым для генерации): ', (jwtSecret) => {
        jwtSecret = jwtSecret || require('crypto').randomBytes(32).toString('hex');
        
        // Обновление .env файла
        let envContent = fs.readFileSync('.env', 'utf8');
        envContent = envContent.replace(/PORT=.*/, `PORT=${port}`);
        envContent = envContent.replace(/JWT_SECRET=.*/, `JWT_SECRET=${jwtSecret}`);
        fs.writeFileSync('.env', envContent);
        
        console.log('\n✅ Настройки сохранены');
        
        // 5. Инициализация базы данных
        console.log('\n🗄️  Инициализация базы данных...');
        try {
          require('./init-db')();
        } catch (error) {
          console.log('⚠️  Для инициализации БД выполните: npm run init-db');
        }
        
        console.log('\n🎉 Настройка завершена!');
        console.log('\nСледующие шаги:');
        console.log('1. Настройте SteamCMD: npm run install-steamcmd');
        console.log('2. Запустите панель: npm run dev');
        console.log('3. Откройте в браузере: http://localhost:' + port);
        console.log('4. Логин: admin, Пароль: admin123');
        
        rl.close();
      });
    });
    
  } catch (error) {
    console.error('❌ Ошибка настройки:', error.message);
    rl.close();
  }
}

setup();