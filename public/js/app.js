// Основной JavaScript файл для фронтенда
class RustPanelApp {
    constructor() {
        this.apiBase = '/api';
        this.wsBase = window.location.origin.replace('http', 'ws');
        this.token = localStorage.getItem('auth_token');
        this.user = JSON.parse(localStorage.getItem('user') || '{}');
        this.socket = null;
        this.currentServer = null;
        this.activePage = 'dashboard';
        
        this.init();
    }
    
    init() {
        this.checkAuth();
        this.initNavigation();
        this.loadPage(this.activePage);
        this.connectWebSocket();
        this.initEventListeners();
    }
    
    checkAuth() {
        if (!this.token) {
            this.showLogin();
            return false;
        }
        
        // Проверяем токен
        this.verifyToken().catch(() => {
            this.showLogin();
        });
        
        return true;
    }
    
    showLogin() {
        // Показываем модальное окно логина
        const loginHTML = `
            <div class="modal fade" id="loginModal" tabindex="-1" aria-hidden="false" data-bs-backdrop="static">
                <div class="modal-dialog">
                    <div class="modal-content bg-dark">
                        <div class="modal-header">
                            <h5 class="modal-title">Авторизация</h5>
                        </div>
                        <div class="modal-body">
                            <form id="loginForm">
                                <div class="mb-3">
                                    <label class="form-label">Имя пользователя</label>
                                    <input type="text" class="form-control" id="username" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Пароль</label>
                                    <input type="password" class="form-control" id="password" required>
                                </div>
                                <div class="alert alert-danger d-none" id="loginError"></div>
                                <button type="submit" class="btn btn-primary w-100">
                                    <i class="bi bi-box-arrow-in-right"></i> Войти
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', loginHTML);
        const modal = new bootstrap.Modal(document.getElementById('loginModal'));
        modal.show();
        
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });
    }
    
    async login() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch(`${this.apiBase}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.token = data.token;
                this.user = data.user;
                
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                document.getElementById('loginModal').remove();
                this.init();
            } else {
                this.showError('loginError', data.error);
            }
        } catch (error) {
            this.showError('loginError', 'Ошибка соединения');
        }
    }
    
    async verifyToken() {
        const response = await fetch(`${this.apiBase}/auth/verify`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            throw new Error('Invalid token');
        }
        
        return await response.json();
    }
    
    initNavigation() {
        // Инициализация навигационного меню
        const navItems = document.querySelectorAll('.nav-link[data-page]');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.loadPage(page);
                
                // Обновляем активный элемент
                navItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
        });
        
        // Кнопка выхода
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user');
                window.location.reload();
            });
        }
    }
    
    async loadPage(page) {
        this.activePage = page;
        document.getElementById('page-title').textContent = this.getPageTitle(page);
        
        // Показываем загрузку
        document.getElementById('page-content').innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary"></div>
                <p class="mt-3">Загрузка...</p>
            </div>
        `;
        
        try {
            const content = await this.fetchPageContent(page);
            document.getElementById('page-content').innerHTML = content;
            
            // Инициализируем страницу
            this.initPage(page);
        } catch (error) {
            document.getElementById('page-content').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i>
                    Ошибка загрузки страницы: ${error.message}
                </div>
            `;
        }
    }
    
    async fetchPageContent(page) {
        // Загружаем HTML для страницы
        try {
            const response = await fetch(`/pages/${page}.html`);
            if (response.ok) {
                return await response.text();
            }
        } catch (error) {
            console.warn(`Не удалось загрузить страницу ${page}:`, error);
        }
        
        // Fallback: базовые шаблоны
        return this.getFallbackPage(page);
    }
    
    getFallbackPage(page) {
        const pages = {
            dashboard: this.getDashboardHTML(),
            servers: this.getServersHTML(),
            console: this.getConsoleHTML(),
            configs: this.getConfigsHTML(),
            plugins: this.getPluginsHTML(),
            shop: this.getShopHTML(),
            backups: this.getBackupsHTML(),
            settings: this.getSettingsHTML()
        };
        
        return pages[page] || '<div class="alert alert-info">Страница в разработке</div>';
    }
    
    getPageTitle(page) {
        const titles = {
            dashboard: 'Дашборд',
            servers: 'Управление серверами',
            console: 'RCON Консоль',
            configs: 'Конфигурационные файлы',
            plugins: 'Плагины',
            shop: 'Магазин сервера',
            backups: 'Бэкапы',
            settings: 'Настройки'
        };
        
        return titles[page] || 'Панель управления';
    }
    
    connectWebSocket() {
        if (!this.token) return;
        
        this.socket = io({
            auth: { token: this.token },
            transports: ['websocket', 'polling']
        });
        
        this.socket.on('connect', () => {
            console.log('WebSocket подключен');
            this.updateStatus('online');
        });
        
        this.socket.on('disconnect', () => {
            console.log('WebSocket отключен');
            this.updateStatus('offline');
        });
        
        this.socket.on('error', (error) => {
            console.error('WebSocket ошибка:', error);
            this.updateStatus('error');
        });
        
        // Общие обработчики событий
        this.socket.on('server_stats', this.handleServerStats.bind(this));
        this.socket.on('console_output', this.handleConsoleOutput.bind(this));
        this.socket.on('players_online', this.handlePlayersOnline.bind(this));
    }
    
    updateStatus(status) {
        const statusElement = document.getElementById('system-status');
        if (statusElement) {
            const statuses = {
                online: '<span class="text-success">Онлайн</span>',
                offline: '<span class="text-danger">Отключено</span>',
                error: '<span class="text-warning">Ошибка</span>'
            };
            statusElement.innerHTML = statuses[status] || statuses.offline;
        }
    }
    
    initEventListeners() {
        // Глобальные обработчики событий
        document.addEventListener('click', (e) => {
            // Обработка кнопок с data-action
            if (e.target.closest('[data-action]')) {
                const element = e.target.closest('[data-action]');
                const action = element.dataset.action;
                const params = element.dataset.params ? JSON.parse(element.dataset.params) : {};
                
                this.handleAction(action, params);
            }
        });
    }
    
    handleAction(action, params) {
        switch(action) {
            case 'install-server':
                this.installServer();
                break;
            case 'control-server':
                this.controlServer(params.serverId, params.action);
                break;
            case 'connect-console':
                this.connectToConsole(params.serverId);
                break;
            case 'open-config':
                this.openConfigEditor(params.serverId, params.path);
                break;
            // ... другие действия
        }
    }
    
    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.classList.remove('d-none');
            
            setTimeout(() => {
                element.classList.add('d-none');
            }, 5000);
        }
    }
    
    showSuccess(message, duration = 3000) {
        // Показываем уведомление об успехе
        const toast = document.createElement('div');
        toast.className = 'toast align-items-center text-bg-success border-0';
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="bi bi-check-circle me-2"></i>${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        document.body.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast, { delay: duration });
        bsToast.show();
        
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }
    
    // Методы для конкретных страниц
    getDashboardHTML() {
        return `
            <div class="row">
                <div class="col-md-3">
                    <div class="card stat-card">
                        <div class="stat-value" id="cpu-usage">0%</div>
                        <div class="stat-label">CPU</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stat-card">
                        <div class="stat-value" id="memory-usage">0%</div>
                        <div class="stat-label">Память</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stat-card">
                        <div class="stat-value" id="disk-usage">0%</div>
                        <div class="stat-label">Диск</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stat-card">
                        <div class="stat-value" id="servers-count">0</div>
                        <div class="stat-label">Серверы</div>
                    </div>
                </div>
            </div>
            
            <div class="row mt-4">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <i class="bi bi-server"></i> Активные серверы
                        </div>
                        <div class="card-body" id="active-servers">
                            <div class="text-center py-3">
                                <div class="spinner-border spinner-border-sm"></div>
                                <span class="ms-2">Загрузка...</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <i class="bi bi-activity"></i> Системные логи
                        </div>
                        <div class="card-body">
                            <div class="console-output" id="system-logs" style="height: 300px;">
                                Загрузка логов...
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="row mt-4">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <i class="bi bi-speedometer"></i> Быстрые действия
                        </div>
                        <div class="card-body">
                            <div class="d-flex flex-wrap gap-2">
                                <button class="btn btn-primary" data-action="install-server">
                                    <i class="bi bi-plus-circle"></i> Установить сервер
                                </button>
                                <button class="btn btn-outline-primary" onclick="app.loadPage('console')">
                                    <i class="bi bi-terminal"></i> Открыть консоль
                                </button>
                                <button class="btn btn-outline-primary" onclick="app.loadPage('plugins')">
                                    <i class="bi bi-plugin"></i> Управление плагинами
                                </button>
                                <button class="btn btn-outline-primary" onclick="app.loadPage('shop')">
                                    <i class="bi bi-cart"></i> Магазин
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    getServersHTML() {
        return `
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <span><i class="bi bi-server"></i> Управление серверами</span>
                    <button class="btn btn-primary" data-action="install-server">
                        <i class="bi bi-plus-circle"></i> Установить сервер
                    </button>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-dark table-hover">
                            <thead>
                                <tr>
                                    <th>Имя</th>
                                    <th>Статус</th>
                                    <th>Игроки</th>
                                    <th>Uptime</th>
                                    <th>Действия</th>
                                </tr>
                            </thead>
                            <tbody id="servers-list">
                                <tr>
                                    <td colspan="5" class="text-center py-4">
                                        <div class="spinner-border spinner-border-sm"></div>
                                        <span class="ms-2">Загрузка серверов...</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }
    
    getConsoleHTML() {
        return `
            <div class="card">
                <div class="card-header">
                    <i class="bi bi-terminal"></i> RCON Консоль
                </div>
                <div class="card-body">
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <label class="form-label">Выберите сервер:</label>
                            <select class="form-select" id="console-server-select">
                                <option value="">Загрузка...</option>
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Быстрые команды:</label>
                            <div class="btn-group w-100">
                                <button class="btn btn-outline-secondary" data-console-command="status">
                                    Статус
                                </button>
                                <button class="btn btn-outline-secondary" data-console-command="players">
                                    Игроки
                                </button>
                                <button class="btn btn-outline-secondary" data-console-command="oxide.list">
                                    Плагины
                                </button>
                                <button class="btn btn-outline-secondary" data-console-command="server.save">
                                    Сохранить
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="console-output mb-3" id="console-output" style="height: 400px;">
                        Выберите сервер для подключения к консоли
                    </div>
                    
                    <div class="input-group">
                        <input type="text" class="form-control console-input" 
                               id="console-input" placeholder="Введите команду..." disabled>
                        <button class="btn btn-primary" id="console-send" disabled>
                            <i class="bi bi-send"></i>
                        </button>
                    </div>
                    
                    <div class="mt-3">
                        <button class="btn btn-outline-secondary btn-sm me-2" id="clear-console">
                            <i class="bi bi-trash"></i> Очистить
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" id="console-help">
                            <i class="bi bi-question-circle"></i> Справка
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" id="save-history">
                            <i class="bi bi-save"></i> Сохранить логи
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Остальные HTML шаблоны...
    
    initPage(page) {
        switch(page) {
            case 'dashboard':
                this.initDashboard();
                break;
            case 'servers':
                this.initServers();
                break;
            case 'console':
                this.initConsole();
                break;
            case 'configs':
                this.initConfigs();
                break;
            case 'plugins':
                this.initPlugins();
                break;
            case 'shop':
                this.initShop();
                break;
            case 'backups':
                this.initBackups();
                break;
            case 'settings':
                this.initSettings();
                break;
        }
    }
    
    async initDashboard() {
        await this.loadServersList('active-servers');
        await this.updateSystemStats();
        
        // Подписываемся на статистику
        if (this.socket) {
            this.socket.emit('subscribe_stats', { interval: 5000 });
        }
    }
    
    async initServers() {
        await this.loadServersTable();
    }
    
    async initConsole() {
        await this.loadServerSelect('console-server-select');
        
        // Обработчики консоли
        document.getElementById('console-server-select').addEventListener('change', (e) => {
            this.connectToConsole(e.target.value);
        });
        
        document.getElementById('console-send').addEventListener('click', () => {
            this.sendConsoleCommand();
        });
        
        document.getElementById('console-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendConsoleCommand();
            }
        });
        
        document.getElementById('clear-console').addEventListener('click', () => {
            document.getElementById('console-output').innerHTML = '';
        });
        
        document.getElementById('console-help').addEventListener('click', () => {
            this.showConsoleHelp();
        });
        
        // Быстрые команды
        document.querySelectorAll('[data-console-command]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const command = e.target.dataset.consoleCommand;
                document.getElementById('console-input').value = command;
                this.sendConsoleCommand();
            });
        });
    }
    
    // API методы
    async apiRequest(endpoint, options = {}) {
        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        };
        
        const response = await fetch(`${this.apiBase}${endpoint}`, {
            ...defaultOptions,
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
    }
    
    async getServers() {
        return await this.apiRequest('/server/list');
    }
    
    async installServer(data) {
        return await this.apiRequest('/server/install', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    async controlServer(serverId, action) {
        return await this.apiRequest(`/server/${serverId}/control`, {
            method: 'POST',
            body: JSON.stringify({ action })
        });
    }
    
    async getServerStatus(serverId) {
        return await this.apiRequest(`/server/${serverId}/status`);
    }
    
    async getConfigs(serverId, path = '') {
        return await this.apiRequest(`/configs/${serverId}/list?path=${encodeURIComponent(path)}`);
    }
    
    async getFile(serverId, filepath) {
        return await this.apiRequest(`/configs/${serverId}/file/${encodeURIComponent(filepath)}`);
    }
    
    async saveFile(serverId, filepath, content) {
        return await this.apiRequest(`/configs/${serverId}/file/${encodeURIComponent(filepath)}`, {
            method: 'POST',
            body: JSON.stringify({ content })
        });
    }
    
    async getPlugins(serverId) {
        return await this.apiRequest(`/plugins/${serverId}/list`);
    }
    
    async installPlugin(serverId, pluginUrl) {
        return await this.apiRequest(`/plugins/${serverId}/install`, {
            method: 'POST',
            body: JSON.stringify({ url: pluginUrl })
        });
    }
    
    async getShopItems(serverId) {
        return await this.apiRequest(`/shop/${serverId}/items`);
    }
    
    async addShopItem(serverId, itemData) {
        return await this.apiRequest(`/shop/${serverId}/items`, {
            method: 'POST',
            body: JSON.stringify(itemData)
        });
    }
    
    // Обработчики WebSocket событий
    handleServerStats(stats) {
        // Обновляем статистику на дашборде
        const cpuElement = document.getElementById('cpu-usage');
        const memoryElement = document.getElementById('memory-usage');
        const diskElement = document.getElementById('disk-usage');
        
        if (cpuElement) cpuElement.textContent = `${stats.cpu.toFixed(1)}%`;
        if (memoryElement) memoryElement.textContent = `${stats.memory.toFixed(1)}%`;
        if (diskElement) diskElement.textContent = `${stats.disk.toFixed(1)}%`;
    }
    
    handleConsoleOutput(data) {
        const outputElement = document.getElementById('console-output');
        if (!outputElement) return;
        
        const typeClass = {
            command: 'text-primary',
            response: 'text-light',
            error: 'text-danger',
            log: 'text-success',
            system: 'text-info'
        }[data.type] || 'text-light';
        
        const escapedData = this.escapeHtml(data.data);
        const line = `<span class="${typeClass}">${escapedData}</span><br>`;
        outputElement.innerHTML += line;
        outputElement.scrollTop = outputElement.scrollHeight;
    }
    
    handlePlayersOnline(data) {
        // Обновляем информацию об игроках
        const activeServers = document.getElementById('active-servers');
        if (activeServers) {
            // Обновляем счетчики игроков
            // ...
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Другие методы...
}

// Инициализация приложения
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new RustPanelApp();
    window.app = app; // Делаем доступным глобально
});