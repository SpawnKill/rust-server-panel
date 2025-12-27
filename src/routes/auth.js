const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const fs = require('fs-extra');
const path = require('path');

// Путь к файлу с пользователями
const usersFilePath = path.join(__dirname, '../../data/users.json');

// Инициализация файла пользователей
const initUsersFile = async () => {
  try {
    await fs.ensureDir(path.dirname(usersFilePath));
    
    if (!await fs.pathExists(usersFilePath)) {
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
      
      await fs.writeJson(usersFilePath, defaultUsers, { spaces: 2 });
    }
  } catch (error) {
    console.error('Ошибка инициализации users.json:', error);
  }
};

// Получение пользователей
const getUsers = async () => {
  await initUsersFile();
  return await fs.readJson(usersFilePath);
};

// Сохранение пользователей
const saveUsers = async (users) => {
  await fs.writeJson(usersFilePath, users, { spaces: 2 });
};

// Регистрация
router.post('/register', [
  body('username').isLength({ min: 3 }).withMessage('Имя пользователя должно быть не менее 3 символов'),
  body('password').isLength({ min: 6 }).withMessage('Пароль должен быть не менее 6 символов'),
  body('email').isEmail().withMessage('Введите корректный email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    const { username, password, email } = req.body;
    const users = await getUsers();
    
    // Проверяем существует ли пользователь
    if (users.find(u => u.username === username)) {
      return res.status(400).json({
        success: false,
        error: 'Пользователь с таким именем уже существует'
      });
    }
    
    if (users.find(u => u.email === email)) {
      return res.status(400).json({
        success: false,
        error: 'Пользователь с таким email уже существует'
      });
    }
    
    // Хэшируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Создаем нового пользователя
    const newUser = {
      id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
      username,
      password: hashedPassword,
      email,
      role: 'user', // По умолчанию обычный пользователь
      createdAt: new Date().toISOString(),
      lastLogin: null
    };
    
    users.push(newUser);
    await saveUsers(users);
    
    // Создаем JWT токен
    const token = jwt.sign(
      { 
        userId: newUser.id, 
        username: newUser.username,
        role: newUser.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    // Не возвращаем пароль в ответе
    const { password: _, ...userWithoutPassword } = newUser;
    
    res.json({
      success: true,
      message: 'Регистрация успешна',
      user: userWithoutPassword,
      token
    });
    
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при регистрации'
    });
  }
});

// Вход
router.post('/login', [
  body('username').notEmpty().withMessage('Имя пользователя обязательно'),
  body('password').notEmpty().withMessage('Пароль обязателен')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    const { username, password } = req.body;
    const users = await getUsers();
    
    // Ищем пользователя
    const user = users.find(u => u.username === username);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Неверное имя пользователя или пароль'
      });
    }
    
    // Проверяем пароль
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Неверное имя пользователя или пароль'
      });
    }
    
    // Обновляем время последнего входа
    user.lastLogin = new Date().toISOString();
    await saveUsers(users);
    
    // Создаем JWT токен
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username,
        role: user.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    // Не возвращаем пароль в ответе
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      message: 'Вход выполнен успешно',
      user: userWithoutPassword,
      token
    });
    
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при входе'
    });
  }
});

// Проверка токена
router.post('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Токен не предоставлен'
      });
    }
    
    // Верифицируем токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Получаем пользователя
    const users = await getUsers();
    const user = users.find(u => u.id === decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Пользователь не найден'
      });
    }
    
    // Не возвращаем пароль в ответе
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      user: userWithoutPassword,
      token
    });
    
  } catch (error) {
    console.error('Ошибка верификации токена:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Неверный токен'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Токен истек'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при верификации токена'
    });
  }
});

// Выход
router.post('/logout', (req, res) => {
  // В JWT-based аутентификации выход происходит на клиенте
  // путем удаления токена
  res.json({
    success: true,
    message: 'Выход выполнен успешно'
  });
});

// Получение информации о текущем пользователе
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Токен не предоставлен'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const users = await getUsers();
    const user = users.find(u => u.id === decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Пользователь не найден'
      });
    }
    
    // Не возвращаем пароль в ответе
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      user: userWithoutPassword
    });
    
  } catch (error) {
    console.error('Ошибка получения информации о пользователе:', error);
    res.status(401).json({
      success: false,
      error: 'Неавторизован'
    });
  }
});

// Изменение пароля
router.post('/change-password', [
  body('currentPassword').notEmpty().withMessage('Текущий пароль обязателен'),
  body('newPassword').isLength({ min: 6 }).withMessage('Новый пароль должен быть не менее 6 символов')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    const { currentPassword, newPassword } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Токен не предоставлен'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const users = await getUsers();
    const userIndex = users.findIndex(u => u.id === decoded.userId);
    
    if (userIndex === -1) {
      return res.status(401).json({
        success: false,
        error: 'Пользователь не найден'
      });
    }
    
    const user = users[userIndex];
    
    // Проверяем текущий пароль
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Текущий пароль неверен'
      });
    }
    
    // Хэшируем новый пароль
    user.password = await bcrypt.hash(newPassword, 10);
    users[userIndex] = user;
    await saveUsers(users);
    
    res.json({
      success: true,
      message: 'Пароль успешно изменен'
    });
    
  } catch (error) {
    console.error('Ошибка изменения пароля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при изменении пароля'
    });
  }
});

module.exports = router;