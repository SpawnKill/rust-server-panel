const { Sequelize } = require('sequelize');
const config = require('../../config/default.json');

const sequelize = new Sequelize({
  dialect: config.database.dialect || 'sqlite',
  storage: config.database.storage || './data/panel.db',
  logging: config.database.logging ? console.log : false,
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  retry: {
    max: 3
  }
});

// Тестирование подключения
sequelize.authenticate()
  .then(() => {
    console.log('✅ База данных подключена успешно');
  })
  .catch(err => {
    console.error('❌ Ошибка подключения к базе данных:', err);
  });

module.exports = sequelize;