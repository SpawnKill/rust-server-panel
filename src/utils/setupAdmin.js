const fs = require('fs-extra');
const path = require('path');
const bcrypt = require('bcryptjs');
const logger = require('./logger');

module.exports = async () => {
  try {
    const usersPath = path.join(__dirname, '../../data/users.json');
    
    // Проверяем существует ли файл пользователей
    if (!await fs.pathExists(usersPath)) {
      logger.info('Файл пользователей не найден, создаем администратора по умолчанию...');
      
      // Создаем директорию если её нет
      await fs.ensureDir(path.dirname(usersPath));
      
      // Создаем администратора по умолчанию
      const defaultUsers = [
        {
          id: 1,
          username: 'admin',
          password: await bcrypt.hash('admin123', 10),
          email: 'admin@localhost',
          role: 'admin',
          createdAt: new Date().toISOString(),
          lastLogin: null
        }
      ];
      
      await fs.writeJson(usersPath, defaultUsers, { spaces: 2 });
      logger.success('Администратор по умолчанию создан');
      logger.warning('⚠️  Пожалуйста, немедленно смените пароль администратора!');
      logger.info('Логин: admin | Пароль: admin123');
    } else {
      // Проверяем наличие администратора
      const users = await fs.readJson(usersPath);
      const adminExists = users.some(user => user.role === 'admin');
      
      if (!adminExists) {
        logger.warning('Администратор не найден, добавляем...');
        
        users.push({
          id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
          username: 'admin',
          password: await bcrypt.hash('admin123', 10),
          email: 'admin@localhost',
          role: 'admin',
          createdAt: new Date().toISOString(),
          lastLogin: null
        });
        
        await fs.writeJson(usersPath, users, { spaces: 2 });
        logger.success('Администратор добавлен');
      }
    }
    
    return true;
  } catch (error) {
    logger.error(`Ошибка настройки администратора: ${error.message}`);
    return false;
  }
};