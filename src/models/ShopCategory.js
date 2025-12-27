const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ShopCategory = sequelize.define('ShopCategory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  icon: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  color: {
    type: DataTypes.STRING(7),
    defaultValue: '#6c757d'
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'shop_categories',
  timestamps: true,
  underscored: true
});

ShopCategory.associate = (models) => {
  ShopCategory.belongsToMany(models.ShopItem, {
    through: 'shop_item_categories',
    foreignKey: 'categoryId',
    as: 'items'
  });
};

module.exports = ShopCategory;