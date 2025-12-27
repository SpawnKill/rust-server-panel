const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ServerLog = sequelize.define('ServerLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  serverId: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('info', 'warning', 'error', 'debug', 'rcon', 'chat', 'system'),
    defaultValue: 'info'
  },
  source: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Источник лога (console, plugin, system, etc.)'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  data: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  playerId: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  playerName: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  command: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true
  }
}, {
  tableName: 'server_logs',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['server_id', 'created_at']
    },
    {
      fields: ['type']
    },
    {
      fields: ['source']
    },
    {
      fields: ['player_id']
    }
  ]
});

ServerLog.associate = (models) => {
  ServerLog.belongsTo(models.ServerSettings, {
    foreignKey: 'serverId',
    targetKey: 'serverId',
    as: 'server'
  });
};

module.exports = ServerLog;