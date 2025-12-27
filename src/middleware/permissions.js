module.exports = (requiredRole) => {
  return (req, res, next) => {
    try {
      // Проверяем наличие пользователя в запросе
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Требуется авторизация'
        });
      }
      
      const userRole = req.user.role || 'user';
      
      // Определяем иерархию ролей
      const roleHierarchy = {
        'user': 1,
        'moderator': 2,
        'admin': 3,
        'superadmin': 4
      };
      
      // Проверяем достаточно ли прав у пользователя
      if (roleHierarchy[userRole] >= roleHierarchy[requiredRole]) {
        return next();
      }
      
      return res.status(403).json({
        success: false,
        error: 'Недостаточно прав для выполнения этого действия'
      });
      
    } catch (error) {
      console.error('Ошибка проверки прав:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка проверки прав доступа'
      });
    }
  };
};