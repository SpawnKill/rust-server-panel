const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    // Получаем токен из заголовка Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Требуется авторизация. Токен не предоставлен.'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Требуется авторизация. Токен не предоставлен.'
      });
    }
    
    // Верифицируем токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Добавляем информацию о пользователе в запрос
    req.user = decoded;
    
    next();
    
  } catch (error) {
    console.error('Ошибка аутентификации:', error.message);
    
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
    
    res.status(401).json({
      success: false,
      error: 'Ошибка аутентификации'
    });
  }
};