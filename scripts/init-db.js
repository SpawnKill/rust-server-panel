#!/usr/bin/env node

const sequelize = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
  try {
    console.log('🔄 Инициализация базы данных...');
    
    // Синхронизация моделей
    await sequelize.sync({ force: false, alter: true });
    console.log('✅ Модели синхронизированы');
    
    // Создание базовых данных
    const User = require('../src/models/User');
    const ShopCategory = require('../src/models/ShopCategory');
    
    // Создаем администратора если его нет
    const adminCount = await User.count({ where: { role: 'admin' } });
    if (adminCount === 0) {
      await User.create({
        username: 'admin',
        email: 'admin@localhost',
        password: 'admin123',
        role: 'superadmin',
        isActive: true
      });
      console.log('✅ Администратор создан (admin/admin123)');
    }
    
    // Создаем категории магазина
    const categories = [
      { name: 'Оружие', icon: '🔫', color: '#dc3545', sortOrder: 1 },
      { name: 'Ресурсы', icon: '⛏️', color: '#ffc107', sortOrder: 2 },
      { name: 'Строительство', icon: '🏗️', color: '#17a2b8', sortOrder: 3 },
      { name: 'Транспорт', icon: '🚗', color: '#28a745', sortOrder: 4 },
      { name: 'Одежда', icon: '👕', color: '#007bff', sortOrder: 5 },
      { name: 'Инструменты', icon: '🛠️', color: '#6c757d', sortOrder: 6 },
      { name: 'Медицина', icon: '💊', color: '#e83e8c', sortOrder: 7 },
      { name: 'Еда', icon: '🍖', color: '#fd7e14', sortOrder: 8 },
      { name: 'Скины', icon: '🎨', color: '#20c997', sortOrder: 9 },
      { name: 'Привилегии', icon: '👑', color: '#6610f2', sortOrder: 10 },
      { name: 'Наборы', icon: '🎁', color: '#6f42c1', sortOrder: 11 },
      { name: 'Разное', icon: '📦', color: '#343a40', sortOrder: 12 }
    ];
    
    for (const catData of categories) {
      await ShopCategory.findOrCreate({
        where: { name: catData.name },
        defaults: catData
      });
    }
    console.log('✅ Категории магазина созданы');
    
    console.log('🎉 Инициализация базы данных завершена!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Ошибка инициализации базы данных:', error);
    process.exit(1);
  }
}

// Запуск
if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;