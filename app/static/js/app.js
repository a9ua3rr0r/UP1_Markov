// static/js/app.js
class LibToolApp {
    constructor() {
        this.books = [];
        this.readers = [];
        this.issues = [];
        this.currentPage = 'books';
        this.genresChart = null;
        this.bookSortOrder = 'default';

        this.init();
    }

    init() {
        this.bindEvents();
        this.showPage('books');
        this.showNotification('Приложение загружено', 'success');
    }

    bindEvents() {
        console.log('🔧 Инициализация обработчиков событий...');

        // Навигация
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.showPage(e.target.dataset.page);
            });
        });

        // Кнопки действий
        this.setupButtonHandlers();

        // Формы
        this.setupFormHandlers();

        // Фильтры
        this.setupFilterHandlers();

        console.log('✅ Все обработчики инициализированы');
    }

    setupButtonHandlers() {
        const buttons = {
            'btn-new-book': () => this.openBookModal(),
            'btn-new-reader': () => this.openReaderModal(),
            'btn-new-issue': () => this.openIssueModal(),
            'btn-refresh-stats': () => this.loadReports(),
            'btn-export-excel': () => this.exportToExcel(),
            'book-cancel': () => this.closeBookModal(),
            'reader-cancel': () => this.closeReaderModal(),
            'issue-cancel': () => this.closeIssueModal(),
            'book-delete': () => this.deleteBookHandler(),
            'reader-delete': () => this.deleteReaderHandler()
        };

        Object.entries(buttons).forEach(([id, handler]) => {
            document.getElementById(id)?.addEventListener('click', handler);
        });

        // Кнопка скачивания правил
        const rulesBtn = document.getElementById('downloadRules');
        if (rulesBtn) {
            rulesBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.downloadRules();
            });
        } else {
            this.createTempRulesButton();
        }
    }

    setupFormHandlers() {
        const forms = {
            'book-form': (e) => this.saveBook(e),
            'reader-form': (e) => this.saveReader(e),
            'issue-form': (e) => this.saveIssue(e)
        };

        Object.entries(forms).forEach(([id, handler]) => {
            document.getElementById(id)?.addEventListener('submit', handler);
        });
    }

    setupFilterHandlers() {
        const filters = {
            'search': () => this.renderBooks(),
            'filter-status': () => this.renderBooks(),
            'search-readers': () => this.renderReaders(),
            'filter-status-readers': () => this.renderReaders(),
            'filter-status-issues': () => this.renderIssues()
        };

        Object.entries(filters).forEach(([id, handler]) => {
            document.getElementById(id)?.addEventListener('input', handler);
            document.getElementById(id)?.addEventListener('change', handler);
        });
    }

    // Утилиты
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 4000);
    }

    showLoading(page, show) {
        const loading = document.getElementById(`${page}-loading`);
        const container = document.getElementById(`${page}-container`);

        if (loading) loading.style.display = show ? 'block' : 'none';
        if (container) container.style.display = show ? 'none' : 'block';
    }

    async apiCall(url, options = {}) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Call Failed:', error);
            throw error;
        }
    }

    // Навигация по страницам
    showPage(page) {
        console.log(`🔄 Переход на страницу: ${page}`);

        // Скрываем все активные элементы
        ['page', 'nav-btn', 'page-action', 'filter-group'].forEach(className => {
            document.querySelectorAll(`.${className}`).forEach(element => {
                if (element?.classList) {
                    element.classList.remove('active');
                }
            });
        });

        // Показываем выбранную страницу
        const elements = {
            page: document.getElementById(`${page}-page`),
            navButton: document.querySelector(`[data-page="${page}"]`),
            pageActions: document.getElementById(`${page}-actions`),
            pageFilters: document.getElementById(`${page}-filters`)
        };

        Object.entries(elements).forEach(([type, element]) => {
            if (element?.classList) {
                element.classList.add('active');
            }
        });

        // Обновляем заголовок
        const titles = {
            'books': '📖 Каталог книг',
            'readers': '👥 Управление читателями',
            'issues': '🔄 Выдача и возврат книг',
            'reports': '📊 Отчеты и статистика'
        };

        const pageTitle = document.getElementById('page-title');
        if (pageTitle) {
            pageTitle.textContent = titles[page] || 'Библиотека';
        }

        this.currentPage = page;
        this.loadPageData();
    }

    async loadPageData() {
        const loaders = {
            'books': () => this.loadBooks(),
            'readers': () => this.loadReaders(),
            'issues': () => this.loadIssues(),
            'reports': () => this.loadReports()
        };

        if (loaders[this.currentPage]) {
            await loaders[this.currentPage]();
        }
    }

    // Общие методы для работы с данными
    async loadData(type) {
        try {
            this.showLoading(type, true);
            this[type] = await this.apiCall(`/api/${type}`);
            this[`render${type.charAt(0).toUpperCase() + type.slice(1)}`]();
        } catch (error) {
            this.showNotification(`Ошибка загрузки ${type}: ${error.message}`, 'error');
        } finally {
            this.showLoading(type, false);
        }
    }

    async saveData(type, formData, id = null) {
        const url = id ? `/api/${type}/${id}` : `/api/${type}`;
        const method = id ? 'PUT' : 'POST';

        try {
            await this.apiCall(url, {
                method: method,
                body: JSON.stringify(formData)
            });

            this[`close${type.charAt(0).toUpperCase() + type.slice(1)}Modal`]();
            await this[`load${type.charAt(0).toUpperCase() + type.slice(1)}`]();
            this.showNotification(id ? 'Данные обновлены' : 'Данные добавлены', 'success');

        } catch (error) {
            this.showNotification('Ошибка сохранения: ' + error.message, 'error');
        }
    }

    async deleteData(type, id) {
        if (!confirm(`Вы уверены, что хотите удалить этот ${type}?`)) return;

        try {
            await this.apiCall(`/api/${type}/${id}`, { method: 'DELETE' });
            await this[`load${type.charAt(0).toUpperCase() + type.slice(1)}`]();
            this.showNotification('Данные удалены', 'success');
        } catch (error) {
            this.showNotification('Ошибка удаления: ' + error.message, 'error');
        }
    }

    // Книги
    async loadBooks() { await this.loadData('books'); }
    async loadReaders() { await this.loadData('readers'); }
    async loadIssues() { await this.loadData('issues'); }

    renderBooks() {
        const container = document.getElementById('books-container');
        if (!container) return;

        const searchTerm = document.getElementById('search')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('filter-status')?.value || '';

        let filteredBooks = this.books.filter(book => {
            const matchesSearch = book.name.toLowerCase().includes(searchTerm) ||
                                book.author.toLowerCase().includes(searchTerm);
            const matchesStatus = !statusFilter || book.status === statusFilter;
            return matchesSearch && matchesStatus;
        });

        filteredBooks = this.sortBooks(filteredBooks);
        this.renderBooksTableView(container, filteredBooks);
    }

    sortBooks(books) {
        const sortMethods = {
            'count_asc': (a, b) => a.count - b.count,
            'count_desc': (a, b) => b.count - a.count,
            'default': () => 0
        };

        return [...books].sort(sortMethods[this.bookSortOrder] || sortMethods.default);
    }

    setBookSortOrder(order) {
        this.bookSortOrder = order;
        this.renderBooks();
    }

    renderBooksTableView(container, books) {
        if (!books.length) {
            container.innerHTML = '<div class="text-center">Книги не найдены</div>';
            return;
        }

        const headers = ['ID', 'Название', 'Автор', 'Жанр', 'Кол-во', 'Статус', 'Действия'];

        let html = `
            <div class="table-container">
                <div class="table-header">
                    <div class="sort-controls">
                        <label>Сортировка по количеству:</label>
                        <select id="book-sort" onchange="app.setBookSortOrder(this.value)">
                            <option value="default" ${this.bookSortOrder === 'default' ? 'selected' : ''}>По умолчанию</option>
                            <option value="count_asc" ${this.bookSortOrder === 'count_asc' ? 'selected' : ''}>По возрастанию</option>
                            <option value="count_desc" ${this.bookSortOrder === 'count_desc' ? 'selected' : ''}>По убыванию</option>
                        </select>
                    </div>
                </div>
                <table class="table">
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                    <tbody>
        `;

        books.forEach(book => {
            html += `
                <tr>
                    <td>${book.id}</td>
                    <td><strong>${this.escapeHtml(book.name)}</strong></td>
                    <td>${this.escapeHtml(book.author)}</td>
                    <td>${this.escapeHtml(book.genre || '-')}</td>
                    <td>${book.count}</td>
                    <td class="status-${book.status}">${this.getBookStatusText(book.status)}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn success small" onclick="app.downloadCertificate(${book.id})" title="Скачать сертификат">
                                📄 Сертификат
                            </button>
                            <button class="btn secondary small" onclick="app.editBook(${book.id})" title="Редактировать">
                                ✏️ Редактировать
                            </button>
                            <button class="btn danger small" onclick="app.deleteBook(${book.id})" title="Удалить">
                                🗑️ Удалить
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    getBookStatusText(status) {
        const statusMap = {
            'available': 'Доступно',
            'issued': 'Выдано'
        };
        return statusMap[status] || status;
    }

    async downloadCertificate(bookId) {
        try {
            this.showNotification('Генерация сертификата...', 'info');
            const response = await fetch(`/api/certificate/${bookId}`);

            if (!response.ok) throw new Error('Ошибка генерации сертификата');

            await this.downloadFile(response, `certificate_book_${bookId}.docx`);
            this.showNotification('Сертификат успешно скачан', 'success');
        } catch (error) {
            this.showNotification('Ошибка скачивания сертификата: ' + error.message, 'error');
        }
    }

    // Скачивание файлов (общий метод)
    async downloadFile(response, defaultFilename) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Получаем имя файла из заголовков ответа
        const contentDisposition = response.headers.get('content-disposition');
        let filename = defaultFilename;

        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="(.+)"/);
            if (filenameMatch) filename = filenameMatch[1];
        }

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    async downloadRules() {
        try {
            this.showNotification('Подготовка файла правил...', 'info');
            const response = await fetch('/api/rules/download');

            if (!response.ok) throw new Error(`Ошибка загрузки правил: ${response.status}`);

            await this.downloadFile(response, 'Правила_библиотеки.pdf');
            this.showNotification('Правила библиотеки успешно скачаны', 'success');
        } catch (error) {
            this.showNotification('Ошибка скачивания правил: ' + error.message, 'error');
        }
    }

    // Модальные окны (общие методы)
    openModal(type, data = null) {
        const modal = document.getElementById(`modal-${type}`);
        const title = document.getElementById(`modal-${type}-title`);
        const deleteBtn = document.getElementById(`${type}-delete`);

        if (data) {
            title.textContent = `Редактировать ${this.getEntityName(type)}`;
            this.fillForm(`${type}-form`, data);
            deleteBtn?.classList.remove('hidden');
        } else {
            title.textContent = `Добавить ${this.getEntityName(type)}`;
            document.getElementById(`${type}-form`).reset();
            document.getElementById(`${type}-id`).value = '';
            deleteBtn?.classList.add('hidden');
        }

        modal.classList.remove('hidden');
    }

    closeModal(type) {
        document.getElementById(`modal-${type}`).classList.add('hidden');
    }

    getEntityName(type) {
        const names = {
            'book': 'книгу',
            'reader': 'читателя',
            'issue': 'выдачу'
        };
        return names[type] || type;
    }

    fillForm(formId, data) {
        Object.keys(data).forEach(key => {
            const element = document.getElementById(`${formId.split('-')[0]}-${key}`);
            if (element) element.value = data[key];
        });
    }

    // Специфичные методы для книг
    openBookModal(book = null) { this.openModal('book', book); }
    closeBookModal() { this.closeModal('book'); }

    async editBook(bookId) {
        try {
            const book = await this.apiCall(`/api/books/${bookId}`);
            this.openBookModal(book);
        } catch (error) {
            this.showNotification('Ошибка загрузки книги: ' + error.message, 'error');
        }
    }

    async saveBook(event) {
        event.preventDefault();

        const formData = {
            name: document.getElementById('book-name').value.trim(),
            author: document.getElementById('book-author').value.trim(),
            genre: document.getElementById('book-genre').value.trim(),
            count: parseInt(document.getElementById('book-count').value)
        };

        if (!formData.name || !formData.author) {
            this.showNotification('Заполните название и автора книги', 'error');
            return;
        }

        const bookId = document.getElementById('book-id').value;
        await this.saveData('books', formData, bookId);
    }

    async deleteBook(bookId) { await this.deleteData('books', bookId); }
    deleteBookHandler() {
        const bookId = document.getElementById('book-id').value;
        if (bookId) this.deleteBook(parseInt(bookId));
    }

    // Читатели
    renderReaders() {
        const container = document.getElementById('readers-container');
        if (!container) return;

        const searchTerm = document.getElementById('search-readers')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('filter-status-readers')?.value || '';

        const filteredReaders = this.readers.filter(reader => {
            const matchesSearch = reader.full_name.toLowerCase().includes(searchTerm);
            const matchesStatus = !statusFilter || reader.status === statusFilter;
            return matchesSearch && matchesStatus;
        });

        this.renderReadersTableView(container, filteredReaders);
    }

    renderReadersTableView(container, readers) {
        if (!readers.length) {
            container.innerHTML = '<div class="text-center">Читатели не найдены</div>';
            return;
        }

        const headers = ['ФИО', 'Контакты', 'Адрес', 'Дата регистрации', 'Книг на руках', 'Статус', 'Действия'];

        let html = `
            <div class="table-container">
                <table class="table">
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                    <tbody>
        `;

        readers.forEach(reader => {
            html += `
                <tr>
                    <td><strong>${this.escapeHtml(reader.full_name)}</strong></td>
                    <td>
                        ${reader.phone ? `📞 ${this.escapeHtml(reader.phone)}<br>` : ''}
                        ${reader.email ? `📧 ${this.escapeHtml(reader.email)}` : ''}
                    </td>
                    <td>${this.escapeHtml(reader.address || '-')}</td>
                    <td>${new Date(reader.registration_date).toLocaleDateString('ru-RU')}</td>
                    <td>${reader.books_count}</td>
                    <td class="status-${reader.status}">${reader.status === 'active' ? 'Активен' : 'Неактивен'}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn secondary small" onclick="app.editReader(${reader.id})">
                                ✏️ Редактировать
                            </button>
                            <button class="btn danger small" onclick="app.deleteReader(${reader.id})">
                                🗑️ Удалить
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    openReaderModal(reader = null) { this.openModal('reader', reader); }
    closeReaderModal() { this.closeModal('reader'); }

    editReader(readerId) {
        const reader = this.readers.find(r => r.id === readerId);
        if (reader) {
            this.openReaderModal(reader);
        } else {
            this.showNotification('Читатель не найден', 'error');
        }
    }

    async saveReader(event) {
        event.preventDefault();

        const formData = {
            full_name: document.getElementById('reader-name').value.trim(),
            phone: document.getElementById('reader-phone').value.trim(),
            email: document.getElementById('reader-email').value.trim(),
            address: document.getElementById('reader-address').value.trim(),
            status: document.getElementById('reader-status').value
        };

        if (!formData.full_name) {
            this.showNotification('Введите ФИО читателя', 'error');
            return;
        }

        const readerId = document.getElementById('reader-id').value;
        await this.saveData('readers', formData, readerId);
    }

    async deleteReader(readerId) { await this.deleteData('readers', readerId); }
    deleteReaderHandler() {
        const readerId = document.getElementById('reader-id').value;
        if (readerId) this.deleteReader(parseInt(readerId));
    }

    // Выдачи книг
    renderIssues() {
        const container = document.getElementById('issues-container');
        if (!container) return;

        const statusFilter = document.getElementById('filter-status-issues')?.value || '';
        const filteredIssues = this.issues.filter(issue =>
            !statusFilter || issue.status === statusFilter
        );

        this.renderIssuesTableView(container, filteredIssues);
    }

    renderIssuesTableView(container, issues) {
        if (!issues.length) {
            container.innerHTML = '<div class="text-center">Выдачи не найдены</div>';
            return;
        }

        const headers = ['Книга', 'Читатель', 'Дата выдачи', 'Планируемый возврат', 'Фактический возврат', 'Статус', 'Действия'];

        let html = `
            <div class="table-container">
                <table class="table">
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                    <tbody>
        `;

        issues.forEach(issue => {
            const isOverdue = issue.status === 'overdue';
            const isIssued = issue.status === 'issued';
            const statusClass = 'status-' + issue.status;
            let statusText = this.getIssueStatusText(issue.status);

            if (isOverdue) statusText = '⏰ ' + statusText;

            html += `
                <tr>
                    <td><strong>${this.escapeHtml(issue.book_name)}</strong></td>
                    <td>${this.escapeHtml(issue.reader_name)}</td>
                    <td>${new Date(issue.issue_date).toLocaleDateString('ru-RU')}</td>
                    <td class="${isOverdue ? 'text-danger' : ''}">${new Date(issue.planned_return_date).toLocaleDateString('ru-RU')}</td>
                    <td>${issue.actual_return_date ? new Date(issue.actual_return_date).toLocaleDateString('ru-RU') : '-'}</td>
                    <td class="${statusClass}">${statusText}</td>
                    <td>
                        ${isIssued || isOverdue ? `
                            <div class="table-actions">
                                <button class="btn primary small" onclick="app.returnIssue(${issue.id})" title="Принять возврат">
                                    ✅ Вернуть
                                </button>
                                ${isIssued ? `
                                <button class="btn warning small" onclick="app.markOverdue(${issue.id})" title="Отметить как просроченную">
                                    ⏰ Просрочено
                                </button>
                                ` : ''}
                            </div>
                        ` : '<span class="text-center">-</span>'}
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    getIssueStatusText(status) {
        const statusMap = {
            'issued': 'Выдана',
            'returned': 'Возвращена',
            'overdue': 'Просрочена'
        };
        return statusMap[status] || status;
    }

    // Экспорт в Excel
    async exportToExcel() {
        try {
            this.showNotification('Подготовка Excel файла...', 'info');
            const response = await fetch('/api/issues/export-excel');

            if (!response.ok) throw new Error(`Ошибка создания Excel файла: ${response.status}`);

            await this.downloadFile(response, 'выдачи_книг.xlsx');
            this.showNotification('Excel файл успешно скачан', 'success');
        } catch (error) {
            this.showNotification('Ошибка экспорта в Excel: ' + error.message, 'error');
        }
    }

    async markOverdue(issueId) {
        if (!confirm('Отметить выдачу как просроченную? Читателю будет начислен штраф.')) return;

        try {
            await this.apiCall(`/api/issues/${issueId}/mark-overdue`, { method: 'POST' });
            await Promise.all([this.loadIssues(), this.loadReports()]);
            this.showNotification('Выдача отмечена как просроченная', 'warning');
        } catch (error) {
            this.showNotification('Ошибка отметки просрочки: ' + error.message, 'error');
        }
    }

    async returnIssue(issueId) {
        if (!confirm('Подтвердите прием возврата книги?')) return;

        try {
            await this.apiCall(`/api/issues/${issueId}/return`, { method: 'POST' });
            await Promise.all([this.loadIssues(), this.loadBooks(), this.loadReaders()]);
            this.showNotification('Возврат книги принят', 'success');
        } catch (error) {
            this.showNotification('Ошибка приема возврата: ' + error.message, 'error');
        }
    }

    openIssueModal() {
        this.populateIssueSelects();
        const modal = document.getElementById('modal-issue');

        // Установка дат по умолчанию
        const today = new Date().toISOString().split('T')[0];
        const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        document.getElementById('issue-date').value = today;
        document.getElementById('issue-return-date').value = twoWeeks;

        modal.classList.remove('hidden');
    }

    closeIssueModal() { this.closeModal('issue'); }

    async populateIssueSelects() {
        if (this.books.length === 0) await this.loadBooks();
        if (this.readers.length === 0) await this.loadReaders();

        const selects = {
            'issue-book': this.books.filter(book => book.count > 0 && book.status === 'available'),
            'issue-reader': this.readers.filter(reader => reader.status === 'active')
        };

        Object.entries(selects).forEach(([selectId, items]) => {
            const select = document.getElementById(selectId);
            select.innerHTML = `<option value="">Выберите ${selectId.split('-')[1]}</option>`;

            items.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                const suffix = selectId.includes('book') ? ` (доступно: ${item.count})` : ` (книг на руках: ${item.books_count})`;
                option.textContent = `${item.name || item.full_name}${suffix}`;
                select.appendChild(option);
            });
        });
    }

    async saveIssue(event) {
        event.preventDefault();

        const formData = {
            book_id: parseInt(document.getElementById('issue-book').value),
            reader_id: parseInt(document.getElementById('issue-reader').value),
            planned_return_date: document.getElementById('issue-return-date').value
        };

        if (!formData.book_id || !formData.reader_id || !formData.planned_return_date) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        try {
            await this.apiCall('/api/issues', {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            this.closeIssueModal();
            await Promise.all([this.loadBooks(), this.loadIssues(), this.loadReaders()]);
            this.showNotification('Выдача книги оформлена', 'success');
        } catch (error) {
            this.showNotification('Ошибка оформления выдачи: ' + error.message, 'error');
        }
    }

    // Отчеты
    async loadReports() {
        try {
            this.showLoading('reports', true);
            const stats = await this.apiCall('/api/reports/stats');
            this.renderReports(stats);
        } catch (error) {
            this.showNotification('Ошибка загрузки отчетов: ' + error.message, 'error');
        } finally {
            this.showLoading('reports', false);
        }
    }

    renderReports(stats) {
        const container = document.getElementById('reports-container');
        if (!container) return;

        const statsItems = [
            { label: 'Всего книг:', value: stats.books.total },
            { label: 'Доступно книг:', value: stats.books.available },
            { label: 'Всего читателей:', value: stats.readers.total },
            { label: 'Активных читателей:', value: stats.readers.active },
            { label: 'Всего выдач:', value: stats.issues.total },
            { label: 'Текущих выдач:', value: stats.issues.current }
        ];

        let html = `
            <div class="reports-container">
                <div class="report-card">
                    <h3>📊 Общая статистика</h3>
                    <div class="stats-grid">
                        ${statsItems.map(item => `
                            <div class="stat-item">
                                <span>${item.label}</span>
                                <span class="stat-value">${item.value}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="report-card">
                    <h3>📚 Распределение по жанрам</h3>
                    <div style="height: 300px; position: relative;">
                        <canvas id="genreChart"></canvas>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        this.renderGenreChart(stats.genres);
    }

    renderGenreChart(genres) {
        const ctx = document.getElementById('genreChart').getContext('2d');

        if (this.genresChart) {
            this.genresChart.destroy();
        }

        this.genresChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(genres),
                datasets: [{
                    data: Object.values(genres),
                    backgroundColor: [
                        '#3498db', '#e74c3c', '#2ecc71', '#9b59b6',
                        '#f1c40f', '#1abc9c', '#34495e', '#e67e22',
                        '#95a5a6', '#d35400'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Временная кнопка для отладки
    createTempRulesButton() {
        console.warn('Создаем временную кнопку правил');
        const tempBtn = document.createElement('button');
        tempBtn.id = 'temp-rules-btn';
        tempBtn.textContent = '📥 Скачать правила (временная)';
        tempBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:10000;background:#dc3545;color:white;border:none;padding:10px 15px;border-radius:5px;cursor:pointer;';
        tempBtn.addEventListener('click', () => this.downloadRules());
        document.body.appendChild(tempBtn);
    }
}

// Инициализация приложения
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new LibToolApp();
});