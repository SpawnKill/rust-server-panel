const { spawn, execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class SteamCMDService {
  constructor() {
    this.installPath = process.env.RUST_SERVER_PATH || '/home/rustserver';
    this.steamCmdPath = process.env.STEAMCMD_PATH || '/home/steam/steamcmd';
    this.serverUser = 'rustserver';
  }

  // Установка SteamCMD
  async installSteamCMD() {
    logger.info('Установка SteamCMD...');
    
    const commands = [
      'apt-get update',
      'apt-get install -y lib32gcc1 lib32stdc++6 libc6-i386 libcurl4-gnutls-dev:i386 screen',
      `adduser --disabled-login --gecos '' ${this.serverUser}`,
      `mkdir -p ${this.steamCmdPath}`,
      `su - ${this.serverUser} -c "cd ${this.steamCmdPath} && wget https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz"`,
      `su - ${this.serverUser} -c "cd ${this.steamCmdPath} && tar -xvzf steamcmd_linux.tar.gz"`,
      `chown -R ${this.serverUser}:${this.serverUser} ${this.steamCmdPath}`
    ];

    for (const cmd of commands) {
      await this.executeCommand(cmd);
    }

    logger.info('SteamCMD установлен');
    return true;
  }

  // Установка сервера Rust
  async installRustServer(serverName = 'My Rust Server', worldSize = 3000, maxPlayers = 50) {
    const serverId = uuidv4().substring(0, 8);
    const serverDir = path.join(this.installPath, `server-${serverId}`);
    
    logger.info(`Установка сервера Rust в: ${serverDir}`);
    
    // Создаем директорию
    await fs.ensureDir(serverDir);
    
    // Команда установки через SteamCMD
    const installCmd = `
      cd ${this.steamCmdPath} && 
      ./steamcmd.sh +force_install_dir ${serverDir} +login anonymous +app_update 258550 validate +quit
    `;
    
    try {
      // Устанавливаем сервер
      await this.executeCommandAsUser(this.serverUser, installCmd);
      
      // Создаем базовые конфиги
      await this.createServerConfigs(serverDir, serverName, worldSize, maxPlayers);
      
      // Создаем systemd сервис
      await this.createSystemdService(serverId, serverDir);
      
      logger.info(`Сервер Rust установлен: ${serverDir}`);
      
      return {
        id: serverId,
        path: serverDir,
        name: serverName,
        status: 'installed'
      };
      
    } catch (error) {
      logger.error(`Ошибка установки сервера: ${error}`);
      throw error;
    }
  }

  // Создание конфигурационных файлов
  async createServerConfigs(serverPath, serverName, worldSize, maxPlayers) {
    const configs = {
      'server.cfg': `
hostname "${serverName}"
description "Rust Server managed by Web Panel"
port 28015
rcon.port 28016
rcon.password "${uuidv4().substring(0, 12)}"
rcon.web 1
server.maxplayers ${maxPlayers}
server.seed ${Math.floor(Math.random() * 1000000)}
server.worldsize ${worldSize}
server.saveinterval 300
server.tickrate 30
server.identity "server"
server.level "Procedural Map"
server.url ""
server.headerimage ""
server.logo ""
      `,
      
      'serveridentity/cfg/users.cfg': `
ownerid "76561197960287930" "owner" "admin"
      `
    };

    for (const [filePath, content] of Object.entries(configs)) {
      const fullPath = path.join(serverPath, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content.trim());
    }
    
    // Устанавливаем права
    await this.executeCommand(`chown -R ${this.serverUser}:${this.serverUser} ${serverPath}`);
  }

  // Создание systemd сервиса
  async createSystemdService(serverId, serverPath) {
    const serviceContent = `
[Unit]
Description=Rust Server ${serverId}
After=network.target

[Service]
Type=simple
User=${this.serverUser}
Group=${this.serverUser}
WorkingDirectory=${serverPath}
ExecStart=${serverPath}/RustDedicated -batchmode +server.port 28015 +server.level "Procedural Map" +server.seed 12345 +server.worldsize 3000 +server.maxplayers 50 +server.hostname "My Rust Server" +server.description "Rust Server" +server.url "" +server.headerimage "" +server.logo "" +rcon.port 28016 +rcon.password "changeme" +rcon.web 1
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=rust-server-${serverId}

[Install]
WantedBy=multi-user.target
    `;

    const servicePath = `/etc/systemd/system/rust-server-${serverId}.service`;
    await fs.writeFile(servicePath, serviceContent.trim());
    await this.executeCommand(`systemctl daemon-reload`);
    
    logger.info(`Systemd сервис создан: rust-server-${serverId}.service`);
  }

  // Вспомогательные методы
  executeCommand(command) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, { 
        shell: true,
        stdio: 'inherit'
      });

      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Command failed with code ${code}`));
      });
    });
  }

  executeCommandAsUser(user, command) {
    return this.executeCommand(`su - ${user} -c "${command}"`);
  }
}

module.exports = new SteamCMDService();