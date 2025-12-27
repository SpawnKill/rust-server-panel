const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ServerSettings = sequelize.define('ServerSettings', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  serverId: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false,
    comment: 'Уникальный идентификатор сервера'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'Rust Server'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  hostname: {
    type: DataTypes.STRING(100),
    defaultValue: 'Rust Server'
  },
  port: {
    type: DataTypes.INTEGER,
    defaultValue: 28015,
    validate: {
      min: 1,
      max: 65535
    }
  },
  rconPort: {
    type: DataTypes.INTEGER,
    defaultValue: 28016,
    validate: {
      min: 1,
      max: 65535
    }
  },
  rconPassword: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  maxPlayers: {
    type: DataTypes.INTEGER,
    defaultValue: 50,
    validate: {
      min: 1,
      max: 500
    }
  },
  worldSize: {
    type: DataTypes.INTEGER,
    defaultValue: 3000,
    validate: {
      min: 1000,
      max: 8000
    }
  },
  seed: {
    type: DataTypes.INTEGER,
    defaultValue: () => Math.floor(Math.random() * 1000000)
  },
  saveInterval: {
    type: DataTypes.INTEGER,
    defaultValue: 300,
    comment: 'Интервал сохранения в секундах'
  },
  tickRate: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
    validate: {
      min: 10,
      max: 100
    }
  },
  map: {
    type: DataTypes.ENUM('Procedural Map', 'Barren', 'Savas Island', 'Savas Island Koth'),
    defaultValue: 'Procedural Map'
  },
  level: {
    type: DataTypes.STRING(50),
    defaultValue: 'Procedural Map'
  },
  url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  headerImage: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  logo: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  identity: {
    type: DataTypes.STRING(50),
    defaultValue: 'server'
  },
  secure: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  eac: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Easy Anti-Cheat'
  },
  battleye: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  oxideEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  oxideVersion: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  autoUpdate: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  autoRestart: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  restartSchedule: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Cron выражение для перезагрузки'
  },
  backupEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  backupInterval: {
    type: DataTypes.INTEGER,
    defaultValue: 3600,
    comment: 'Интервал бэкапов в секундах'
  },
  backupKeepDays: {
    type: DataTypes.INTEGER,
    defaultValue: 7,
    comment: 'Хранить бэкапы дней'
  },
  performanceSettings: {
    type: DataTypes.JSON,
    defaultValue: {
      gc_buffer: 256,
      gc_interval: 300,
      entity_quota: 10000
    }
  },
  pluginSettings: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  customCommands: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Пользовательские команды при запуске'
  },
  environmentVariables: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Переменные окружения'
  },
  startupParameters: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Дополнительные параметры запуска'
  },
  status: {
    type: DataTypes.ENUM('stopped', 'starting', 'running', 'stopping', 'error', 'updating'),
    defaultValue: 'stopped'
  },
  lastStart: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastStop: {
    type: DataTypes.DATE,
    allowNull: true
  },
  uptime: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Uptime в секундах'
  },
  totalUptime: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Общий uptime в секундах'
  },
  restartCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  crashCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  cpuUsage: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  memoryUsage: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  diskUsage: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  playerStats: {
    type: DataTypes.JSON,
    defaultValue: {
      peakPlayers: 0,
      averagePlayers: 0,
      totalConnections: 0
    }
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'server_settings',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['server_id']
    },
    {
      fields: ['status']
    }
  ]
});

// Методы экземпляра
ServerSettings.prototype.getStartupCommand = function() {
  const params = [
    '-batchmode',
    `+server.port ${this.port}`,
    `+server.level "${this.level}"`,
    `+server.seed ${this.seed}`,
    `+server.worldsize ${this.worldSize}`,
    `+server.maxplayers ${this.maxPlayers}`,
    `+server.hostname "${this.hostname}"`,
    `+server.description "${this.description || ''}"`,
    `+server.url "${this.url || ''}"`,
    `+server.headerimage "${this.headerImage || ''}"`,
    `+server.logo "${this.logo || ''}"`,
    `+rcon.port ${this.rconPort}`,
    `+rcon.password "${this.rconPassword}"`,
    `+rcon.web ${this.secure ? 1 : 0}`,
    `+server.identity "${this.identity}"`,
    `+server.secure ${this.secure ? 1 : 0}`,
    `+server.eac ${this.eac ? 1 : 0}`
  ];
  
  if (this.startupParameters) {
    params.push(this.startupParameters);
  }
  
  return params.join(' ');
};

ServerSettings.prototype.updateUptime = function() {
  if (this.status === 'running' && this.lastStart) {
    const now = new Date();
    const diff = Math.floor((now - this.lastStart) / 1000);
    this.uptime = diff;
    this.totalUptime += diff;
    return this.save();
  }
  return Promise.resolve();
};

ServerSettings.prototype.getStatusInfo = function() {
  const statusMap = {
    'stopped': { color: 'danger', icon: 'stop-circle', text: 'Остановлен' },
    'starting': { color: 'warning', icon: 'play-circle', text: 'Запускается' },
    'running': { color: 'success', icon: 'check-circle', text: 'Запущен' },
    'stopping': { color: 'warning', icon: 'pause-circle', text: 'Останавливается' },
    'error': { color: 'danger', icon: 'exclamation-circle', text: 'Ошибка' },
    'updating': { color: 'info', icon: 'arrow-clockwise', text: 'Обновляется' }
  };
  
  return statusMap[this.status] || statusMap.stopped;
};

// Статические методы
ServerSettings.findByServerId = async function(serverId) {
  return await this.findOne({ where: { serverId } });
};

ServerSettings.findRunning = async function() {
  return await this.findAll({ 
    where: { status: 'running' },
    order: [['last_start', 'DESC']]
  });
};

ServerSettings.updateStatus = async function(serverId, status) {
  const server = await this.findOne({ where: { serverId } });
  if (!server) return null;
  
  const now = new Date();
  const updates = { status };
  
  if (status === 'running') {
    updates.lastStart = now;
    updates.uptime = 0;
  } else if (status === 'stopped' && server.status === 'running') {
    updates.lastStop = now;
    updates.totalUptime += server.uptime;
    updates.uptime = 0;
  } else if (status === 'error') {
    updates.crashCount = server.crashCount + 1;
  }
  
  await server.update(updates);
  return server;
};

// Связи
ServerSettings.associate = (models) => {
  ServerSettings.belongsTo(models.User, {
    foreignKey: 'ownerId',
    as: 'owner'
  });
  
  ServerSettings.hasMany(models.Backup, {
    foreignKey: 'serverId',
    as: 'backups'
  });
  
  ServerSettings.hasMany(models.ServerLog, {
    foreignKey: 'serverId',
    as: 'logs'
  });
};

module.exports = ServerSettings;