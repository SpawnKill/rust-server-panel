const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const RCONService = require('../services/RCONService');

class ShopController {
  constructor() {
    this.basePath = process.env.RUST_SERVER_PATH || '/home/rustserver';
    this.shopDbPath = path.join(__dirname, '../../data/shop.db');
    this.initDatabase();
  }

  // Инициализация базы данных магазина
  initDatabase() {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(this.shopDbPath);
    
    db.serialize(() => {
      // Таблица товаров
      db.run(`
        CREATE TABLE IF NOT EXISTS shop_items (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          category TEXT DEFAULT 'general',
          item_type TEXT NOT NULL,
          item_shortname TEXT NOT NULL,
          item_amount INTEGER DEFAULT 1,
          item_skin INTEGER,
          price DECIMAL(10,2) NOT NULL,
          currency TEXT DEFAULT 'RUB',
          image_url TEXT,
          is_active BOOLEAN DEFAULT 1,
          stock INTEGER,
          permissions TEXT DEFAULT '[]',
          commands TEXT DEFAULT '[]',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Таблица категорий
      db.run(`
        CREATE TABLE IF NOT EXISTS shop_categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          icon TEXT,
          sort_order INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT 1
        )
      `);
      
      // Таблица покупок
      db.run(`
        CREATE TABLE IF NOT EXISTS shop_purchases (
          id TEXT PRIMARY KEY,
          item_id TEXT NOT NULL,
          player_id TEXT NOT NULL,
          player_name TEXT,
          price DECIMAL(10,2) NOT NULL,
          currency TEXT,
          status TEXT DEFAULT 'completed',
          transaction_id TEXT,
          purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (item_id) REFERENCES shop_items (id)
        )
      `);
      
      // Таблица промокодов
      db.run(`
        CREATE TABLE IF NOT EXISTS shop_coupons (
          code TEXT PRIMARY KEY,
          discount_type TEXT DEFAULT 'percent', -- percent or fixed
          discount_value DECIMAL(10,2) NOT NULL,
          max_uses INTEGER DEFAULT 1,
          used_count INTEGER DEFAULT 0,
          expires_at DATETIME,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    });
    
    db.close();
  }

  // Получение всех товаров
  async getItems(serverId, filters = {}) {
    return new Promise((resolve, reject) => {
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(this.shopDbPath);
      
      let query = 'SELECT * FROM shop_items WHERE 1=1';
      const params = [];
      
      if (filters.category) {
        query += ' AND category = ?';
        params.push(filters.category);
      }
      
      if (filters.activeOnly) {
        query += ' AND is_active = 1';
      }
      
      if (filters.search) {
        query += ' AND (name LIKE ? OR description LIKE ?)';
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm);
      }
      
      query += ' ORDER BY category, name';
      
      db.all(query, params, (err, rows) => {
        db.close();
        
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Добавление товара
  async addItem(serverId, itemData) {
    const id = uuidv4();
    
    return new Promise((resolve, reject) => {
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(this.shopDbPath);
      
      const query = `
        INSERT INTO shop_items (
          id, name, description, category, item_type, item_shortname,
          item_amount, item_skin, price, currency, image_url,
          is_active, stock, permissions, commands
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        id,
        itemData.name,
        itemData.description || '',
        itemData.category || 'general',
        itemData.item_type,
        itemData.item_shortname,
        itemData.item_amount || 1,
        itemData.item_skin || null,
        itemData.price,
        itemData.currency || 'RUB',
        itemData.image_url || null,
        itemData.is_active !== undefined ? itemData.is_active : 1,
        itemData.stock || null,
        JSON.stringify(itemData.permissions || []),
        JSON.stringify(itemData.commands || [])
      ];
      
      db.run(query, params, function(err) {
        db.close();
        
        if (err) {
          reject(err);
        } else {
          resolve({
            id,
            ...itemData,
            message: 'Товар добавлен'
          });
        }
      });
    });
  }

  // Обновление товара
  async updateItem(itemId, itemData) {
    return new Promise((resolve, reject) => {
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(this.shopDbPath);
      
      const fields = [];
      const params = [];
      
      Object.keys(itemData).forEach(key => {
        if (key !== 'id') {
          fields.push(`${key} = ?`);
          
          if (['permissions', 'commands'].includes(key)) {
            params.push(JSON.stringify(itemData[key]));
          } else {
            params.push(itemData[key]);
          }
        }
      });
      
      params.push(itemId);
      
      const query = `
        UPDATE shop_items 
        SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      db.run(query, params, function(err) {
        db.close();
        
        if (err) {
          reject(err);
        } else if (this.changes === 0) {
          reject(new Error('Товар не найден'));
        } else {
          resolve({
            success: true,
            message: 'Товар обновлен'
          });
        }
      });
    });
  }

  // Удаление товара
  async deleteItem(itemId) {
    return new Promise((resolve, reject) => {
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(this.shopDbPath);
      
      db.run('DELETE FROM shop_items WHERE id = ?', [itemId], function(err) {
        db.close();
        
        if (err) {
          reject(err);
        } else if (this.changes === 0) {
          reject(new Error('Товар не найден'));
        } else {
          resolve({
            success: true,
            message: 'Товар удален'
          });
        }
      });
    });
  }

  // Экспорт в конфиг плагина
  async exportToPlugin(serverId, pluginType) {
    try {
      const items = await this.getItems(serverId, { activeOnly: true });
      
      let config = {};
      
      switch (pluginType) {
        case 'Economics':
          config = this.formatForEconomics(items);
          break;
          
        case 'ShopUI':
          config = this.formatForShopUI(items);
          break;
          
        case 'IQEconomic':
          config = this.formatForIQEconomic(items);
          break;
          
        default:
          throw new Error(`Неизвестный тип плагина: ${pluginType}`);
      }
      
      // Сохраняем конфиг
      const configPath = path.join(
        this.basePath,
        `server-${serverId}`,
        'oxide',
        'config',
        `${pluginType}.json`
      );
      
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      
      // Перезагружаем конфиг плагина
      await RCONService.sendCommand(serverId, `oxide.reload ${pluginType}`)
        .catch(err => logger.warn(`Не удалось перезагрузить плагин: ${err.message}`));
      
      return {
        success: true,
        message: `Конфиг экспортирован в ${pluginType}`,
        itemsExported: items.length,
        configPath
      };
      
    } catch (error) {
      logger.error(`Ошибка экспорта: ${error.message}`);
      throw error;
    }
  }

  // Форматирование для Economics
  formatForEconomics(items) {
    const shopConfig = {};
    
    items.forEach((item, index) => {
      shopConfig[item.id] = {
        DisplayName: item.name,
        ShortName: item.item_shortname,
        Amount: item.item_amount,
        Skin: item.item_skin || 0,
        Price: item.price,
        Category: item.category,
        Enabled: item.is_active ? true : false,
        Permissions: JSON.parse(item.permissions),
        Commands: JSON.parse(item.commands)
      };
    });
    
    return {
      Settings: {
        UseEconomics: true,
        UseServerRewards: false
      },
      Shop: shopConfig
    };
  }

  // Форматирование для ShopUI
  formatForShopUI(items) {
    return {
      shop_items: items.map(item => ({
        id: item.id,
        title: item.name,
        description: item.description,
        item_shortname: item.item_shortname,
        item_amount: item.item_amount,
        item_skin: item.item_skin || 0,
        cost: item.price,
        category: item.category,
        image: item.image_url || '',
        permissions: JSON.parse(item.permissions)
      })),
      categories: this.extractCategories(items)
    };
  }

  // Форматирование для IQEconomic
  formatForIQEconomic(items) {
    return {
      Version: "1.0",
      ShopItems: items.map(item => ({
        ID: item.id,
        DisplayName: item.name,
        ShortName: item.item_shortname,
        Amount: item.item_amount,
        SkinID: item.item_skin || 0,
        Price: item.price,
        Category: item.category,
        Permissions: JSON.parse(item.permissions),
        Commands: JSON.parse(item.commands)
      }))
    };
  }

  // Извлечение категорий из товаров
  extractCategories(items) {
    const categories = {};
    const uniqueCats = [...new Set(items.map(item => item.category))];
    
    uniqueCats.forEach(cat => {
      categories[cat] = {
        display_name: cat,
        sort_order: 0
      };
    });
    
    return categories;
  }

  // Создание промокода
  async createCoupon(couponData) {
    const code = this.generateCouponCode();
    
    return new Promise((resolve, reject) => {
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(this.shopDbPath);
      
      const query = `
        INSERT INTO shop_coupons 
        (code, discount_type, discount_value, max_uses, expires_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        code,
        couponData.discount_type || 'percent',
        couponData.discount_value,
        couponData.max_uses || 1,
        couponData.expires_at || null,
        couponData.is_active !== undefined ? couponData.is_active : 1
      ];
      
      db.run(query, params, function(err) {
        db.close();
        
        if (err) {
          reject(err);
        } else {
          resolve({
            success: true,
            code,
            message: 'Промокод создан'
          });
        }
      });
    });
  }

  // Генерация кода промокода
  generateCouponCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    
    for (let i = 0; i < 8; i++) {
      if (i > 0 && i % 4 === 0) code += '-';
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return code;
  }

  // Проверка промокода
  async validateCoupon(code) {
    return new Promise((resolve, reject) => {
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(this.shopDbPath);
      
      const query = `
        SELECT * FROM shop_coupons 
        WHERE code = ? AND is_active = 1 
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        AND (max_uses = 0 OR used_count < max_uses)
      `;
      
      db.get(query, [code], (err, row) => {
        db.close();
        
        if (err) {
          reject(err);
        } else if (!row) {
          resolve({ valid: false, message: 'Промокод недействителен' });
        } else {
          resolve({
            valid: true,
            coupon: row,
            message: 'Промокод действителен'
          });
        }
      });
    });
  }

  // Получение статистики продаж
  async getSalesStats(serverId, period = 'month') {
    return new Promise((resolve, reject) => {
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(this.shopDbPath);
      
      let dateFilter = '';
      switch (period) {
        case 'day':
          dateFilter = "AND DATE(purchased_at) = DATE('now')";
          break;
        case 'week':
          dateFilter = "AND purchased_at >= DATE('now', '-7 days')";
          break;
        case 'month':
          dateFilter = "AND purchased_at >= DATE('now', '-30 days')";
          break;
        case 'year':
          dateFilter = "AND purchased_at >= DATE('now', '-365 days')";
          break;
      }
      
      const query = `
        SELECT 
          COUNT(*) as total_sales,
          SUM(price) as total_revenue,
          COUNT(DISTINCT player_id) as unique_customers,
          strftime('%Y-%m-%d', purchased_at) as date,
          item_id
        FROM shop_purchases 
        WHERE status = 'completed' ${dateFilter}
        GROUP BY date, item_id
        ORDER BY date DESC
      `;
      
      db.all(query, (err, rows) => {
        if (err) {
          db.close();
          reject(err);
          return;
        }
        
        // Топ товаров
        const topItemsQuery = `
          SELECT 
            i.name,
            i.category,
            COUNT(p.id) as sales_count,
            SUM(p.price) as sales_revenue
          FROM shop_purchases p
          JOIN shop_items i ON p.item_id = i.id
          WHERE p.status = 'completed' ${dateFilter}
          GROUP BY p.item_id
          ORDER BY sales_count DESC
          LIMIT 10
        `;
        
        db.all(topItemsQuery, (err2, topItems) => {
          db.close();
          
          if (err2) {
            reject(err2);
          } else {
            resolve({
              success: true,
              stats: {
                total_sales: rows.reduce((sum, row) => sum + row.total_sales, 0),
                total_revenue: rows.reduce((sum, row) => sum + row.total_revenue, 0),
                unique_customers: rows.reduce((sum, row) => sum + row.unique_customers, 0),
                daily_sales: rows,
                top_items: topItems
              }
            });
          }
        });
      });
    });
  }

  // Симуляция покупки (для тестов)
  async simulatePurchase(serverId, itemId, playerId, playerName) {
    try {
      // Получаем информацию о товаре
      const item = await this.getItem(itemId);
      
      if (!item) {
        throw new Error('Товар не найден');
      }
      
      if (!item.is_active) {
        throw new Error('Товар недоступен для покупки');
      }
      
      // Проверяем наличие
      if (item.stock !== null && item.stock <= 0) {
        throw new Error('Товар закончился');
      }
      
      // Выполняем команды
      const commands = JSON.parse(item.commands);
      
      for (const command of commands) {
        const formattedCommand = command
          .replace('{player}', playerId)
          .replace('{item}', item.item_shortname)
          .replace('{amount}', item.item_amount)
          .replace('{skin}', item.item_skin || 0);
        
        await RCONService.sendCommand(serverId, formattedCommand);
      }
      
      // Если команд нет, используем стандартную
      if (commands.length === 0) {
        const defaultCommand = `inventory.giveto ${playerId} ${item.item_shortname} ${item.item_amount} ${item.item_skin || 0}`;
        await RCONService.sendCommand(serverId, defaultCommand);
      }
      
      // Сообщение игроку
      await RCONService.sendCommand(serverId, `say "${playerName}, вы купили ${item.name}!"`);
      
      // Записываем покупку
      await this.recordPurchase(itemId, playerId, playerName, item.price, item.currency);
      
      // Уменьшаем запас если нужно
      if (item.stock !== null) {
        await this.decreaseStock(itemId);
      }
      
      return {
        success: true,
        message: 'Покупка успешно выполнена',
        item: item.name
      };
      
    } catch (error) {
      logger.error(`Ошибка симуляции покупки: ${error.message}`);
      throw error;
    }
  }

  // Получение товара по ID
  async getItem(itemId) {
    return new Promise((resolve, reject) => {
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(this.shopDbPath);
      
      db.get('SELECT * FROM shop_items WHERE id = ?', [itemId], (err, row) => {
        db.close();
        
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  // Запись покупки
  async recordPurchase(itemId, playerId, playerName, price, currency) {
    return new Promise((resolve, reject) => {
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(this.shopDbPath);
      
      const id = uuidv4();
      const query = `
        INSERT INTO shop_purchases 
        (id, item_id, player_id, player_name, price, currency, status)
        VALUES (?, ?, ?, ?, ?, ?, 'completed')
      `;
      
      db.run(query, [id, itemId, playerId, playerName, price, currency], function(err) {
        db.close();
        
        if (err) {
          reject(err);
        } else {
          resolve({ success: true });
        }
      });
    });
  }

  // Уменьшение запаса
  async decreaseStock(itemId) {
    return new Promise((resolve, reject) => {
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(this.shopDbPath);
      
      db.run(`
        UPDATE shop_items 
        SET stock = stock - 1 
        WHERE id = ? AND stock IS NOT NULL AND stock > 0
      `, [itemId], function(err) {
        db.close();
        
        if (err) {
          reject(err);
        } else {
          resolve({ success: this.changes > 0 });
        }
      });
    });
  }

  // Веб-интерфейс магазина для игроков
  async getPlayerShop(serverId, playerId = null) {
    const items = await this.getItems(serverId, { activeOnly: true });
    
    // Группируем по категориям
    const categories = {};
    
    items.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = {
          name: item.category,
          items: []
        };
      }
      
      // Форматируем для отображения
      categories[item.category].items.push({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        currency: item.currency,
        image_url: item.image_url,
        in_stock: item.stock === null || item.stock > 0,
        stock_left: item.stock
      });
    });
    
    return {
      success: true,
      categories: Object.values(categories),
      currency: 'RUB',
      player_id: playerId
    };
  }
}

module.exports = new ShopController();