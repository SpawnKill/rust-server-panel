const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ShopItem = sequelize.define('ShopItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      len: [2, 100]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  shortname: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Идентификатор предмета в игре (например: assault.rifle)'
  },
  amount: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1
    }
  },
  skinId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'RUB',
    validate: {
      isIn: [['RUB', 'USD', 'EUR', 'UAH', 'KZT']]
    }
  },
  category: {
    type: DataTypes.STRING(50),
    defaultValue: 'general',
    validate: {
      isIn: [['weapons', 'resources', 'building', 'transport', 'clothing', 'tools', 'medical', 'food', 'skins', 'privileges', 'kits', 'other']]
    }
  },
  type: {
    type: DataTypes.ENUM('item', 'kit', 'permission', 'command', 'other'),
    defaultValue: 'item'
  },
  imageUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  stock: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'null = бесконечный запас'
  },
  maxPurchasesPerPlayer: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Максимальное количество покупок на игрока'
  },
  cooldown: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Кулдаун в секундах между покупками'
  },
  requiredPermissions: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Требуемые права для покупки'
  },
  givePermissions: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Права, которые получает игрок после покупки'
  },
  commands: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Команды для выполнения после покупки'
  },
  serverId: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'ID сервера, если товар привязан к конкретному серверу'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Дополнительные метаданные'
  }
}, {
  tableName: 'shop_items',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['category']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['server_id']
    }
  ]
});

// Методы экземпляра
ShopItem.prototype.isAvailable = function() {
  if (!this.isActive) return false;
  if (this.stock !== null && this.stock <= 0) return false;
  return true;
};

ShopItem.prototype.decreaseStock = function() {
  if (this.stock !== null && this.stock > 0) {
    this.stock -= 1;
    return this.save();
  }
  return Promise.resolve();
};

ShopItem.prototype.getFormattedPrice = function() {
  const symbols = {
    'RUB': '₽',
    'USD': '$',
    'EUR': '€',
    'UAH': '₴',
    'KZT': '₸'
  };
  return `${this.price.toFixed(2)} ${symbols[this.currency] || this.currency}`;
};

// Статические методы
ShopItem.findByCategory = async function(category, serverId = null) {
  const where = { category, isActive: true };
  if (serverId) {
    where.serverId = serverId;
  }
  return await this.findAll({ where, order: [['price', 'ASC']] });
};

ShopItem.findAvailable = async function(serverId = null) {
  const where = { isActive: true };
  if (serverId) {
    where.serverId = serverId;
  }
  return await this.findAll({ 
    where,
    order: [['category', 'ASC'], ['price', 'ASC']]
  });
};

// Связи
ShopItem.associate = (models) => {
  ShopItem.hasMany(models.ShopPurchase, {
    foreignKey: 'itemId',
    as: 'purchases'
  });
  
  ShopItem.belongsToMany(models.ShopCategory, {
    through: 'shop_item_categories',
    foreignKey: 'itemId',
    as: 'categories'
  });
};

module.exports = ShopItem;