const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Backup = sequelize.define('Backup', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  serverId: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  filename: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  path: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  size: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    comment: 'Размер в байтах'
  },
  type: {
    type: DataTypes.ENUM('full', 'config', 'world', 'database', 'custom'),
    defaultValue: 'full'
  },
  compression: {
    type: DataTypes.ENUM('none', 'gzip', 'zip', 'tar'),
    defaultValue: 'zip'
  },
  includesLogs: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  status: {
    type: DataTypes.ENUM('creating', 'completed', 'failed', 'restoring', 'deleted'),
    defaultValue: 'completed'
  },
  createdById: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  restoreDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  restoreById: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'backups',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['server_id']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['type']
    }
  ]
});

Backup.prototype.getFormattedSize = function() {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (this.size === 0) return '0 Byte';
  const i = parseInt(Math.floor(Math.log(this.size) / Math.log(1024)));
  return Math.round(this.size / Math.pow(1024, i), 2) + ' ' + sizes[i];
};

Backup.associate = (models) => {
  Backup.belongsTo(models.ServerSettings, {
    foreignKey: 'serverId',
    targetKey: 'serverId',
    as: 'server'
  });
  
  Backup.belongsTo(models.User, {
    foreignKey: 'createdById',
    as: 'creator'
  });
  
  Backup.belongsTo(models.User, {
    foreignKey: 'restoreById',
    as: 'restorer'
  });
};

module.exports = Backup;