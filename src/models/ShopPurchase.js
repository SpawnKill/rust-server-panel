const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ShopPurchase = sequelize.define('ShopPurchase', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  itemId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  playerId: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'SteamID игрока'
  },
  playerName: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'RUB'
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
    defaultValue: 'completed'
  },
  transactionId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true
  },
  paymentMethod: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  serverId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'shop_purchases',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['player_id']
    },
    {
      fields: ['item_id']
    },
    {
      fields: ['created_at']
    }
  ]
});

ShopPurchase.associate = (models) => {
  ShopPurchase.belongsTo(models.ShopItem, {
    foreignKey: 'itemId',
    as: 'item'
  });
  
  ShopPurchase.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'user'
  });
};

module.exports = ShopPurchase;