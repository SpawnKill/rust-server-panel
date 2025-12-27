const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false,
    validate: {
      len: [3, 50],
      is: /^[a-zA-Z0-9_]+$/
    }
  },
  email: {
    type: DataTypes.STRING(100),
    unique: true,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    set(value) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(value, salt);
      this.setDataValue('password', hash);
    }
  },
  role: {
    type: DataTypes.ENUM('user', 'moderator', 'admin', 'superadmin'),
    defaultValue: 'user'
  },
  steamId: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true
  },
  discordId: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true
  },
  twoFactorEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  twoFactorSecret: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  apiKey: {
    type: DataTypes.STRING(64),
    unique: true,
    allowNull: true
  },
  settings: {
    type: DataTypes.JSON,
    defaultValue: {
      theme: 'dark',
      notifications: true,
      language: 'ru'
    }
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
  hooks: {
    beforeCreate: (user) => {
      // Генерация API ключа
      if (!user.apiKey) {
        user.apiKey = require('crypto').randomBytes(32).toString('hex');
      }
    }
  }
});

// Методы экземпляра
User.prototype.validatePassword = function(password) {
  return bcrypt.compareSync(password, this.password);
};

User.prototype.generateApiKey = function() {
  const apiKey = require('crypto').randomBytes(32).toString('hex');
  this.apiKey = apiKey;
  return apiKey;
};

User.prototype.getSafeInfo = function() {
  const values = Object.assign({}, this.get());
  delete values.password;
  delete values.twoFactorSecret;
  return values;
};

// Статические методы
User.findByApiKey = async function(apiKey) {
  return await this.findOne({ 
    where: { apiKey, isActive: true } 
  });
};

User.findByUsernameOrEmail = async function(identifier) {
  return await this.findOne({
    where: {
      [sequelize.Op.or]: [
        { username: identifier },
        { email: identifier }
      ],
      isActive: true
    }
  });
};

// Связи
User.associate = (models) => {
  User.hasMany(models.Server, {
    foreignKey: 'ownerId',
    as: 'servers'
  });
  
  User.hasMany(models.ShopPurchase, {
    foreignKey: 'userId',
    as: 'purchases'
  });
  
  User.hasMany(models.Backup, {
    foreignKey: 'createdById',
    as: 'backups'
  });
};

module.exports = User;