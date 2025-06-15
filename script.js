// Global Variables
let csvData = [];
let filteredData = [];
let charts = {};
let selectedFile = null;
let overviewStats = {};

// Debug function to check canvas availability
window.debugCanvasElements = function() {
    console.log('=== Canvas Debug Info ===');
    console.log('Dashboard element:', document.getElementById('dashboard'));
    console.log('Dashboard display:', document.getElementById('dashboard')?.style.display);
    console.log('Portfolio exposure canvas:', document.getElementById('portfolio-exposure-chart'));
    console.log('All canvas elements:', Array.from(document.querySelectorAll('canvas')).map(c => ({id: c.id, visible: c.offsetParent !== null})));
    console.log('Charts section:', document.querySelector('.charts-section'));
    console.log('Charts grid:', document.querySelector('.charts-grid'));
};

// State management
const state = {
    filters: {
        dateFrom: null,
        dateTo: null,
        selectedTransactionTypes: [],
        projectSearch: ''
    },
    pagination: {
        currentPage: 1,
        itemsPerPage: 20
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

// Also try to initialize when window is fully loaded (including all scripts)
window.addEventListener('load', function() {
    console.log('Window fully loaded, Chart available:', typeof Chart !== 'undefined');
    if (typeof Chart !== 'undefined' && !window.appInitialized) {
        console.log('Chart.js is now available after window load');
        window.appInitialized = true;
    }
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
    
    document.getElementById('file-input').addEventListener('change', handleFileSelect);
    document.getElementById('process-btn').addEventListener('click', processSelectedFile);
    document.getElementById('change-file-btn').addEventListener('click', resetFileSelection);
    document.getElementById('retry-btn').addEventListener('click', resetFileSelection);
    document.getElementById('new-upload-btn').addEventListener('click', resetToLanding);
    
    // Filter functionality  
    document.getElementById('clear-filters').addEventListener('click', clearAllFilters);
    
    // Date presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => setDatePreset(e.target.dataset.days));
    });
    
    // Table functionality
    document.querySelectorAll('[data-sort]').forEach(th => {
        th.addEventListener('click', (e) => handleTableSort(e.target.dataset.sort));
    });
    
    document.getElementById('export-btn').addEventListener('click', exportToCSV);
    
    // Rows per page dropdowns
    document.getElementById('table-rows-select').addEventListener('change', handleMainTableRowsChange);
    document.getElementById('project-table-rows-select').addEventListener('change', handleProjectTableRowsChange);
    
    // Demo transactions button
    document.getElementById('demo-transactions-btn').addEventListener('click', loadDemoTransactions);
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
            selectFile(files[0]);
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

// File Selection Handling
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        selectFile(file);
    }
}

function selectFile(file) {
    console.log('File selected:', file.name, file.type, file.size);
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showError('Prosím, nahrajte CSV soubor. Vybraný soubor: ' + file.name);
        return;
    }
    
    selectedFile = file;
    showFileSelected(file);
}

function showFileSelected(file) {
    // Hide other states
    document.getElementById('upload-content').style.display = 'none';
    document.getElementById('upload-loading').style.display = 'none';
    document.getElementById('upload-success').style.display = 'none';
    document.getElementById('upload-error').style.display = 'none';
    
    // Show file selected state
    document.getElementById('file-selected').style.display = 'block';
    document.getElementById('file-name').textContent = file.name + ' (' + formatFileSize(file.size) + ')';
}

function resetFileSelection() {
    selectedFile = null;
    document.getElementById('file-input').value = '';
    
    // Show upload content, hide others
    document.getElementById('upload-content').style.display = 'block';
    document.getElementById('file-selected').style.display = 'none';
    document.getElementById('upload-loading').style.display = 'none';
    document.getElementById('upload-success').style.display = 'none';
    document.getElementById('upload-error').style.display = 'none';
}

function processSelectedFile() {
    if (!selectedFile) {
        showError('Žádný soubor nebyl vybrán');
        return;
    }
    
    // Check if Papa Parse is loaded
    if (typeof Papa === 'undefined') {
        showError('Knihovna pro zpracování CSV nebyla načtena. Zkontrolujte internetové připojení a obnovte stránku.');
        return;
    }
    
    console.log('Processing file:', selectedFile.name);
    
    // Hide file selected state and show loading
    document.getElementById('file-selected').style.display = 'none';
    showLoading();
    
    Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: function(results) {
            console.log('Papa Parse completed:', results);
            
            if (results.errors.length > 0) {
                console.error('Papa Parse errors:', results.errors);
                showError('Chyba při čtení CSV souboru: ' + results.errors[0].message + 
                         ' (Řádek: ' + (results.errors[0].row || 'neznámý') + ')');
                return;
            }
            
            if (!results.data || results.data.length === 0) {
                showError('CSV soubor je prázdný nebo neobsahuje validní data');
                return;
            }
            
            processCSVData(results.data);
        },
        error: function(error) {
            console.error('Papa Parse error:', error);
            showError('Chyba při zpracování souboru: ' + error.message);
        }
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Process CSV Data
function processCSVData(data) {
    try {
        console.log('Processing CSV data:', data.length, 'rows');
        console.log('Sample row:', data[0]);
        
        let validRows = 0;
        let invalidRows = 0;
        
        // Clean and validate data
        csvData = data.map((row, index) => {
            const cleanRow = {
                datum: parseDate(row['Datum'] || row['datum']),
                casova_zona: row['Časová zóna'] || row['casova_zona'] || '',
                typ: row['Typ'] || row['typ'] || '',
                detail: row['Detail'] || row['detail'] || '',
                castka: parseAmount(row['Částka [CZK]'] || row['castka'] || row['Částka']),
                projekt: row['Název projektu'] || row['projekt'] || '',
                odkaz: row['Odkaz na projekt'] || row['odkaz'] || '',
                typ_projektu: row['Typ projektu'] || row['typ_projektu'] || ''
            };
            
            // Debug logging for first few rows
            if (index < 3) {
                console.log(`Row ${index + 1}:`, {
                    original: row,
                    cleaned: cleanRow,
                    dateValid: !!cleanRow.datum,
                    amountValid: cleanRow.castka !== null
                });
            }
            
            // Validate required fields
            if (!cleanRow.datum || cleanRow.castka === null) {
                invalidRows++;
                console.warn(`Invalid row ${index + 1}:`, {
                    datum: cleanRow.datum,
                    castka: cleanRow.castka,
                    originalRow: row
                });
                return null;
            }
            
            validRows++;
            return cleanRow;
        }).filter(row => row !== null);
        
        console.log(`Processed: ${validRows} valid, ${invalidRows} invalid rows`);
        
        if (csvData.length === 0) {
            throw new Error(`Nebyly nalezeny žádné validní data. Zkontrolujte formát CSV souboru a názvy sloupců.`);
        }
        
        // Reset filters and show all data initially
        state.filters.dateFrom = null;
        state.filters.dateTo = null;
        state.filters.selectedTransactionTypes = [];
        state.filters.projectSearch = '';
        filteredData = [...csvData];
        
        // Clear UI filter elements
        resetFilterUI();
        
        showSuccess(csvData.length);
        setTimeout(() => {
            showDashboard();
            // Add a small delay to ensure dashboard is fully rendered
            setTimeout(() => {
                initializeDashboard();
            }, 100);
        }, 2000);
        
    } catch (error) {
        console.error('Error processing CSV data:', error);
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
    if (!amountStr && amountStr !== 0) return null;
    
    // Convert to string and remove currency symbols and spaces
    const cleaned = amountStr.toString()
        .replace(/[^\d,.-]/g, '')
        .replace(',', '.');
    
    if (cleaned === '') return null;
    
    const amount = parseFloat(cleaned);
    
    // Debug logging for problematic amounts
    if (isNaN(amount)) {
        console.warn('Failed to parse amount:', { original: amountStr, cleaned: cleaned });
        return null;
    }
    
    return amount;
}

// UI State Management
function showLoading() {
    document.getElementById('upload-content').style.display = 'none';
    document.getElementById('upload-loading').style.display = 'block';
    document.getElementById('upload-success').style.display = 'none';
    document.getElementById('upload-error').style.display = 'none';
}

function showSuccess(transactionCount = 0) {
    document.getElementById('upload-loading').style.display = 'none';
    document.getElementById('upload-success').style.display = 'block';
    document.getElementById('success-details').textContent = `Načteno transakcí: ${transactionCount}`;
}

function showError(message) {
    document.getElementById('upload-loading').style.display = 'none';
    document.getElementById('file-selected').style.display = 'none';
    document.getElementById('upload-error').style.display = 'block';
    document.getElementById('error-message').textContent = message;
    
    console.error('Upload error:', message);
}

function showDashboard() {
    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
}

function resetToLanding() {
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('landing-page').style.display = 'block';
    
    // Reset file selection state
    resetFileSelection();
    
    // Reset data
    csvData = [];
    filteredData = [];
    selectedFile = null;
    
    // Destroy charts
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
    charts = {};
}

// Dashboard Initialization
function initializeDashboard() {
    // Set filteredData to show all data initially (no filters)
    filteredData = [...csvData];
    
    // Update transaction count in header
    document.getElementById('transaction-count').textContent = csvData.length;
    
    calculateOverviewStatistics();
    updateStatistics();
    createFilterOptions();
    createCharts();
    updateTable();
    updateAdvancedStatistics();
    
    // Initialize button state (should be disabled initially)
    updateClearFiltersButton();
    
    // Set "Vše" preset as active by default
    setDefaultPresetButton();
}

// Overview Statistics (Fixed - not affected by filters)
function calculateOverviewStatistics() {
    overviewStats = calculateStatistics(csvData);
    
    // Calculate date range
    const dates = csvData.map(row => row.datum).sort((a, b) => a - b);
    overviewStats.oldestDate = dates[0];
    overviewStats.newestDate = dates[dates.length - 1];
    
    // Update fixed overview display
    document.getElementById('total-investment').textContent = locale.formatNumber(overviewStats.totalInvestment);
    document.getElementById('total-withdrawals').textContent = locale.formatNumber(overviewStats.totalWithdrawals);
    document.getElementById('largest-investment').textContent = locale.formatNumber(overviewStats.largestInvestment);
    document.getElementById('transaction-count-stat').textContent = overviewStats.totalTransactions;
    document.getElementById('average-investment').textContent = locale.formatNumber(overviewStats.averageInvestment);
    document.getElementById('portfolio-stages').textContent = overviewStats.portfolioStages;
    document.getElementById('date-range-start').textContent = locale.formatDate(overviewStats.oldestDate);
    document.getElementById('date-range-end').textContent = locale.formatDate(overviewStats.newestDate);
    document.getElementById('total-fees').textContent = locale.formatNumber(overviewStats.totalFees);
    
    // Calculate and display autoinvest statistics
    calculateAutoinvestStatistics();
}

function calculateAutoinvestStatistics() {
    // Filter autoinvest transactions
    const autoinvestTransactions = csvData.filter(row => 
        row.typ === 'Autoinvestice'
    );
    
    const autoinvestEmpty = document.getElementById('autoinvest-empty');
    const autoinvestStats = document.getElementById('autoinvest-stats');
    
    if (autoinvestTransactions.length === 0) {
        // Show empty state
        autoinvestEmpty.style.display = 'block';
        autoinvestStats.style.display = 'none';
    } else {
        // Show statistics
        autoinvestEmpty.style.display = 'none';
        autoinvestStats.style.display = 'block';
        
        // Calculate statistics
        const count = autoinvestTransactions.length;
        const totalAmount = autoinvestTransactions.reduce((sum, row) => sum + Math.abs(row.castka), 0);
        const averageAmount = totalAmount / count;
        
        // Sort by date to find first and last
        const sortedTransactions = autoinvestTransactions.sort((a, b) => a.datum - b.datum);
        const firstTransaction = sortedTransactions[0];
        const lastTransaction = sortedTransactions[sortedTransactions.length - 1];
        
        // Update display
        document.getElementById('autoinvest-count').textContent = count;
        document.getElementById('autoinvest-total').textContent = locale.formatNumber(totalAmount);
        document.getElementById('autoinvest-average').textContent = locale.formatNumber(averageAmount);
        
        document.getElementById('autoinvest-first-date').textContent = locale.formatDate(firstTransaction.datum);
        document.getElementById('autoinvest-first-amount').textContent = locale.formatNumber(Math.abs(firstTransaction.castka));
        
        document.getElementById('autoinvest-last-date').textContent = locale.formatDate(lastTransaction.datum);
        document.getElementById('autoinvest-last-amount').textContent = locale.formatNumber(Math.abs(lastTransaction.castka));
    }
}

// Statistics Calculation (for filtered data)
function updateStatistics() {
    // Overview statistics remain fixed, only update filtered stats if needed
    const filteredStats = calculateStatistics(filteredData);
    // Currently not updating any filtered stats in the main cards since they're now overview-only
}

function calculateStatistics(data) {
    if (data.length === 0) {
        return {
            totalTransactions: 0,
            totalInvestment: 0,
            totalWithdrawals: 0,
            averageInvestment: 0,
            portfolioStages: 0,
            largestInvestment: 0,
            totalFees: 0
        };
    }
    
    // Filter by transaction types according to new requirements
    // Handle both detailed transaction types (from demo data) and simple types (from sample data)
    const investments = data.filter(row => 
        row.typ === 'Investice do příležitosti' || 
        row.typ === 'Autoinvestice' ||
        (row.typ === 'Investice' && row.detail && row.detail.includes('Investice do příležitosti')) ||
        (row.typ === 'Investice' && !row.detail) // Simple sample data case
    );
    const withdrawals = data.filter(row => 
        row.typ === 'Výběr peněz' ||
        (row.typ === 'Výběr' && !row.detail) // Simple sample data case
    );
    const exits = data.filter(row => row.typ === 'Odstoupení');
    const fees = data.filter(row => 
        row.typ === 'Poplatek za předčasný prodej' || 
        row.typ === 'Poplatek za výběr' ||
        (row.typ === 'Poplatek' && !row.detail) // Simple sample data case
    );
    
    // Celková investice = sum of investments minus sum of exits
    const totalInvestmentAmount = investments.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    const totalExitAmount = exits.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    const totalInvestment = totalInvestmentAmount - totalExitAmount;
    
    // Celkové výběry = sum of withdrawals
    const totalWithdrawals = withdrawals.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    
    // Největší investice = highest amount from investments
    const largestInvestment = investments.length > 0 ? 
        Math.max(...investments.map(row => Math.abs(row.castka))) : 0;
    
    // Průměrná výše investice = mean of all investments
    const averageInvestment = investments.length > 0 ? 
        investments.reduce((sum, row) => sum + Math.abs(row.castka), 0) / investments.length : 0;
    
    // Počet etap v portfoliu = count of distinct project names in investments
    const uniqueInvestmentProjects = new Set(
        investments.map(row => row.projekt).filter(p => p && p.trim() !== '')
    );
    const portfolioStages = uniqueInvestmentProjects.size;
    
    // Poplatky = sum of all fees
    const totalFees = fees.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    
    return {
        totalTransactions: data.length,
        totalInvestment,
        totalWithdrawals,
        averageInvestment,
        portfolioStages,
        largestInvestment,
        totalFees
    };
}

// Filter Options Creation
function createFilterOptions() {
    createTransactionTypeDropdown();
    setupProjectSearch();
}

function createTransactionTypeDropdown() {
    const types = [...new Set(csvData.map(row => row.typ).filter(t => t))];
    const select = document.getElementById('transaction-type-select');
    
    select.innerHTML = types.map(type => {
        const count = csvData.filter(row => row.typ === type).length;
        return `<option value="${type}">${type} (${count})</option>`;
    }).join('');
    
    // Add event listener
    select.addEventListener('change', updateTransactionTypeFilter);
}

function setupProjectSearch() {
    const searchInput = document.getElementById('project-search');
    searchInput.addEventListener('input', debounce(handleProjectSearch, 300));
}

// Filter Functions
function updateTransactionTypeFilter() {
    const select = document.getElementById('transaction-type-select');
    const selectedOptions = Array.from(select.selectedOptions).map(option => option.value);
    
    state.filters.selectedTransactionTypes = selectedOptions;
    applyFilters();
}

function handleProjectSearch() {
    const searchTerm = document.getElementById('project-search').value.toLowerCase();
    state.filters.projectSearch = searchTerm;
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
    
    // Clear transaction type filters
    state.filters.selectedTransactionTypes = [];
    const select = document.getElementById('transaction-type-select');
    Array.from(select.options).forEach(option => option.selected = false);
    
    // Clear project search
    state.filters.projectSearch = '';
    document.getElementById('project-search').value = '';
    
    // Set "Vše" preset as active (default state)
    setDefaultPresetButton();
    
    applyFilters();
}

// Check if any filters are active
function hasActiveFilters() {
    return !!(
        state.filters.dateFrom ||
        state.filters.dateTo ||
        state.filters.selectedTransactionTypes.length > 0 ||
        state.filters.projectSearch.trim()
    );
}

// Update clear filters button state
function updateClearFiltersButton() {
    const clearBtn = document.getElementById('clear-filters');
    const hasFilters = hasActiveFilters();
    
    clearBtn.disabled = !hasFilters;
    
    if (hasFilters) {
        clearBtn.classList.remove('disabled');
    } else {
        clearBtn.classList.add('disabled');
    }
}

// Set default preset button (Vše) as active
function setDefaultPresetButton() {
    // Remove active class from all preset buttons first
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    
    // Find and activate the "Vše" button
    const allButton = document.querySelector('.preset-btn[data-days="all"]');
    if (allButton) {
        allButton.classList.add('active');
    }
}

// Reset filter UI elements to default state
function resetFilterUI() {
    // Clear date inputs if they exist (might not exist during initial load)
    const dateFromInput = document.getElementById('date-from');
    const dateToInput = document.getElementById('date-to');
    if (dateFromInput && dateFromInput._flatpickr) {
        dateFromInput._flatpickr.clear();
    }
    if (dateToInput && dateToInput._flatpickr) {
        dateToInput._flatpickr.clear();
    }
    
    // Clear project search
    const projectSearch = document.getElementById('project-search');
    if (projectSearch) {
        projectSearch.value = '';
    }
    
    // Reset transaction type dropdown
    const typeSelect = document.getElementById('transaction-type-select');
    if (typeSelect) {
        Array.from(typeSelect.options).forEach(option => option.selected = false);
    }
}

// Apply Filters
function applyFilters() {
    filteredData = csvData.filter(row => {
        // Date filter
        if (state.filters.dateFrom && row.datum < state.filters.dateFrom) return false;
        if (state.filters.dateTo && row.datum > state.filters.dateTo) return false;
        
        // Transaction type filter
        if (state.filters.selectedTransactionTypes.length > 0 && 
            !state.filters.selectedTransactionTypes.includes(row.typ)) return false;
        
        // Project search (only search in project field)
        if (state.filters.projectSearch) {
            const searchTerm = state.filters.projectSearch.toLowerCase();
            const projectName = (row.projekt || '').toLowerCase();
            
            if (!projectName.includes(searchTerm)) return false;
        }
        
        return true;
    });
    
    // Update clear filters button state
    updateClearFiltersButton();
    
    // Update UI
    updateStatistics();
    updateCharts();
    updateTable();
    updateAdvancedStatistics();
}

// Charts Creation
function createCharts() {
    createProjectTable();
    
    // Wait for Chart.js to be available before creating charts
    function tryCreateCharts(attempt = 1) {
        if (typeof Chart !== 'undefined') {
            console.log('Chart.js is available, creating charts...');
            createTimeSeriesChart();
            createProjectTypeChart();
            createPortfolioExposureChart();
            createTopProjectsChart();
        } else {
            console.log(`Chart.js not ready, attempt ${attempt}/10, waiting...`);
            if (attempt < 10) {
                // Try again after increasing delay
                setTimeout(() => tryCreateCharts(attempt + 1), attempt * 200);
            } else {
                console.error('Chart.js failed to load after 10 attempts');
                // Show a message to the user
                const timeChartContainer = document.querySelector('#time-chart').parentElement;
                timeChartContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Graf se nepodařilo načíst. Zkuste obnovit stránku.</p>';
            }
        }
    }
    
    tryCreateCharts();
}

function createProjectTable() {
    const projectData = {};
    
    // Process each transaction and group by project
    filteredData.forEach(row => {
        const project = row.projekt || 'Neuvedený projekt';
        
        if (!projectData[project]) {
            projectData[project] = {
                projekt: project,
                investice: 0,
                vynosy: 0,
                splaceno: 0,
                prodeje: 0,
                zbyva_splatit: 0
            };
        }
        
        const amount = Math.abs(row.castka);
        
        // Investice = Autoinvestice + Investice + Investice do příležitosti - Odstoupení
        if (row.typ === 'Autoinvestice' || 
            row.typ === 'Investice' || 
            row.typ === 'Investice do příležitosti') {
            projectData[project].investice += amount;
        } else if (row.typ === 'Odstoupení') {
            projectData[project].investice -= amount;
        }
        
        // Výnosy = Výnos + Bonusový výnos + Zákonné úroky z prodlení + Smluvní pokuta
        else if (row.typ === 'Výnos' || 
                 row.typ === 'Bonusový výnos' || 
                 row.typ === 'Zákonné úroky z prodlení' || 
                 row.typ === 'Smluvní pokuta') {
            projectData[project].vynosy += amount;
        }
        
        // Splaceno = Částečné splacení jistiny + Splacení jistiny
        else if (row.typ === 'Částečné splacení jistiny' || 
                 row.typ === 'Splacení jistiny') {
            projectData[project].splaceno += amount;
        }
        
        // Prodeje = Prodej
        else if (row.typ === 'Prodej') {
            projectData[project].prodeje += amount;
        }
    });
    
    // Calculate "Zbývá splatit" for each project
    Object.values(projectData).forEach(project => {
        project.zbyva_splatit = project.investice - project.splaceno - project.prodeje;
    });
    
    // Convert to array and sort
    const projectArray = Object.values(projectData)
        .filter(project => project.investice > 0 || project.vynosy > 0 || project.splaceno > 0 || project.prodeje > 0)
        .sort((a, b) => {
            const field = projectTableSortField;
            let comparison = 0;
            
            if (field === 'projekt') {
                comparison = a[field].localeCompare(b[field]);
            } else {
                comparison = a[field] - b[field];
            }
            
            return projectTableSortDirection === 'asc' ? comparison : -comparison;
        });
    
    // Store the complete data and update table with pagination
    allProjectData = projectArray;
    updateProjectTable();
}

function updateProjectTable() {
    const tableBody = document.getElementById('project-table-body');
    
    if (allProjectData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #666;">Žádné projekty nenalezeny</td></tr>';
        updateProjectTablePagination();
        return;
    }
    
    // Paginate the data
    const paginatedData = paginateProjectData(allProjectData);
    
    tableBody.innerHTML = paginatedData.map(project => `
        <tr>
            <td>${project.projekt}</td>
            <td>${locale.formatNumber(project.investice)}</td>
            <td>${locale.formatNumber(project.vynosy)}</td>
            <td>${locale.formatNumber(project.splaceno)}</td>
            <td>${locale.formatNumber(project.prodeje)}</td>
            <td class="${Math.abs(project.zbyva_splatit) < 0.01 ? 'amount-neutral' : (project.zbyva_splatit > 0 ? 'amount-positive' : 'amount-negative')}">${locale.formatNumber(project.zbyva_splatit)}</td>
        </tr>
    `).join('');
    
    // Add sorting functionality to the project table
    setupProjectTableSorting();
    
    // Set initial sort indicator
    setInitialSortIndicator();
    
    // Update pagination
    updateProjectTablePagination();
}

function setInitialSortIndicator() {
    // Clear all sort indicators
    const headers = document.querySelectorAll('#project-table th[data-sort] i');
    headers.forEach(icon => {
        icon.className = 'fas fa-sort';
    });
    
    // Set indicator for current sort field
    const currentHeader = document.querySelector(`#project-table th[data-sort="${projectTableSortField}"] i`);
    if (currentHeader) {
        currentHeader.className = projectTableSortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
    }
}

function setupProjectTableSorting() {
    const headers = document.querySelectorAll('#project-table th[data-sort]');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const sortField = header.dataset.sort;
            sortProjectTable(sortField);
        });
    });
}

let projectTableSortField = 'projekt';
let projectTableSortDirection = 'asc';

// Project table pagination state
let projectTablePagination = {
    currentPage: 1,
    itemsPerPage: 20
};
let allProjectData = [];

function sortProjectTable(field) {
    // Toggle direction if same field
    if (projectTableSortField === field) {
        projectTableSortDirection = projectTableSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        projectTableSortField = field;
        // Default direction depends on field type
        projectTableSortDirection = field === 'projekt' ? 'asc' : 'desc';
    }
    
    // Update header indicators
    const headers = document.querySelectorAll('#project-table th[data-sort] i');
    headers.forEach(icon => {
        icon.className = 'fas fa-sort';
    });
    
    const currentHeader = document.querySelector(`#project-table th[data-sort="${field}"] i`);
    if (currentHeader) {
        currentHeader.className = projectTableSortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
    }
    
    // Reset to first page when sorting changes
    projectTablePagination.currentPage = 1;
    
    // Re-create the table with new sorting
    createProjectTable();
}

function paginateProjectData(data) {
    const startIndex = (projectTablePagination.currentPage - 1) * projectTablePagination.itemsPerPage;
    const endIndex = startIndex + projectTablePagination.itemsPerPage;
    return data.slice(startIndex, endIndex);
}

function updateProjectTablePagination() {
    const totalItems = allProjectData.length;
    const totalPages = Math.ceil(totalItems / projectTablePagination.itemsPerPage);
    const currentPage = projectTablePagination.currentPage;
    
    const paginationInfo = document.querySelector('#project-table-pagination .pagination-info');
    const paginationControls = document.querySelector('#project-table-pagination .pagination-controls');
    
    if (totalItems === 0) {
        paginationInfo.innerHTML = '';
        paginationControls.innerHTML = '';
        return;
    }
    
    const startItem = (currentPage - 1) * projectTablePagination.itemsPerPage + 1;
    const endItem = Math.min(currentPage * projectTablePagination.itemsPerPage, totalItems);
    
    paginationInfo.innerHTML = `Zobrazeno ${startItem}-${endItem} z ${totalItems} projektů`;
    
    paginationControls.innerHTML = `
        <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changeProjectPage(${currentPage - 1})">
            <i class="fas fa-chevron-left"></i>
        </button>
        ${generateProjectPageNumbers(currentPage, totalPages)}
        <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changeProjectPage(${currentPage + 1})">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
}

function generateProjectPageNumbers(currentPage, totalPages) {
    let pages = '';
    const maxVisible = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        pages += `
            <button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changeProjectPage(${i})">
                ${i}
            </button>
        `;
    }
    
    return pages;
}

function changeProjectPage(page) {
    const totalPages = Math.ceil(allProjectData.length / projectTablePagination.itemsPerPage);
    if (page >= 1 && page <= totalPages) {
        projectTablePagination.currentPage = page;
        updateProjectTable();
    }
}

function createTimeSeriesChart() {
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded!');
        return;
    }
    
    // Destroy existing chart if it exists
    if (charts.timeSeries) {
        charts.timeSeries.destroy();
        charts.timeSeries = null;
    }
    
    const ctx = document.getElementById('time-chart').getContext('2d');
    
    // Check if we have data
    if (!filteredData || filteredData.length === 0) {
        console.log('No data available for time series chart');
        // Create empty chart
        charts.timeSeries = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'month',
                            displayFormats: {
                                month: 'MM/yy'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Měsíc'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Kumulativní čistá investice (Kč)'
                        }
                    }
                }
            }
        });
        return;
    }
    
    console.log('Creating time series chart with', filteredData.length, 'transactions');
    
    // Group data by month and calculate net investment
    const monthlyData = {};
    
    filteredData.forEach(row => {
        const monthKey = `${row.datum.getFullYear()}-${String(row.datum.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = 0;
        }
        
        // Calculate net value: Autoinvestice + Investice - Prodej - Vrácení peněz - Odstoupení
        const amount = Math.abs(row.castka);
        switch (row.typ) {
            case 'Autoinvestice':
            case 'Investice':
                monthlyData[monthKey] += amount; // Add positive
                break;
            case 'Prodej':
            case 'Vrácení peněz':
            case 'Odstoupení':
                monthlyData[monthKey] -= amount; // Subtract
                break;
        }
    });
    
    // Convert to chart data format with cumulative values
    const sortedMonths = Object.keys(monthlyData).sort();
    let cumulativeValue = 0;
    const chartData = sortedMonths.map(month => {
        cumulativeValue += monthlyData[month]; // Add current month to cumulative total
        return {
            x: month + '-01', // First day of month for proper time parsing
            y: cumulativeValue
        };
    });
    
    console.log('Chart data points:', chartData.length);
    
    charts.timeSeries = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Kumulativní čistá investice',
                data: chartData,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#2563eb',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
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
                            return 'Kumulativní čistá investice: ' + locale.formatNumber(context.parsed.y);
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
                            month: 'MM/yy'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Měsíc'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Čistá investice (Kč)'
                    },
                    ticks: {
                        callback: function(value) {
                            return locale.formatNumber(value);
                        }
                    }
                }
            },
            interaction: {
                intersect: false
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

function createProjectTypeChart() {
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded!');
        return;
    }
    
    // Destroy existing chart if it exists
    if (charts.projectType) {
        charts.projectType.destroy();
        charts.projectType = null;
    }
    
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
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded!');
        return;
    }
    
    // Destroy existing chart if it exists
    if (charts.topProjects) {
        charts.topProjects.destroy();
        charts.topProjects = null;
    }
    
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

function createPortfolioExposureChart(retryCount = 0) {
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded!');
        return;
    }
    
    let canvas = document.getElementById('portfolio-exposure-chart');
    if (!canvas) {
        console.log('Canvas not found, trying to create it...');
        // Try to find the chart container and create the canvas
        const containers = document.querySelectorAll('.chart-container');
        let portfolioContainer = null;
        
        containers.forEach(container => {
            const header = container.parentElement?.querySelector('.chart-header h3');
            if (header && header.textContent.includes('Aktuální expozice portfolia')) {
                portfolioContainer = container;
            }
        });
        
        if (portfolioContainer) {
            // Create the canvas element
            portfolioContainer.innerHTML = '<canvas id="portfolio-exposure-chart"></canvas>';
            canvas = document.getElementById('portfolio-exposure-chart');
            console.log('Created canvas element for portfolio exposure chart');
        } else {
            console.error('Could not find portfolio exposure container');
            return;
        }
    }
    
    // Destroy existing chart if it exists
    if (charts.portfolioExposure) {
        charts.portfolioExposure.destroy();
        charts.portfolioExposure = null;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Calculate portfolio exposure by project
    // Formula: (Investice + Autoinvestice + Investice do příležitosti - Odstoupení) - (Částečné splacení jistiny + Splacení jistiny) - Prodej
    // This matches the "Zbývá splatit" calculation from the project table
    const projectData = {};
    
    // Debug: Log all unique transaction types
    const allTypes = [...new Set(filteredData.map(row => row.typ))];
    console.log('All transaction types in data:', allTypes);
    
    filteredData.forEach(row => {
        if (!row.projekt) return;
        
        if (!projectData[row.projekt]) {
            projectData[row.projekt] = {
                investice: 0,
                splaceno: 0,
                prodeje: 0
            };
        }
        
        const amount = Math.abs(row.castka);
        
        // Investice = Autoinvestice + Investice + Investice do příležitosti - Odstoupení
        if (row.typ === 'Autoinvestice' || 
            row.typ === 'Investice' || 
            row.typ === 'Investice do příležitosti') {
            projectData[row.projekt].investice += amount;
        } else if (row.typ === 'Odstoupení') {
            projectData[row.projekt].investice -= amount;
        }
        
        // Splaceno = Částečné splacení jistiny + Splacení jistiny
        else if (row.typ === 'Částečné splacení jistiny' || 
                 row.typ === 'Splacení jistiny') {
            projectData[row.projekt].splaceno += amount;
        }
        
        // Prodeje = Prodej
        else if (row.typ === 'Prodej') {
            projectData[row.projekt].prodeje += amount;
        }
    });
    
    // Calculate exposure for each project: Investice - Splaceno - Prodeje
    const projectExposure = {};
    Object.entries(projectData).forEach(([project, data]) => {
        projectExposure[project] = data.investice - data.splaceno - data.prodeje;
    });
    
    console.log('Project exposure calculations:', projectExposure);
    
    // Filter out projects with zero or negative exposure and sort by exposure
    const validProjects = Object.entries(projectExposure)
        .filter(([, exposure]) => exposure > 0)
        .sort(([,a], [,b]) => b - a);
    
    if (validProjects.length === 0) {
        // Show empty state
        canvas.parentElement.innerHTML = '<div class="chart-empty">Žádná aktivní expozice portfolia</div>';
        return;
    }
    
    // Generate colors for the pie chart
    const colors = [
        '#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed',
        '#db2777', '#0891b2', '#65a30d', '#dc2626', '#9333ea',
        '#0d9488', '#ea580c', '#be123c', '#0369a1', '#7c2d12'
    ];
    
    const backgroundColors = validProjects.map((_, index) => colors[index % colors.length]);
    const borderColors = backgroundColors.map(color => color);
    
    charts.portfolioExposure = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: validProjects.map(([name]) => name.length > 25 ? name.substring(0, 25) + '...' : name),
            datasets: [{
                data: validProjects.map(([, exposure]) => exposure),
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 2
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
                            const label = validProjects[context.dataIndex][0];
                            const value = context.parsed;
                            const total = validProjects.reduce((sum, [, exposure]) => sum + exposure, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${locale.formatNumber(value)} (${percentage}%)`;
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
    // Update project table (replaces main chart)
    createProjectTable();
    
    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded in updateCharts!');
        return;
    }
    
    // Update charts (each function handles its own cleanup)
    createTimeSeriesChart();
    createProjectTypeChart();
    createPortfolioExposureChart();
    createTopProjectsChart();
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
    
    const paginationInfo = document.querySelector('#table-pagination .pagination-info');
    const paginationControls = document.querySelector('#table-pagination .pagination-controls');
    
    const startItem = (currentPage - 1) * state.pagination.itemsPerPage + 1;
    const endItem = Math.min(currentPage * state.pagination.itemsPerPage, totalItems);
    
    paginationInfo.innerHTML = `Zobrazeno ${startItem}-${endItem} z ${totalItems} záznamů`;
    
    paginationControls.innerHTML = `
        <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">
            <i class="fas fa-chevron-left"></i>
        </button>
        ${generatePageNumbers(currentPage, totalPages)}
        <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">
            <i class="fas fa-chevron-right"></i>
        </button>
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

function handleMainTableRowsChange(event) {
    const newItemsPerPage = parseInt(event.target.value);
    state.pagination.itemsPerPage = newItemsPerPage;
    state.pagination.currentPage = 1; // Reset to first page
    updateTable();
}

function handleProjectTableRowsChange(event) {
    const newItemsPerPage = parseInt(event.target.value);
    projectTablePagination.itemsPerPage = newItemsPerPage;
    projectTablePagination.currentPage = 1; // Reset to first page
    updateProjectTable();
}

function loadDemoTransactions() {
    console.log('Loading demo transactions from GitHub repository...');
    
    // Show loading state
    showLoading();
    
    // GitHub raw URL for the sample_data.csv file
    // This always gets the latest version from the main branch
    const githubRawURL = 'https://raw.githubusercontent.com/jindrich3/transactionsViz2/main/sample_data.csv';
    
    // Fetch the sample_data.csv file from GitHub
    fetch(githubRawURL)
        .then(response => {
            if (!response.ok) {
                throw new Error(`GitHub fetch error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(csvContent => {
            console.log('Demo CSV file loaded successfully from GitHub');
            
            // Parse the CSV content using Papa Parse
            Papa.parse(csvContent, {
                header: true,
                skipEmptyLines: true,
                encoding: 'UTF-8',
                complete: function(results) {
                    console.log('Demo data parsed:', results);
                    
                    if (results.errors.length > 0) {
                        console.error('Papa Parse errors:', results.errors);
                        showError('Chyba při čtení demo dat: ' + results.errors[0].message);
                        return;
                    }
                    
                    if (!results.data || results.data.length === 0) {
                        showError('Demo data jsou prázdná');
                        return;
                    }
                    
                    // Create a mock File object to simulate file selection
                    const demoFile = new File([csvContent], 'sample_data.csv', {
                        type: 'text/csv',
                        lastModified: Date.now()
                    });
                    
                    // Set as selected file and show file selected state
                    selectedFile = demoFile;
                    showFileSelected(demoFile);
                },
                error: function(error) {
                    console.error('Papa Parse error:', error);
                    showError('Chyba při zpracování demo dat: ' + error.message);
                }
            });
        })
        .catch(error => {
            console.error('Error loading demo data from GitHub:', error);
            showError('Nepodařilo se načíst demo data z GitHub repozitáře. Zkontrolujte internetové připojení.');
        });
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