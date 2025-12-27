const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class ProcessService {
  constructor() {
    this.activeProcesses = new Map();
  }

  // Запуск процесса через spawn
  async spawnProcess(command, args = [], options = {}) {
    try {
      const defaultOptions = {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        detached: false,
        ...options
      };

      logger.info(`Запуск процесса: ${command} ${args.join(' ')}`);
      
      const process = spawn(command, args, defaultOptions);
      const processId = Date.now().toString();
      
      this.activeProcesses.set(processId, {
        process,
        command,
        args,
        startTime: new Date(),
        output: []
      });
      
      // Собираем вывод
      process.stdout.on('data', (data) => {
        const output = data.toString();
        const processInfo = this.activeProcesses.get(processId);
        if (processInfo) {
          processInfo.output.push({ type: 'stdout', data: output, timestamp: new Date() });
        }
        logger.debug(`[${processId}] stdout: ${output.trim()}`);
      });
      
      process.stderr.on('data', (data) => {
        const output = data.toString();
        const processInfo = this.activeProcesses.get(processId);
        if (processInfo) {
          processInfo.output.push({ type: 'stderr', data: output, timestamp: new Date() });
        }
        logger.warn(`[${processId}] stderr: ${output.trim()}`);
      });
      
      process.on('close', (code) => {
        logger.info(`Процесс ${processId} завершен с кодом: ${code}`);
        const processInfo = this.activeProcesses.get(processId);
        if (processInfo) {
          processInfo.endTime = new Date();
          processInfo.exitCode = code;
        }
      });
      
      process.on('error', (error) => {
        logger.error(`Ошибка процесса ${processId}: ${error.message}`);
      });
      
      return {
        id: processId,
        pid: process.pid,
        command: `${command} ${args.join(' ')}`
      };
      
    } catch (error) {
      logger.error(`Ошибка запуска процесса: ${error.message}`);
      throw error;
    }
  }

  // Запуск команды через exec
  async execCommand(command, options = {}) {
    try {
      const defaultOptions = {
        encoding: 'utf8',
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 10, // 10MB
        ...options
      };
      
      logger.info(`Выполнение команды: ${command}`);
      
      return new Promise((resolve, reject) => {
        exec(command, defaultOptions, (error, stdout, stderr) => {
          if (error) {
            logger.error(`Ошибка выполнения команды: ${error.message}`);
            reject(error);
          } else {
            if (stderr && stderr.trim()) {
              logger.warn(`stderr: ${stderr.trim()}`);
            }
            
            resolve({
              stdout: stdout.trim(),
              stderr: stderr.trim(),
              success: true
            });
          }
        });
      });
      
    } catch (error) {
      logger.error(`Ошибка в execCommand: ${error.message}`);
      throw error;
    }
  }

  // Выполнение команды с sudo
  async sudoCommand(command, password = null) {
    try {
      let fullCommand;
      
      if (password) {
        // Используем expect для автоматического ввода пароля
        const expectScript = `
          spawn sudo -S ${command}
          expect "password"
          send "${password}\\r"
          expect eof
        `;
        fullCommand = `expect -c '${expectScript}'`;
      } else {
        // Предполагаем, что пользователь уже в sudoers без пароля
        fullCommand = `sudo ${command}`;
      }
      
      return await this.execCommand(fullCommand);
      
    } catch (error) {
      logger.error(`Ошибка sudo команды: ${error.message}`);
      throw error;
    }
  }

  // Получение информации о процессе
  async getProcessInfo(processId) {
    const processInfo = this.activeProcesses.get(processId);
    
    if (!processInfo) {
      throw new Error(`Процесс ${processId} не найден`);
    }
    
    const { process, startTime, endTime, output, exitCode } = processInfo;
    
    return {
      id: processId,
      pid: process.pid,
      running: !process.killed && exitCode === undefined,
      startTime,
      endTime,
      exitCode,
      output: output.slice(-100), // Последние 100 записей
      totalOutput: output.length
    };
  }

  // Остановка процесса
  async killProcess(processId, signal = 'SIGTERM') {
    try {
      const processInfo = this.activeProcesses.get(processId);
      
      if (!processInfo) {
        throw new Error(`Процесс ${processId} не найден`);
      }
      
      if (processInfo.process.killed) {
        return { success: true, message: 'Процесс уже остановлен' };
      }
      
      processInfo.process.kill(signal);
      logger.info(`Процесс ${processId} остановлен с сигналом: ${signal}`);
      
      return {
        success: true,
        message: `Процесс остановлен`,
        processId,
        signal
      };
      
    } catch (error) {
      logger.error(`Ошибка остановки процесса: ${error.message}`);
      throw error;
    }
  }

  // Получение списка запущенных процессов
  async getRunningProcesses() {
    try {
      const result = await this.execCommand('ps aux | grep -v grep');
      const processes = [];
      
      const lines = result.stdout.split('\n');
      
      lines.forEach(line => {
        if (line.trim()) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 11) {
            processes.push({
              user: parts[0],
              pid: parseInt(parts[1]),
              cpu: parseFloat(parts[2]),
              mem: parseFloat(parts[3]),
              vsz: parseInt(parts[4]),
              rss: parseInt(parts[5]),
              tty: parts[6],
              stat: parts[7],
              start: parts[8],
              time: parts[9],
              command: parts.slice(10).join(' ')
            });
          }
        }
      });
      
      return processes;
      
    } catch (error) {
      logger.error(`Ошибка получения списка процессов: ${error.message}`);
      throw error;
    }
  }

  // Поиск процессов Rust
  async findRustProcesses() {
    try {
      const processes = await this.getRunningProcesses();
      
      return processes.filter(p => 
        p.command.includes('RustDedicated') || 
        p.command.includes('rust-server') ||
        p.command.includes('steamcmd')
      );
      
    } catch (error) {
      logger.error(`Ошибка поиска Rust процессов: ${error.message}`);
      throw error;
    }
  }

  // Получение использования ресурсов системой
  async getSystemResources() {
    try {
      const [cpuResult, memResult, diskResult] = await Promise.all([
        this.execCommand("top -bn1 | grep 'Cpu(s)' | awk '{print $2}'"),
        this.execCommand("free -m | awk 'NR==2{printf \"%.2f\", $3*100/$2}'"),
        this.execCommand("df -h / | awk 'NR==2{print $5}' | sed 's/%//'")
      ]);
      
      const cpuUsage = parseFloat(cpuResult.stdout) || 0;
      const memUsage = parseFloat(memResult.stdout) || 0;
      const diskUsage = parseFloat(diskResult.stdout) || 0;
      
      // Получаем uptime
      const uptimeResult = await this.execCommand('uptime -p');
      const uptime = uptimeResult.stdout.replace('up ', '');
      
      // Получаем температуру (если доступно)
      let temperature = 0;
      try {
        const tempResult = await this.execCommand('cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo "0"');
        temperature = parseFloat(tempResult.stdout) / 1000;
      } catch {
        temperature = 0;
      }
      
      // Получаем нагрузку системы
      const loadResult = await this.execCommand('uptime');
      const loadMatch = loadResult.stdout.match(/load average: ([\d.]+), ([\d.]+), ([\d.]+)/);
      
      return {
        cpu: {
          usage: cpuUsage,
          cores: await this.getCPUCores()
        },
        memory: {
          usage: memUsage,
          total: await this.getTotalMemory(),
          used: await this.getUsedMemory()
        },
        disk: {
          usage: diskUsage,
          free: await this.getFreeDiskSpace()
        },
        temperature,
        uptime,
        load: loadMatch ? {
          '1min': parseFloat(loadMatch[1]),
          '5min': parseFloat(loadMatch[2]),
          '15min': parseFloat(loadMatch[3])
        } : null,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error(`Ошибка получения ресурсов системы: ${error.message}`);
      throw error;
    }
  }

  // Вспомогательные методы для получения информации о системе
  async getCPUCores() {
    try {
      const result = await this.execCommand('nproc');
      return parseInt(result.stdout) || 1;
    } catch {
      return 1;
    }
  }

  async getTotalMemory() {
    try {
      const result = await this.execCommand("free -m | awk 'NR==2{print $2}'");
      return parseInt(result.stdout) || 0;
    } catch {
      return 0;
    }
  }

  async getUsedMemory() {
    try {
      const result = await this.execCommand("free -m | awk 'NR==2{print $3}'");
      return parseInt(result.stdout) || 0;
    } catch {
      return 0;
    }
  }

  async getFreeDiskSpace() {
    try {
      const result = await this.execCommand("df -h / | awk 'NR==2{print $4}'");
      return result.stdout.trim();
    } catch {
      return '0';
    }
  }

  // Мониторинг процесса в реальном времени
  async monitorProcess(processId, callback) {
    const processInfo = this.activeProcesses.get(processId);
    
    if (!processInfo) {
      throw new Error(`Процесс ${processId} не найден`);
    }
    
    const { process } = processInfo;
    
    // Слушаем вывод процесса
    process.stdout.on('data', (data) => {
      callback({ type: 'stdout', data: data.toString(), timestamp: new Date() });
    });
    
    process.stderr.on('data', (data) => {
      callback({ type: 'stderr', data: data.toString(), timestamp: new Date() });
    });
    
    process.on('close', (code) => {
      callback({ type: 'close', code, timestamp: new Date() });
    });
    
    process.on('error', (error) => {
      callback({ type: 'error', error: error.message, timestamp: new Date() });
    });
  }

  // Запуск фоновой задачи
  async runBackgroundTask(taskName, taskFn, intervalMs = 60000) {
    try {
      logger.info(`Запуск фоновой задачи: ${taskName}`);
      
      const runTask = async () => {
        try {
          await taskFn();
          logger.debug(`Фоновая задача выполнена: ${taskName}`);
        } catch (error) {
          logger.error(`Ошибка в фоновой задаче ${taskName}: ${error.message}`);
        }
      };
      
      // Запускаем сразу
      await runTask();
      
      // И затем по интервалу
      const intervalId = setInterval(runTask, intervalMs);
      
      // Сохраняем информацию об интервале
      this.activeProcesses.set(`task_${taskName}`, {
        intervalId,
        taskName,
        startTime: new Date(),
        lastRun: new Date()
      });
      
      return {
        taskName,
        intervalMs,
        started: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error(`Ошибка запуска фоновой задачи: ${error.message}`);
      throw error;
    }
  }

  // Остановка фоновой задачи
  async stopBackgroundTask(taskName) {
    try {
      const taskInfo = this.activeProcesses.get(`task_${taskName}`);
      
      if (!taskInfo || !taskInfo.intervalId) {
        throw new Error(`Фоновая задача ${taskName} не найдена`);
      }
      
      clearInterval(taskInfo.intervalId);
      this.activeProcesses.delete(`task_${taskName}`);
      
      logger.info(`Фоновая задача остановлена: ${taskName}`);
      
      return {
        success: true,
        taskName,
        stopped: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error(`Ошибка остановки фоновой задачи: ${error.message}`);
      throw error;
    }
  }

  // Очистка старых/завершенных процессов
  async cleanupOldProcesses(maxAgeHours = 24) {
    try {
      const now = new Date();
      const toDelete = [];
      
      for (const [processId, processInfo] of this.activeProcesses) {
        if (processInfo.endTime) {
          const ageHours = (now - processInfo.endTime) / (1000 * 60 * 60);
          
          if (ageHours > maxAgeHours) {
            toDelete.push(processId);
          }
        }
      }
      
      toDelete.forEach(processId => {
        this.activeProcesses.delete(processId);
      });
      
      logger.info(`Очищено старых процессов: ${toDelete.length}`);
      
      return {
        cleaned: toDelete.length,
        remaining: this.activeProcesses.size
      };
      
    } catch (error) {
      logger.error(`Ошибка очистки процессов: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new ProcessService();