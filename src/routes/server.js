const express = require('express');
const router = express.Router();
const ServerController = require('../controllers/ServerController');
const { check } = require('express-validator');
const authMiddleware = require('../middleware/auth');

// Все маршруты требуют аутентификации
router.use(authMiddleware);

// Установка нового сервера
router.post('/install', [
  check('serverName').notEmpty().withMessage('Имя сервера обязательно'),
  check('worldSize').isInt({ min: 1000, max: 8000 }),
  check('maxPlayers').isInt({ min: 1, max: 500 })
], ServerController.installServer);

// Получение списка серверов
router.get('/list', ServerController.getServers);

// Управление конкретным сервером
router.post('/:serverId/control', [
  check('action').isIn(['start', 'stop', 'restart', 'kill'])
], ServerController.controlServer);

// Получение статуса сервера
router.get('/:serverId/status', ServerController.getServerStatus);

// Обновление сервера
router.post('/:serverId/update', ServerController.updateServer);

// Создание бэкапа
router.post('/:serverId/backup', ServerController.createBackup);

// Получение бэкапов сервера
router.get('/:serverId/backups', async (req, res) => {
  const { serverId } = req.params;
  const backupDir = `/home/rustserver/backups`;
  
  try {
    const fs = require('fs-extra');
    await fs.ensureDir(backupDir);
    
    const files = await fs.readdir(backupDir);
    const backups = files
      .filter(f => f.includes(`backup-${serverId}-`))
      .map(f => ({
        name: f,
        path: `${backupDir}/${f}`,
        created: fs.statSync(`${backupDir}/${f}`).mtime
      }))
      .sort((a, b) => b.created - a.created);
    
    res.json({ success: true, backups });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Восстановление из бэкапа
router.post('/:serverId/restore', async (req, res) => {
  const { serverId } = req.params;
  const { backupName } = req.body;
  
  try {
    const RCONService = require('../services/RCONService');
    const { exec } = require('child_process');
    const fs = require('fs-extra');
    
    // Останавливаем сервер
    await RCONService.controlServer(serverId, 'stop');
    
    const serverPath = `/home/rustserver/server-${serverId}`;
    const backupPath = `/home/rustserver/backups/${backupName}`;
    
    // Очищаем директорию сервера
    await fs.emptyDir(serverPath);
    
    // Восстанавливаем из бэкапа
    await new Promise((resolve, reject) => {
      exec(`tar -xzf ${backupPath} -C ${serverPath}`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    // Устанавливаем права
    exec(`chown -R rustserver:rustserver ${serverPath}`);
    
    // Запускаем сервер
    await RCONService.controlServer(serverId, 'start');
    
    res.json({ 
      success: true, 
      message: 'Бэкап успешно восстановлен' 
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;