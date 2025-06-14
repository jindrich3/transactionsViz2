// Global Variables
let csvData = [];
let filteredData = [];
let charts = {};

// State management
const state = {
    filters: {
        dateFrom: null,
        dateTo: null,
        selectedProjects: [],
        selectedTransactionTypes: [],
        globalSearch: ''
    },
    pagination: {
        currentPage: 1,
        itemsPerPage: 50
    },
    sorting: {
        column: 'datum',
        direction: 'desc'
    }
};

// Czech localization
const locale = {
    months: ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 
             'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'],
    formatNumber: (num) => {
        return new Intl.NumberFormat('cs-CZ', {
            style: 'currency',
            currency: 'CZK'
        }).format(num);
    },
    formatDate: (date) => {
        return new Date(date).toLocaleDateString('cs-CZ');
    }
};

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    initializeDatePickers();
    setupUploadArea();
}

// Event Listeners Setup
function setupEventListeners() {
    // Upload functionality
    document.getElementById('upload-btn').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });
    
    document.getElementById('file-input').addEventListener('change', handleFileUpload);
    document.getElementById('new-upload-btn').addEventListener('click', resetToLanding);
    
    // Filter functionality
    document.getElementById('clear-filters').addEventListener('click', clearAllFilters);
    document.getElementById('global-search').addEventListener('input', debounce(handleGlobalSearch, 300));
    document.getElementById('project-search').addEventListener('input', filterProjectOptions);
    
    // Date presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => setDatePreset(e.target.dataset.days));
    });
    
    // Table functionality
    document.querySelectorAll('[data-sort]').forEach(th => {
        th.addEventListener('click', (e) => handleTableSort(e.target.dataset.sort));
    });
    
    document.getElementById('export-btn').addEventListener('click', exportToCSV);
}

function handleGlobalSearch() {
    state.filters.globalSearch = document.getElementById('global-search').value;
    applyFilters();
}

// Setup drag and drop upload area
function setupUploadArea() {
    const uploadArea = document.getElementById('upload-area');
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
}

// Initialize date pickers
function initializeDatePickers() {
    const dateFromPicker = flatpickr('#date-from', {
        locale: 'cs',
        dateFormat: 'd.m.Y',
        onChange: function(selectedDates) {
            state.filters.dateFrom = selectedDates[0];
            applyFilters();
        }
    });
    
    const dateToPicker = flatpickr('#date-to', {
        locale: 'cs',
        dateFormat: 'd.m.Y',
        onChange: function(selectedDates) {
            state.filters.dateTo = selectedDates[0];
            applyFilters();
        }
    });
}

// File Upload Handling
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleFile(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showError('Prosím, nahrajte CSV soubor');
        return;
    }
    
    showLoading();
    
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: function(results) {
            if (results.errors.length > 0) {
                showError('Chyba při čtení CSV souboru: ' + results.errors[0].message);
                return;
            }
            
            processCSVData(results.data);
        },
        error: function(error) {
            showError('Chyba při zpracování souboru: ' + error.message);
        }
    });
}

// Process CSV Data
function processCSVData(data) {
    try {
        // Clean and validate data
        csvData = data.map((row, index) => {
            const cleanRow = {
                datum: parseDate(row['Datum'] || row['datum']),
                casova_zona: row['Časová zóna'] || row['casova_zona'] || '',
                typ: row['Typ'] || row['typ'] || '',
                detail: row['Detail'] || row['detail'] || '',
                castka: parseAmount(row['Částka [CZK]'] || row['castka']),
                projekt: row['Název projektu'] || row['projekt'] || '',
                odkaz: row['Odkaz na projekt'] || row['odkaz'] || '',
                typ_projektu: row['Typ projektu'] || row['typ_projektu'] || ''
            };
            
            // Validate required fields
            if (!cleanRow.datum || cleanRow.castka === null) {
                throw new Error(`Nevalidní data na řádku ${index + 1}`);
            }
            
            return cleanRow;
        }).filter(row => row.datum && row.castka !== null);
        
        if (csvData.length === 0) {
            throw new Error('Nebyly nalezeny žádné validní data');
        }
        
        filteredData = [...csvData];
        
        showSuccess();
        setTimeout(() => {
            showDashboard();
            initializeDashboard();
        }, 1500);
        
    } catch (error) {
        showError(error.message);
    }
}

// Date parsing helper
function parseDate(dateStr) {
    if (!dateStr) return null;
    
    // Try different date formats
    const formats = [
        /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,  // dd.mm.yyyy
        /^(\d{4})-(\d{1,2})-(\d{1,2})$/,   // yyyy-mm-dd
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/  // mm/dd/yyyy
    ];
    
    for (let format of formats) {
        const match = dateStr.match(format);
        if (match) {
            if (format === formats[0]) { // dd.mm.yyyy
                return new Date(match[3], match[2] - 1, match[1]);
            } else if (format === formats[1]) { // yyyy-mm-dd
                return new Date(match[1], match[2] - 1, match[3]);
            } else { // mm/dd/yyyy
                return new Date(match[3], match[1] - 1, match[2]);
            }
        }
    }
    
    // Fallback to native parsing
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
}

// Amount parsing helper
function parseAmount(amountStr) {
    if (!amountStr) return null;
    
    // Remove currency symbols and spaces, replace comma with dot
    const cleaned = amountStr.toString()
        .replace(/[^\d,.-]/g, '')
        .replace(',', '.');
    
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? null : amount;
}

// UI State Management
function showLoading() {
    document.getElementById('upload-content').style.display = 'none';
    document.getElementById('upload-loading').style.display = 'block';
    document.getElementById('upload-success').style.display = 'none';
    document.getElementById('upload-error').style.display = 'none';
}

function showSuccess() {
    document.getElementById('upload-loading').style.display = 'none';
    document.getElementById('upload-success').style.display = 'block';
}

function showError(message) {
    document.getElementById('upload-loading').style.display = 'none';
    document.getElementById('upload-error').style.display = 'block';
    document.getElementById('error-message').textContent = message;
    
    // Reset after 5 seconds
    setTimeout(() => {
        document.getElementById('upload-content').style.display = 'block';
        document.getElementById('upload-error').style.display = 'none';
    }, 5000);
}

function showDashboard() {
    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
}

function resetToLanding() {
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('landing-page').style.display = 'block';
    document.getElementById('upload-content').style.display = 'block';
    document.getElementById('upload-success').style.display = 'none';
    
    // Reset data
    csvData = [];
    filteredData = [];
    
    // Destroy charts
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
    charts = {};
}

// Dashboard Initialization
function initializeDashboard() {
    updateStatistics();
    createFilterOptions();
    createCharts();
    updateTable();
    updateAdvancedStatistics();
}

// Statistics Calculation
function updateStatistics() {
    const stats = calculateStatistics(filteredData);
    
    document.getElementById('transaction-count').textContent = stats.totalTransactions;
    document.getElementById('total-investment').textContent = locale.formatNumber(stats.totalInvestment);
    document.getElementById('total-withdrawals').textContent = locale.formatNumber(Math.abs(stats.totalWithdrawals));
    document.getElementById('net-position').textContent = locale.formatNumber(stats.netPosition);
    document.getElementById('transaction-count-stat').textContent = stats.totalTransactions;
    document.getElementById('active-projects').textContent = stats.activeProjects;
    document.getElementById('average-transaction').textContent = locale.formatNumber(stats.averageTransaction);
    document.getElementById('largest-investment').textContent = locale.formatNumber(stats.largestInvestment);
    document.getElementById('portfolio-diversity').textContent = stats.portfolioDiversity;
}

function calculateStatistics(data) {
    if (data.length === 0) {
        return {
            totalTransactions: 0,
            totalInvestment: 0,
            totalWithdrawals: 0,
            netPosition: 0,
            activeProjects: 0,
            averageTransaction: 0,
            largestInvestment: 0,
            portfolioDiversity: 0
        };
    }
    
    const positive = data.filter(row => row.castka > 0);
    const negative = data.filter(row => row.castka < 0);
    
    const totalInvestment = positive.reduce((sum, row) => sum + row.castka, 0);
    const totalWithdrawals = negative.reduce((sum, row) => sum + row.castka, 0);
    const netPosition = totalInvestment + totalWithdrawals;
    
    const uniqueProjects = new Set(data.map(row => row.projekt).filter(p => p));
    const uniqueProjectTypes = new Set(data.map(row => row.typ_projektu).filter(t => t));
    
    const averageTransaction = data.reduce((sum, row) => sum + Math.abs(row.castka), 0) / data.length;
    const largestInvestment = Math.max(...positive.map(row => row.castka), 0);
    
    return {
        totalTransactions: data.length,
        totalInvestment,
        totalWithdrawals,
        netPosition,
        activeProjects: uniqueProjects.size,
        averageTransaction,
        largestInvestment,
        portfolioDiversity: uniqueProjectTypes.size
    };
}

// Filter Options Creation
function createFilterOptions() {
    createProjectFilter();
    createTransactionTypeFilter();
}

function createProjectFilter() {
    const projects = [...new Set(csvData.map(row => row.projekt).filter(p => p))];
    const container = document.getElementById('project-options');
    
    container.innerHTML = projects.map(project => `
        <div class="project-option">
            <input type="checkbox" id="project-${project}" value="${project}">
            <label for="project-${project}">${project}</label>
        </div>
    `).join('');
    
    // Add event listeners
    container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateProjectFilter);
    });
}

function createTransactionTypeFilter() {
    const types = [...new Set(csvData.map(row => row.typ).filter(t => t))];
    const container = document.getElementById('transaction-types');
    
    container.innerHTML = types.map(type => {
        const count = csvData.filter(row => row.typ === type).length;
        return `
            <button class="transaction-type-btn" data-type="${type}">
                ${type}
                <span class="transaction-type-count">${count}</span>
            </button>
        `;
    }).join('');
    
    // Add event listeners
    container.querySelectorAll('.transaction-type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => toggleTransactionType(e.target.dataset.type));
    });
}

// Filter Functions
function filterProjectOptions() {
    const search = document.getElementById('project-search').value.toLowerCase();
    const options = document.querySelectorAll('.project-option');
    
    options.forEach(option => {
        const text = option.textContent.toLowerCase();
        option.style.display = text.includes(search) ? 'flex' : 'none';
    });
    
    document.getElementById('project-options').classList.add('show');
}

function updateProjectFilter() {
    const selected = Array.from(document.querySelectorAll('#project-options input:checked'))
        .map(input => input.value);
    
    state.filters.selectedProjects = selected;
    applyFilters();
}

function toggleTransactionType(type) {
    const btn = document.querySelector(`[data-type="${type}"]`);
    const isActive = btn.classList.contains('active');
    
    if (isActive) {
        btn.classList.remove('active');
        state.filters.selectedTransactionTypes = 
            state.filters.selectedTransactionTypes.filter(t => t !== type);
    } else {
        btn.classList.add('active');
        state.filters.selectedTransactionTypes.push(type);
    }
    
    applyFilters();
}

function setDatePreset(days) {
    // Remove active class from all preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    
    // Add active class to clicked button
    event.target.classList.add('active');
    
    if (days === 'all') {
        state.filters.dateFrom = null;
        state.filters.dateTo = null;
        document.getElementById('date-from')._flatpickr.clear();
        document.getElementById('date-to')._flatpickr.clear();
    } else {
        const today = new Date();
        const fromDate = new Date();
        fromDate.setDate(today.getDate() - parseInt(days));
        
        state.filters.dateFrom = fromDate;
        state.filters.dateTo = today;
        
        document.getElementById('date-from')._flatpickr.setDate(fromDate);
        document.getElementById('date-to')._flatpickr.setDate(today);
    }
    
    applyFilters();
}

function clearAllFilters() {
    // Clear date filters
    state.filters.dateFrom = null;
    state.filters.dateTo = null;
    document.getElementById('date-from')._flatpickr.clear();
    document.getElementById('date-to')._flatpickr.clear();
    
    // Clear project filters
    state.filters.selectedProjects = [];
    document.querySelectorAll('#project-options input').forEach(input => {
        input.checked = false;
    });
    
    // Clear transaction type filters
    state.filters.selectedTransactionTypes = [];
    document.querySelectorAll('.transaction-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Clear global search
    state.filters.globalSearch = '';
    document.getElementById('global-search').value = '';
    
    // Clear preset button active states
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    
    applyFilters();
}

// Apply Filters
function applyFilters() {
    filteredData = csvData.filter(row => {
        // Date filter
        if (state.filters.dateFrom && row.datum < state.filters.dateFrom) return false;
        if (state.filters.dateTo && row.datum > state.filters.dateTo) return false;
        
        // Project filter
        if (state.filters.selectedProjects.length > 0 && 
            !state.filters.selectedProjects.includes(row.projekt)) return false;
        
        // Transaction type filter
        if (state.filters.selectedTransactionTypes.length > 0 && 
            !state.filters.selectedTransactionTypes.includes(row.typ)) return false;
        
        // Global search
        if (state.filters.globalSearch) {
            const searchTerm = state.filters.globalSearch.toLowerCase();
            const searchableText = [
                row.detail,
                row.projekt,
                row.typ,
                row.typ_projektu
            ].join(' ').toLowerCase();
            
            if (!searchableText.includes(searchTerm)) return false;
        }
        
        return true;
    });
    
    // Update UI
    updateStatistics();
    updateCharts();
    updateTable();
    updateAdvancedStatistics();
}

// Charts Creation
function createCharts() {
    createMainChart();
    createTimeSeriesChart();
    createProjectTypeChart();
    createTopProjectsChart();
}

function createMainChart() {
    const ctx = document.getElementById('main-chart').getContext('2d');
    
    const transactionTypes = [...new Set(filteredData.map(row => row.typ))];
    const chartData = transactionTypes.map(type => {
        const typeData = filteredData.filter(row => row.typ === type);
        const positive = typeData.filter(row => row.castka > 0).reduce((sum, row) => sum + row.castka, 0);
        const negative = typeData.filter(row => row.castka < 0).reduce((sum, row) => sum + Math.abs(row.castka), 0);
        
        return {
            type,
            positive,
            negative
        };
    });
    
    charts.main = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.map(d => d.type),
            datasets: [{
                label: 'Příjmy',
                data: chartData.map(d => d.positive),
                backgroundColor: '#10b981',
                borderColor: '#059669',
                borderWidth: 1
            }, {
                label: 'Výdaje',
                data: chartData.map(d => -d.negative),
                backgroundColor: '#ef4444',
                borderColor: '#dc2626',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + 
                                locale.formatNumber(Math.abs(context.parsed.y));
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return locale.formatNumber(value);
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

function createTimeSeriesChart() {
    const ctx = document.getElementById('time-chart').getContext('2d');
    
    // Group data by month
    const monthlyData = {};
    filteredData.forEach(row => {
        const monthKey = `${row.datum.getFullYear()}-${String(row.datum.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = 0;
        }
        monthlyData[monthKey] += row.castka;
    });
    
    const sortedMonths = Object.keys(monthlyData).sort();
    const chartData = sortedMonths.map(month => ({
        x: month + '-01',
        y: monthlyData[month]
    }));
    
    charts.timeSeries = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Čistý tok',
                data: chartData,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return locale.formatNumber(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'month',
                        displayFormats: {
                            month: 'MMM yyyy'
                        }
                    }
                },
                y: {
                    ticks: {
                        callback: function(value) {
                            return locale.formatNumber(value);
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

function createProjectTypeChart() {
    const ctx = document.getElementById('project-type-chart').getContext('2d');
    
    const projectTypes = [...new Set(filteredData.map(row => row.typ_projektu).filter(t => t))];
    const chartData = projectTypes.map(type => {
        return filteredData.filter(row => row.typ_projektu === type)
            .reduce((sum, row) => sum + Math.abs(row.castka), 0);
    });
    
    const colors = [
        '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
        '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#14b8a6'
    ];
    
    charts.projectType = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: projectTypes,
            datasets: [{
                data: chartData,
                backgroundColor: colors.slice(0, projectTypes.length),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed * 100) / total).toFixed(1);
                            return context.label + ': ' + 
                                locale.formatNumber(context.parsed) + 
                                ' (' + percentage + '%)';
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

function createTopProjectsChart() {
    const ctx = document.getElementById('top-projects-chart').getContext('2d');
    
    // Group by project and sum amounts
    const projectTotals = {};
    filteredData.forEach(row => {
        if (row.projekt) {
            if (!projectTotals[row.projekt]) {
                projectTotals[row.projekt] = 0;
            }
            projectTotals[row.projekt] += Math.abs(row.castka);
        }
    });
    
    // Sort and take top 10
    const sortedProjects = Object.entries(projectTotals)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
    
    charts.topProjects = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedProjects.map(([name]) => name.length > 20 ? name.substring(0, 20) + '...' : name),
            datasets: [{
                label: 'Celková částka',
                data: sortedProjects.map(([,amount]) => amount),
                backgroundColor: '#2563eb',
                borderColor: '#1d4ed8',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return locale.formatNumber(context.parsed.x);
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        callback: function(value) {
                            return locale.formatNumber(value);
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

function updateCharts() {
    // Update main chart
    if (charts.main) {
        charts.main.destroy();
        createMainChart();
    }
    
    // Update time series chart
    if (charts.timeSeries) {
        charts.timeSeries.destroy();
        createTimeSeriesChart();
    }
    
    // Update project type chart
    if (charts.projectType) {
        charts.projectType.destroy();
        createProjectTypeChart();
    }
    
    // Update top projects chart
    if (charts.topProjects) {
        charts.topProjects.destroy();
        createTopProjectsChart();
    }
}

// Table Management
function updateTable() {
    const tbody = document.getElementById('table-body');
    const sortedData = sortData(filteredData);
    const paginatedData = paginateData(sortedData);
    
    tbody.innerHTML = paginatedData.map(row => `
        <tr>
            <td>${locale.formatDate(row.datum)}</td>
            <td>${row.typ}</td>
            <td title="${row.detail}">${row.detail.length > 50 ? row.detail.substring(0, 50) + '...' : row.detail}</td>
            <td class="${row.castka >= 0 ? 'amount-positive' : 'amount-negative'}">${locale.formatNumber(row.castka)}</td>
            <td title="${row.projekt}">${row.projekt.length > 30 ? row.projekt.substring(0, 30) + '...' : row.projekt}</td>
            <td>${row.typ_projektu}</td>
        </tr>
    `).join('');
    
    updatePagination();
}

function sortData(data) {
    return [...data].sort((a, b) => {
        let aVal = a[state.sorting.column];
        let bVal = b[state.sorting.column];
        
        // Handle different data types
        if (state.sorting.column === 'datum') {
            aVal = aVal.getTime();
            bVal = bVal.getTime();
        } else if (state.sorting.column === 'castka') {
            aVal = parseFloat(aVal);
            bVal = parseFloat(bVal);
        } else {
            aVal = aVal.toString().toLowerCase();
            bVal = bVal.toString().toLowerCase();
        }
        
        if (state.sorting.direction === 'asc') {
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
            return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
    });
}

function paginateData(data) {
    const startIndex = (state.pagination.currentPage - 1) * state.pagination.itemsPerPage;
    const endIndex = startIndex + state.pagination.itemsPerPage;
    return data.slice(startIndex, endIndex);
}

function handleTableSort(column) {
    if (state.sorting.column === column) {
        state.sorting.direction = state.sorting.direction === 'asc' ? 'desc' : 'asc';
    } else {
        state.sorting.column = column;
        state.sorting.direction = 'asc';
    }
    
    // Update sort indicators
    document.querySelectorAll('[data-sort]').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    const currentTh = document.querySelector(`[data-sort="${column}"]`);
    currentTh.classList.add(`sort-${state.sorting.direction}`);
    
    updateTable();
}

function updatePagination() {
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / state.pagination.itemsPerPage);
    const currentPage = state.pagination.currentPage;
    
    const paginationContainer = document.getElementById('table-pagination');
    
    const startItem = (currentPage - 1) * state.pagination.itemsPerPage + 1;
    const endItem = Math.min(currentPage * state.pagination.itemsPerPage, totalItems);
    
    paginationContainer.innerHTML = `
        <div class="pagination-info">
            Zobrazeno ${startItem}-${endItem} z ${totalItems} záznamů
        </div>
        <div class="pagination-controls">
            <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
            ${generatePageNumbers(currentPage, totalPages)}
            <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;
}

function generatePageNumbers(currentPage, totalPages) {
    let pages = '';
    const maxVisible = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        pages += `
            <button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">
                ${i}
            </button>
        `;
    }
    
    return pages;
}

function changePage(page) {
    const totalPages = Math.ceil(filteredData.length / state.pagination.itemsPerPage);
    if (page >= 1 && page <= totalPages) {
        state.pagination.currentPage = page;
        updateTable();
    }
}

// Advanced Statistics
function updateAdvancedStatistics() {
    const stats = calculateAdvancedStatistics(filteredData);
    
    document.getElementById('monthly-rate').textContent = locale.formatNumber(stats.monthlyRate);
    document.getElementById('investment-streak').textContent = stats.investmentStreak + ' dnů';
    document.getElementById('seasonal-pattern').textContent = stats.seasonalPattern;
    document.getElementById('investment-concentration').textContent = stats.concentrationPercentage + '%';
    document.getElementById('avg-days-between').textContent = Math.round(stats.avgDaysBetween);
}

function calculateAdvancedStatistics(data) {
    if (data.length === 0) {
        return {
            monthlyRate: 0,
            investmentStreak: 0,
            seasonalPattern: '-',
            concentrationPercentage: 0,
            avgDaysBetween: 0
        };
    }
    
    // Monthly investment rate
    const investmentData = data.filter(row => row.castka > 0);
    const months = new Set(investmentData.map(row => 
        `${row.datum.getFullYear()}-${row.datum.getMonth()}`
    )).size;
    const monthlyRate = months > 0 ? 
        investmentData.reduce((sum, row) => sum + row.castka, 0) / months : 0;
    
    // Investment streak (simplified)
    const investmentStreak = calculateLongestStreak(investmentData);
    
    // Seasonal pattern (most active month)
    const monthCounts = {};
    data.forEach(row => {
        const month = row.datum.getMonth();
        monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    
    const mostActiveMonth = Object.entries(monthCounts)
        .reduce((max, [month, count]) => count > max[1] ? [month, count] : max, ['0', 0]);
    const seasonalPattern = locale.months[parseInt(mostActiveMonth[0])];
    
    // Investment concentration (top 5 projects)
    const projectTotals = {};
    data.forEach(row => {
        if (row.projekt) {
            projectTotals[row.projekt] = (projectTotals[row.projekt] || 0) + Math.abs(row.castka);
        }
    });
    
    const totalAmount = Object.values(projectTotals).reduce((sum, amount) => sum + amount, 0);
    const top5Amount = Object.values(projectTotals)
        .sort((a, b) => b - a)
        .slice(0, 5)
        .reduce((sum, amount) => sum + amount, 0);
    
    const concentrationPercentage = totalAmount > 0 ? 
        Math.round((top5Amount / totalAmount) * 100) : 0;
    
    // Average days between transactions
    const sortedDates = data.map(row => row.datum).sort((a, b) => a - b);
    let totalDays = 0;
    let intervals = 0;
    
    for (let i = 1; i < sortedDates.length; i++) {
        const daysDiff = (sortedDates[i] - sortedDates[i-1]) / (1000 * 60 * 60 * 24);
        totalDays += daysDiff;
        intervals++;
    }
    
    const avgDaysBetween = intervals > 0 ? totalDays / intervals : 0;
    
    return {
        monthlyRate,
        investmentStreak,
        seasonalPattern,
        concentrationPercentage,
        avgDaysBetween
    };
}

function calculateLongestStreak(data) {
    if (data.length === 0) return 0;
    
    const sortedDates = data.map(row => row.datum).sort((a, b) => a - b);
    let longestStreak = 1;
    let currentStreak = 1;
    
    for (let i = 1; i < sortedDates.length; i++) {
        const daysDiff = (sortedDates[i] - sortedDates[i-1]) / (1000 * 60 * 60 * 24);
        
        if (daysDiff <= 31) { // Consider within a month as continuous
            currentStreak++;
        } else {
            longestStreak = Math.max(longestStreak, currentStreak);
            currentStreak = 1;
        }
    }
    
    return Math.max(longestStreak, currentStreak);
}

// Export Functionality
function exportToCSV() {
    const headers = ['Datum', 'Typ', 'Detail', 'Částka', 'Projekt', 'Typ projektu'];
    const csvContent = [
        headers.join(','),
        ...filteredData.map(row => [
            locale.formatDate(row.datum),
            `"${row.typ}"`,
            `"${row.detail}"`,
            row.castka,
            `"${row.projekt}"`,
            `"${row.typ_projektu}"`
        ].join(','))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `investicni_transakce_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
} 