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
        selectedProject: ''
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
    
    // Filter modal functionality  
    document.getElementById('filters-btn').addEventListener('click', openFilterModal);
    document.getElementById('close-filter-modal').addEventListener('click', closeFilterModal);
    document.getElementById('filter-modal-overlay').addEventListener('click', handleModalOverlayClick);
    document.getElementById('clear-filters').addEventListener('click', clearAllFilters);
    document.getElementById('apply-filters').addEventListener('click', applyFiltersAndClose);
    
    // Date presets (works in modal)
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
    
    // Header hide on scroll
    setupHeaderScrollBehavior();
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
            
            // Validate: if "To" date exists and is before "From" date, clear "To" date
            if (state.filters.dateTo && selectedDates[0] && selectedDates[0] > state.filters.dateTo) {
                dateToPicker.clear();
                state.filters.dateTo = null;
            }
            
            // Set minimum date for "To" picker
            dateToPicker.set('minDate', selectedDates[0]);
            
            updateClearFiltersButton();
            // Don't apply filters automatically - only when "Použít filtry" is clicked
        }
    });
    
    const dateToPicker = flatpickr('#date-to', {
        locale: 'cs',
        dateFormat: 'd.m.Y',
        onChange: function(selectedDates) {
            // Validate: "To" date cannot be before "From" date
            if (state.filters.dateFrom && selectedDates[0] && selectedDates[0] < state.filters.dateFrom) {
                // Clear the invalid selection
                dateToPicker.clear();
                // Show error message
                alert('Datum "Do" nemůže být před datem "Od"');
                return;
            }
            
            state.filters.dateTo = selectedDates[0];
            
            // Set maximum date for "From" picker
            dateFromPicker.set('maxDate', selectedDates[0]);
            
            updateClearFiltersButton();
            // Don't apply filters automatically - only when "Použít filtry" is clicked
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
        state.filters.selectedProject = '';
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
    
    // Reset scroll position to top
    window.scrollTo(0, 0);
    
    // Force layout recalculation by temporarily hiding and showing the landing page
    const landingPage = document.getElementById('landing-page');
    landingPage.style.display = 'none';
    // Force a reflow
    landingPage.offsetHeight;
    landingPage.style.display = 'flex';
    
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
    
    // Calculate date range and find oldest/newest transactions
    const sortedTransactions = csvData.slice().sort((a, b) => a.datum - b.datum);
    const oldestTransaction = sortedTransactions[0];
    const newestTransaction = sortedTransactions[sortedTransactions.length - 1];
    
    overviewStats.oldestDate = oldestTransaction.datum;
    overviewStats.newestDate = newestTransaction.datum;
    overviewStats.oldestAmount = Math.abs(oldestTransaction.castka);
    overviewStats.newestAmount = Math.abs(newestTransaction.castka);
    
    // Calculate marketing rewards
    const marketingRewards = csvData.filter(row => row.typ === 'Odměna')
        .reduce((sum, row) => sum + Math.abs(row.castka), 0);
    
    // Update fixed overview display with zero value styling
    setStatValueWithZeroClass('total-investment', overviewStats.totalInvestment);
    setStatValueWithZeroClass('total-profits', overviewStats.totalProfits);
    setStatValueWithZeroClass('total-withdrawals', overviewStats.totalWithdrawals);
    setStatValueWithZeroClass('marketing-rewards', marketingRewards);
    setStatValueWithZeroClass('largest-investment', overviewStats.largestInvestment);
    setStatValueWithZeroClass('average-investment', overviewStats.averageInvestment);
    setStatValueWithZeroClass('oldest-transaction-amount', overviewStats.oldestAmount);
    setStatValueWithZeroClass('newest-transaction-amount', overviewStats.newestAmount);
    setStatValueWithZeroClass('total-fees', overviewStats.totalFees);
    
    // Handle percentage display for gross current yield
    const grossYieldElement = document.getElementById('gross-current-yield');
    if (overviewStats.grossCurrentYield === 0) {
        grossYieldElement.textContent = '0%';
        grossYieldElement.classList.add('amount-zero');
    } else {
        grossYieldElement.textContent = `${overviewStats.grossCurrentYield.toFixed(2)}%`;
        grossYieldElement.classList.remove('amount-zero');
    }
    
    // These don't need zero styling (counts/dates)
    document.getElementById('transaction-count-stat').textContent = overviewStats.totalTransactions;
    document.getElementById('portfolio-stages').textContent = overviewStats.portfolioStages;
    document.getElementById('date-range-start').textContent = locale.formatDate(overviewStats.oldestDate);
    document.getElementById('date-range-end').textContent = locale.formatDate(overviewStats.newestDate);
    
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
        
        // Update display with zero value styling
        document.getElementById('autoinvest-count').textContent = count;
        setStatValueWithZeroClass('autoinvest-total', totalAmount);
        setStatValueWithZeroClass('autoinvest-average', averageAmount);
        setStatValueWithZeroClass('autoinvest-first-amount', Math.abs(firstTransaction.castka));
        setStatValueWithZeroClass('autoinvest-last-amount', Math.abs(lastTransaction.castka));
        
        // These don't need zero styling (dates)
        document.getElementById('autoinvest-first-date').textContent = locale.formatDate(firstTransaction.datum);
        document.getElementById('autoinvest-last-date').textContent = locale.formatDate(lastTransaction.datum);
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
            totalFees: 0,
            totalProfits: 0,
            grossCurrentYield: 0
        };
    }
    
    // Calculate Aktuální velikost portfolia using the specified formula:
    // Investice + Autoinvestice - Prodej - Vrácení peněz - Odstoupení - Částečné splacení jistiny - Splacení jistiny
    let totalInvestment = 0;
    
    data.forEach(row => {
        const amount = Math.abs(row.castka);
        const type = row.typ;
        
        // Apply the formula based on transaction type
        if (type === 'Autoinvestice' || type === 'Investice') {
            totalInvestment += amount;
        } else if (type === 'Prodej' || type === 'Částečné splacení jistiny' || 
                   type === 'Splacení jistiny' || type === 'Vrácení peněz' || type === 'Odstoupení') {
            totalInvestment -= amount;
        }
        // Other transaction types are ignored in this calculation
    });
    
    // Filter by transaction types for other statistics
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
    const fees = data.filter(row => 
        row.typ === 'Poplatek za předčasný prodej' || 
        row.typ === 'Poplatek za výběr' ||
        (row.typ === 'Poplatek' && !row.detail) // Simple sample data case
    );
    
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
    
    // Calculate new statistics
    // Zisky (Total Profits) = SUM(Bonusový výnos, Smluvní pokuta, Výnos, Zákonné úroky z prodlení)
    const profitTransactions = data.filter(row => 
        row.typ === 'Bonusový výnos' || 
        row.typ === 'Smluvní pokuta' || 
        row.typ === 'Výnos' || 
        row.typ === 'Zákonné úroky z prodlení'
    );
    const totalProfits = profitTransactions.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    
    // Total base investments for yield calculation = SUM(Investice, Autoinvestice)
    const baseInvestments = data.filter(row => 
        row.typ === 'Investice' || 
        row.typ === 'Autoinvestice'
    );
    const totalBaseInvestments = baseInvestments.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    
    // Hrubý aktuální výnos = (Total Profits / Total Base Investments) * 100
    const grossCurrentYield = totalBaseInvestments > 0 ? (totalProfits / totalBaseInvestments) * 100 : 0;
    
    return {
        totalTransactions: data.length,
        totalInvestment,
        totalWithdrawals,
        averageInvestment,
        portfolioStages,
        largestInvestment,
        totalFees,
        totalProfits,
        grossCurrentYield
    };
}

// Filter Options Creation
function createFilterOptions() {
    createTransactionTypeCheckboxes();
    setupProjectFilter();
}

function createTransactionTypeCheckboxes() {
    const types = [...new Set(csvData.map(row => row.typ).filter(t => t))].sort();
    const container = document.getElementById('transaction-type-checkboxes');
    
    container.innerHTML = types.map(type => {
        const count = csvData.filter(row => row.typ === type).length;
        const checkboxId = `checkbox-${type.replace(/\s+/g, '-').toLowerCase()}`;
        return `
            <div class="checkbox-item">
                <input type="checkbox" id="${checkboxId}" value="${type}">
                <label for="${checkboxId}">
                    ${type} <span class="checkbox-count">(${count})</span>
                </label>
            </div>
        `;
    }).join('');
    
    // Add event listeners to all checkboxes
    container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateTransactionTypeFilter);
    });
}

function setupProjectFilter() {
    createProjectFilterDropdown();
    const select = document.getElementById('project-filter-select');
    select.addEventListener('change', handleProjectFilter);
}

function createProjectFilterDropdown() {
    // Get unique project names and sort them alphabetically
    const projects = [...new Set(csvData.map(row => row.projekt))].filter(Boolean).sort();
    
    const select = document.getElementById('project-filter-select');
    
    // Keep the "All projects" option and add sorted projects
    select.innerHTML = '<option value="">Všechny projekty</option>' + 
        projects.map(project => `<option value="${project}">${project}</option>`).join('');
}

// Filter Functions
function updateTransactionTypeFilter() {
    const container = document.getElementById('transaction-type-checkboxes');
    const checkedBoxes = container.querySelectorAll('input[type="checkbox"]:checked');
    const selectedTypes = Array.from(checkedBoxes).map(checkbox => checkbox.value);
    
    state.filters.selectedTransactionTypes = selectedTypes;
    updateClearFiltersButton();
    // Don't apply filters automatically - only when "Použít filtry" is clicked
}

function handleProjectFilter() {
    const selectedProject = document.getElementById('project-filter-select').value;
    state.filters.selectedProject = selectedProject;
    updateClearFiltersButton();
    // Don't apply filters automatically - only when "Použít filtry" is clicked
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
    
    updateClearFiltersButton();
    // Don't apply filters automatically - only when "Použít filtry" is clicked
}

function clearAllFilters() {
    // Clear all filter state
    state.filters.dateFrom = null;
    state.filters.dateTo = null;
    state.filters.selectedTransactionTypes = [];
    state.filters.selectedProject = '';
    
    // Clear date picker inputs safely
    const dateFromInput = document.getElementById('date-from');
    const dateToInput = document.getElementById('date-to');
    if (dateFromInput && dateFromInput._flatpickr) {
        dateFromInput._flatpickr.clear();
    }
    if (dateToInput && dateToInput._flatpickr) {
        dateToInput._flatpickr.clear();
    }
    
    // Clear transaction type checkboxes
    const container = document.getElementById('transaction-type-checkboxes');
    if (container) {
        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
    }
    
    // Reset project filter to default "Všechny projekty"
    const projectSelect = document.getElementById('project-filter-select');
    if (projectSelect) {
        projectSelect.value = ''; // This sets it to "Všechny projekty"
    }
    
    // Set "Vše" preset as active and remove active from others
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    const allButton = document.querySelector('.preset-btn[data-days="all"]');
    if (allButton) {
        allButton.classList.add('active');
    }
    
    // Apply filters to update only the main transactions table
    applyFilters();
}

// Check if any filters are active
function hasActiveFilters() {
    return !!(
        state.filters.dateFrom ||
        state.filters.dateTo ||
        state.filters.selectedTransactionTypes.length > 0 ||
        state.filters.selectedProject
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
        
        // Also ensure the state is properly set for "all" preset
        state.filters.dateFrom = null;
        state.filters.dateTo = null;
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
    
    // Clear project filter
    const projectFilter = document.getElementById('project-filter-select');
    if (projectFilter) {
        projectFilter.value = '';
    }
    
    // Reset transaction type checkboxes
    const typeContainer = document.getElementById('transaction-type-checkboxes');
    if (typeContainer) {
        typeContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => checkbox.checked = false);
    }
}

// Apply Filters - Only affects the main transactions table
function applyFilters() {
    filteredData = csvData.filter(row => {
        // Date filter
        if (state.filters.dateFrom && row.datum < state.filters.dateFrom) return false;
        if (state.filters.dateTo && row.datum > state.filters.dateTo) return false;
        
        // Transaction type filter
        if (state.filters.selectedTransactionTypes.length > 0 && 
            !state.filters.selectedTransactionTypes.includes(row.typ)) return false;
        
        // Project filter
        if (state.filters.selectedProject) {
            if (row.projekt !== state.filters.selectedProject) return false;
        }
        
        return true;
    });
    
    // Update clear filters button state
    updateClearFiltersButton();
    
    // Update only the main transactions table (not charts, statistics, etc.)
    updateTable();
}

// Modal Functions
function openFilterModal() {
    const modalOverlay = document.getElementById('filter-modal-overlay');
    modalOverlay.classList.add('show');
    
    // Update clear filters button state when modal opens
    updateClearFiltersButton();
    
    // Trap focus in modal
    document.addEventListener('keydown', handleModalKeydown);
}

function closeFilterModal() {
    const modalOverlay = document.getElementById('filter-modal-overlay');
    modalOverlay.classList.remove('show');
    
    // Remove focus trap
    document.removeEventListener('keydown', handleModalKeydown);
}

function handleModalOverlayClick(event) {
    if (event.target.id === 'filter-modal-overlay') {
        closeFilterModal();
    }
}

function handleModalKeydown(event) {
    if (event.key === 'Escape') {
        closeFilterModal();
    }
}

function applyFiltersAndClose() {
    applyFilters();
    closeFilterModal();
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

function calculateProjectData() {
    const projectData = {};
    
    // Process each transaction and group by project
    csvData.forEach(row => {
        const project = row.projekt || 'Neuvedený projekt';
        
        if (!projectData[project]) {
            projectData[project] = {
                projekt: project,
                investice: 0,
                vynosy: 0,
                splaceno: 0,
                prodeje: 0,
                zbyva_splatit: 0,
                aktualni_vynos: 0
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
    
    // Calculate "Zbývá splatit" and "Aktuální výnos" for each project
    Object.values(projectData).forEach(project => {
        project.zbyva_splatit = project.investice - project.splaceno - project.prodeje;
        
        // Calculate yield percentage: (Výnosy / Investice) * 100
        if (project.investice > 0) {
            project.aktualni_vynos = (project.vynosy / project.investice) * 100;
        } else {
            project.aktualni_vynos = 0;
        }
    });
    
    // Convert to array and filter
    return Object.values(projectData)
        .filter(project => project.investice > 0 || project.vynosy > 0 || project.splaceno > 0 || project.prodeje > 0);
}

function createProjectTable() {
    // Reset sorting initialization when creating new table with new data
    projectTableSortingInitialized = false;
    
    // Calculate project data once
    const unsortedProjectData = calculateProjectData();
    
    // Sort the data
    allProjectData = sortProjectData(unsortedProjectData);
    
    // Setup sorting event listeners only once
    setupProjectTableSorting();
    
    // Update table display
    updateProjectTable();
}

function sortProjectData(data) {
    return [...data].sort((a, b) => {
        const field = projectTableSortField;
        let comparison = 0;
        
        if (field === 'projekt') {
            comparison = a[field].localeCompare(b[field]);
        } else {
            comparison = a[field] - b[field];
        }
        
        return projectTableSortDirection === 'asc' ? comparison : -comparison;
    });
}

function updateProjectTable() {
    const tableBody = document.getElementById('project-table-body');
    
    if (allProjectData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #666;">Žádné projekty nenalezeny</td></tr>';
        updateProjectTablePagination();
        return;
    }
    
    // Paginate the data
    const paginatedData = paginateProjectData(allProjectData);
    
    tableBody.innerHTML = paginatedData.map(project => {
        const investiceFormatted = formatAmountWithZeroClass(project.investice);
        const vynosyFormatted = formatAmountWithZeroClass(project.vynosy);
        const splacenoFormatted = formatAmountWithZeroClass(project.splaceno);
        const prodejeFormatted = formatAmountWithZeroClass(project.prodeje);
        const zbyvaFormatted = formatAmountWithZeroClass(project.zbyva_splatit);
        
        // Format yield percentage - show empty if zero
        const yieldPercentage = project.aktualni_vynos;
        const yieldDisplay = yieldPercentage === 0 ? '' : `${yieldPercentage.toFixed(2)}%`;
        const yieldClass = yieldPercentage > 0 ? 'amount-positive' : (yieldPercentage === 0 ? '' : 'amount-negative');
        
        return `
            <tr>
                <td>${project.projekt}</td>
                <td class="${investiceFormatted.className}">${investiceFormatted.formattedAmount}</td>
                <td class="${vynosyFormatted.className}">${vynosyFormatted.formattedAmount}</td>
                <td class="${splacenoFormatted.className}">${splacenoFormatted.formattedAmount}</td>
                <td class="${prodejeFormatted.className}">${prodejeFormatted.formattedAmount}</td>
                <td class="${zbyvaFormatted.className}">${zbyvaFormatted.formattedAmount}</td>
                <td class="${yieldClass}">${yieldDisplay}</td>
            </tr>
        `;
    }).join('');
    
    // Update sort indicators
    updateSortIndicators(projectTableSortField);
    
    // Update pagination
    updateProjectTablePagination();
}



// Track if event listeners are already attached
let projectTableSortingInitialized = false;

function setupProjectTableSorting() {
    // Only attach event listeners once
    if (projectTableSortingInitialized) {
        return;
    }
    
    const headers = document.querySelectorAll('#project-table th[data-sort]');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const sortField = header.dataset.sort;
            sortProjectTable(sortField);
        });
    });
    
    projectTableSortingInitialized = true;
}

let projectTableSortField = 'projekt';
let projectTableSortDirection = 'asc';

// Project table pagination state
let projectTablePagination = {
    currentPage: 1,
    itemsPerPage: 20
};
let allProjectData = [];

// Debounced sort function to prevent rapid clicking issues
const debouncedSortProjectTable = debounce(function(field) {
    // Toggle direction if same field
    if (projectTableSortField === field) {
        projectTableSortDirection = projectTableSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        projectTableSortField = field;
        // Default direction depends on field type
        projectTableSortDirection = field === 'projekt' ? 'asc' : 'desc';
    }
    
    // Update header indicators
    updateSortIndicators(field);
    
    // Reset to first page when sorting changes
    projectTablePagination.currentPage = 1;
    
    // Sort existing data instead of recalculating everything
    if (allProjectData.length > 0) {
        allProjectData = sortProjectData(allProjectData);
        updateProjectTable();
    }
}, 100);

function sortProjectTable(field) {
    debouncedSortProjectTable(field);
}

function updateSortIndicators(field) {
    // Update header indicators
    const headers = document.querySelectorAll('#project-table th[data-sort] i');
    headers.forEach(icon => {
        icon.className = 'fas fa-sort';
    });
    
    const currentHeader = document.querySelector(`#project-table th[data-sort="${field}"] i`);
    if (currentHeader) {
        currentHeader.className = projectTableSortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
    }
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
    if (!csvData || csvData.length === 0) {
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

    console.log('Creating time series chart with', csvData.length, 'transactions');
    
    // Group data by month and calculate net investment
    const monthlyData = {};
    
    csvData.forEach(row => {
        const monthKey = `${row.datum.getFullYear()}-${String(row.datum.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = 0;
        }
        
        // Calculate net value: Autoinvestice + Investice - Prodej - Vrácení peněz - Odstoupení - Splacení jistiny - Částečné splacení jistiny
        const amount = Math.abs(row.castka);
        switch (row.typ) {
            case 'Autoinvestice':
            case 'Investice':
                monthlyData[monthKey] += amount; // Add positive
                break;
            case 'Prodej':
            case 'Vrácení peněz':
            case 'Odstoupení':
            case 'Splacení jistiny':
            case 'Částečné splacení jistiny':
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
                borderColor: '#3B82F6',
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
                    if (!chartArea) {
                        return null;
                    }
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
                    gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.15)');
                    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.02)');
                    return gradient;
                },
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 8,
                pointHoverBorderWidth: 3,
                pointHoverBorderColor: '#FFFFFF',
                pointHoverBackgroundColor: '#3B82F6',
                pointBackgroundColor: 'transparent',
                pointBorderColor: 'transparent',
                borderCapStyle: 'round',
                borderJoinStyle: 'round'
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
                    enabled: true,
                    backgroundColor: 'rgba(31, 41, 55, 0.95)',
                    titleColor: '#FFFFFF',
                    bodyColor: '#E5E7EB',
                    borderColor: '#3B82F6',
                    borderWidth: 1,
                    cornerRadius: 12,
                    padding: 16,
                    displayColors: false,
                    titleFont: {
                        size: 14,
                        weight: '600',
                        family: 'Inter, system-ui, sans-serif'
                    },
                    bodyFont: {
                        size: 13,
                        weight: '500',
                        family: 'Inter, system-ui, sans-serif'
                    },
                    titleAlign: 'center',
                    bodyAlign: 'center',
                    caretSize: 8,
                    caretPadding: 10,
                    titleMarginBottom: 8,
                    position: 'nearest',
                    xAlign: 'center',
                    yAlign: 'top',
                    callbacks: {
                        title: function(context) {
                            const date = new Date(context[0].parsed.x);
                            return date.toLocaleDateString('cs-CZ', { 
                                year: 'numeric', 
                                month: 'long' 
                            });
                        },
                        label: function(context) {
                            return `Velikost portfolia: ${locale.formatNumber(context.parsed.y)}`;
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
                        text: 'Měsíc',
                        color: '#FFFFFF',
                        font: {
                            size: 12,
                            weight: '500',
                            family: 'Inter, system-ui, sans-serif'
                        },
                        padding: 12
                    },
                    ticks: {
                        color: '#9CA3AF',
                        font: {
                            size: 11,
                            family: 'Inter, system-ui, sans-serif'
                        },
                        maxTicksLimit: 8,
                        padding: 8
                    },
                    grid: {
                        color: 'rgba(156, 163, 175, 0.1)',
                        lineWidth: 1
                    },
                    border: {
                        color: 'rgba(156, 163, 175, 0.2)',
                        width: 1
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Čistá investice (Kč)',
                        color: '#FFFFFF',
                        font: {
                            size: 12,
                            weight: '500',
                            family: 'Inter, system-ui, sans-serif'
                        },
                        padding: 12
                    },
                    ticks: {
                        color: '#9CA3AF',
                        font: {
                            size: 11,
                            family: 'Inter, system-ui, sans-serif'
                        },
                        padding: 8,
                        callback: function(value) {
                            if (value === 0) return '0';
                            const thousands = value / 1000;
                            if (thousands >= 1000) {
                                return (thousands / 1000).toFixed(1).replace('.0', '') + ' mil.';
                            }
                            return Math.round(thousands) + ' tis.';
                        }
                    },
                    grid: {
                        color: 'rgba(156, 163, 175, 0.1)',
                        lineWidth: 1
                    },
                    border: {
                        color: 'rgba(156, 163, 175, 0.2)',
                        width: 1
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            hover: {
                animationDuration: 200
            },
            animation: {
                duration: 1500,
                easing: 'easeInOutCubic',
                delay: (context) => {
                    return context.dataIndex * 50; // Stagger animation
                }
            },
            elements: {
                line: {
                    borderCapStyle: 'round'
                },
                point: {
                    hoverRadius: 8
                }
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
    
    // Calculate net investment by project type using the specified formula:
    // Autoinvestice + Investice - Prodej - Částečné splacení jistiny - Odstoupení - Vrácení peněz
    const projectTypeData = {};
    
    csvData.forEach(row => {
        if (!row.typ_projektu) return;
        
        if (!projectTypeData[row.typ_projektu]) {
            projectTypeData[row.typ_projektu] = 0;
        }
        
        const amount = row.castka;
        const type = row.typ;
        
        // Apply the formula based on transaction type
        if (type === 'Autoinvestice' || type === 'Investice') {
            projectTypeData[row.typ_projektu] += Math.abs(amount);
        } else if (type === 'Prodej' || type === 'Částečné splacení jistiny' || 
                   type === 'Odstoupení' || type === 'Vrácení peněz') {
            projectTypeData[row.typ_projektu] -= Math.abs(amount);
        }
        // Other transaction types are ignored in this calculation
    });
    
    // Filter out project types with zero or negative values
    const validProjectTypes = Object.entries(projectTypeData)
        .filter(([, value]) => value > 0)
        .sort(([, a], [, b]) => b - a);
    
    if (validProjectTypes.length === 0) {
        // Show empty state
        ctx.canvas.parentElement.innerHTML = createChartEmptyState(
            'fas fa-chart-pie',
            'Žádná data pro zobrazení',
            'Nebyly nalezeny žádné projekty s daty pro graf'
        );
        return;
    }
    
    // Check if only Crowdfunding projects exist (100%)
    if (validProjectTypes.length === 1 && 
        (validProjectTypes[0][0].toLowerCase() === 'crowdfunding' || 
         validProjectTypes[0][0].toLowerCase() === 'cf')) {
        // Show Crowdfunding empty state
        ctx.canvas.parentElement.innerHTML = createChartEmptyState(
            'fas fa-users',
            'Všechny vaše projekty jsou typu Crowdfunding',
            ''
        );
        return;
    }
    
    const projectTypes = validProjectTypes.map(([type]) => type);
    const chartData = validProjectTypes.map(([, value]) => value);
    
    // Enhanced color palette with better contrast and visual appeal
    const colors = [
        '#3B82F6', // Blue
        '#10B981', // Emerald
        '#F59E0B', // Amber
        '#EF4444', // Red
        '#8B5CF6', // Violet
        '#06B6D4', // Cyan
        '#84CC16', // Lime
        '#F97316', // Orange
        '#EC4899', // Pink
        '#14B8A6', // Teal
        '#6366F1', // Indigo
        '#22C55E'  // Green
    ];
    
    // Calculate total for percentage display
    const total = chartData.reduce((a, b) => a + b, 0);
    
    charts.projectType = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: projectTypes,
            datasets: [{
                data: chartData,
                backgroundColor: colors.slice(0, projectTypes.length),
                borderWidth: 3,
                borderColor: '#1F2937',
                hoverBorderWidth: 4,
                hoverBorderColor: '#FFFFFF',
                hoverBackgroundColor: colors.slice(0, projectTypes.length).map(color => color + 'E6'), // Add transparency on hover
                borderRadius: 2,
                offset: 8 // Creates gap between segments
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%', // Makes the doughnut thinner for better appearance
            plugins: {
                legend: {
                    position: 'bottom',
                    align: 'center',
                    labels: {
                        padding: 25,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: {
                            size: 13,
                            weight: '500',
                            family: 'Inter, system-ui, sans-serif'
                        },
                        color: '#FFFFFF',
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    // Replace "legacy" with "participace"
                                    const displayLabel = label.toLowerCase() === 'legacy' ? 'participace' : label;
                                    return {
                                        text: `${displayLabel} (${percentage}%)`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        strokeStyle: data.datasets[0].borderColor,
                                        lineWidth: data.datasets[0].borderWidth,
                                        pointStyle: 'circle',
                                        fontColor: '#FFFFFF', // Explicit font color for each legend item
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(31, 41, 55, 0.95)',
                    titleColor: '#FFFFFF',
                    bodyColor: '#E5E7EB',
                    borderColor: '#374151',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    displayColors: true,
                    titleFont: {
                        size: 14,
                        weight: '600'
                    },
                    bodyFont: {
                        size: 13,
                        weight: '500'
                    },
                    callbacks: {
                        title: function(context) {
                            const label = context[0].label;
                            return label.toLowerCase() === 'legacy' ? 'participace' : label;
                        },
                        label: function(context) {
                            const value = context.parsed;
                            const percentage = ((value / total) * 100).toFixed(1);
                            return [
                                `Částka: ${locale.formatNumber(value)}`,
                                `Podíl: ${percentage}%`
                            ];
                        }
                    }
                }
            },
            animation: {
                duration: 1200,
                easing: 'easeInOutCubic',
                animateRotate: true,
                animateScale: true
            },
            hover: {
                animationDuration: 300
            },
            interaction: {
                intersect: false,
                mode: 'nearest'
            },
            elements: {
                arc: {
                    borderAlign: 'center'
                }
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
    
    // Calculate net investment by project using the specified formula:
    // Investice + Autoinvestice - Prodej - Vrácení peněz - Odstoupení - Částečné splacení jistiny
    const projectTotals = {};
    
    csvData.forEach(row => {
        if (!row.projekt) return;
        
            if (!projectTotals[row.projekt]) {
                projectTotals[row.projekt] = 0;
            }
        
        const amount = Math.abs(row.castka);
        const type = row.typ;
        
        // Apply the formula based on transaction type
        if (type === 'Autoinvestice' || type === 'Investice') {
            projectTotals[row.projekt] += amount;
        } else if (type === 'Prodej' || type === 'Částečné splacení jistiny' || 
                   type === 'Vrácení peněz' || type === 'Odstoupení') {
            projectTotals[row.projekt] -= amount;
        }
        // Other transaction types are ignored in this calculation
    });
    
    // Filter out projects with zero or negative values and sort by value
    const validProjects = Object.entries(projectTotals)
        .filter(([, value]) => value > 0)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8);
    
    if (validProjects.length === 0) {
        // Show empty state
        ctx.canvas.parentElement.innerHTML = createChartEmptyState(
            'fas fa-chart-bar',
            'Žádná data pro zobrazení',
            'Nebyly nalezeny žádné projekty s kladnou čistou investicí'
        );
        return;
    }
    
    // Store full project names for tooltips
    const fullProjectNames = validProjects.map(([name]) => name);
    const truncatedLabels = validProjects.map(([name]) => name.length > 14 ? name.substring(0, 14) + '...' : name);
    
    charts.topProjects = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: truncatedLabels,
            datasets: [{
                label: 'Čistá investice',
                data: validProjects.map(([, amount]) => amount),
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
                    if (!chartArea) {
                        return '#3B82F6';
                    }
                    const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
                    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
                    gradient.addColorStop(0.7, 'rgba(59, 130, 246, 0.9)');
                    gradient.addColorStop(1, 'rgba(29, 78, 216, 1)');
                    return gradient;
                },
                borderColor: '#1E40AF',
                borderWidth: 0,
                borderRadius: 6,
                borderSkipped: false,
                hoverBackgroundColor: (context) => {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
                    if (!chartArea) {
                        return '#60A5FA';
                    }
                    const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
                    gradient.addColorStop(0, 'rgba(96, 165, 250, 0.9)');
                    gradient.addColorStop(0.7, 'rgba(59, 130, 246, 1)');
                    gradient.addColorStop(1, 'rgba(29, 78, 216, 1)');
                    return gradient;
                },
                hoverBorderColor: '#1D4ED8',
                hoverBorderWidth: 2
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 10,
                    right: 20,
                    top: 10,
                    bottom: 10
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(31, 41, 55, 0.95)',
                    titleColor: '#FFFFFF',
                    bodyColor: '#E5E7EB',
                    borderColor: '#3B82F6',
                    borderWidth: 1,
                    cornerRadius: 12,
                    padding: 16,
                    displayColors: false,
                    titleFont: {
                        size: 14,
                        weight: '600',
                        family: 'Inter, system-ui, sans-serif'
                    },
                    bodyFont: {
                        size: 13,
                        weight: '500',
                        family: 'Inter, system-ui, sans-serif'
                    },
                    titleAlign: 'center',
                    bodyAlign: 'center',
                    caretSize: 8,
                    caretPadding: 10,
                    titleMarginBottom: 8,
                    callbacks: {
                        title: function(context) {
                            // Use the stored full project names array to ensure correct mapping
                            const dataIndex = context[0].dataIndex;
                            return fullProjectNames[dataIndex];
                        },
                        label: function(context) {
                            const value = context.parsed.x;
                            return `Expozice: ${locale.formatNumber(value)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Čistá investice',
                        color: '#FFFFFF',
                        font: {
                            size: 12,
                            weight: '500',
                            family: 'Inter, system-ui, sans-serif'
                        },
                        padding: 12
                    },
                    ticks: {
                        color: '#9CA3AF',
                        font: {
                            size: 11,
                            family: 'Inter, system-ui, sans-serif'
                        },
                        padding: 8,
                        callback: function(value) {
                            if (value === 0) return '0';
                            const thousands = value / 1000;
                            if (thousands >= 1000) {
                                return (thousands / 1000).toFixed(1).replace('.0', '') + ' mil.';
                            }
                            return Math.round(thousands) + ' tis.';
                        }
                    },
                    grid: {
                        color: 'rgba(156, 163, 175, 0.1)',
                        lineWidth: 1
                    },
                    border: {
                        color: 'rgba(156, 163, 175, 0.2)',
                        width: 1
                    }
                },
                y: {
                    ticks: {
                        color: '#FFFFFF',
                        font: {
                            size: 11,
                            weight: '500',
                            family: 'Inter, system-ui, sans-serif'
                        },
                        padding: 12,
                        callback: function(value, index) {
                            const label = this.getLabelForValue(value);
                            return label.length > 14 ? label.substring(0, 14) + '...' : label;
                        }
                    },
                    grid: {
                        color: 'rgba(156, 163, 175, 0.05)',
                        lineWidth: 1
                    },
                    border: {
                        color: 'rgba(156, 163, 175, 0.2)',
                        width: 1
                    }
                }
            },
            interaction: {
                intersect: true,
                mode: 'nearest'
            },
            hover: {
                animationDuration: 200
            },
            animation: {
                duration: 1500,
                easing: 'easeInOutCubic',
                delay: (context) => {
                    return context.dataIndex * 100; // Stagger animation for each bar
                }
            },
            elements: {
                bar: {
                    borderRadius: 6
                }
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
    
    // Calculate portfolio exposure by project using the specified formula:
    // Investice + Autoinvestice - Prodej - Vrácení peněz - Odstoupení - Částečné splacení jistiny
    const projectExposure = {};
    
    csvData.forEach(row => {
        if (!row.projekt) return;
        
        if (!projectExposure[row.projekt]) {
            projectExposure[row.projekt] = 0;
        }
        
        const amount = Math.abs(row.castka);
        const type = row.typ;
        
        // Apply the formula based on transaction type
        if (type === 'Autoinvestice' || type === 'Investice') {
            projectExposure[row.projekt] += amount;
        } else if (type === 'Prodej' || type === 'Částečné splacení jistiny' || 
                   type === 'Vrácení peněz' || type === 'Odstoupení') {
            projectExposure[row.projekt] -= amount;
        }
        // Other transaction types are ignored in this calculation
    });
    
    console.log('Project exposure calculations:', projectExposure);
    
    // Filter out projects with zero or negative exposure and sort by exposure
    const validProjects = Object.entries(projectExposure)
        .filter(([, exposure]) => exposure > 0)
        .sort(([,a], [,b]) => b - a);
    
    if (validProjects.length === 0) {
        // Show empty state
        canvas.parentElement.innerHTML = createChartEmptyState(
            'fas fa-chart-pie',
            'Žádná aktivní expozice portfolia',
            'Nebyly nalezeny žádné projekty s aktivní expozicí'
        );
        return;
    }
    
    // Enhanced color palette with emerald/teal theme for portfolio exposure
    const colors = [
        '#10B981', // Emerald
        '#06B6D4', // Cyan
        '#14B8A6', // Teal
        '#22C55E', // Green
        '#3B82F6', // Blue
        '#8B5CF6', // Violet
        '#F59E0B', // Amber
        '#EF4444', // Red
        '#84CC16', // Lime
        '#F97316', // Orange
        '#EC4899', // Pink
        '#6366F1', // Indigo
        '#059669', // Emerald dark
        '#0891B2', // Cyan dark
        '#0D9488'  // Teal dark
    ];
    
    // Calculate total for percentage display
    const total = validProjects.reduce((sum, [, exposure]) => sum + exposure, 0);
    
    // Plugin to display project count in the center
    const centerTextPlugin = {
        id: 'centerText',
        beforeDraw: function(chart) {
            const ctx = chart.ctx;
            const centerX = chart.chartArea.left + (chart.chartArea.right - chart.chartArea.left) / 2;
            const centerY = chart.chartArea.top + (chart.chartArea.bottom - chart.chartArea.top) / 2;
            
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Draw the main number
            ctx.font = 'bold 32px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(validProjects.length.toString(), centerX, centerY - 8);
            
            // Draw the label
            ctx.font = '500 14px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#94A3B8';
            ctx.fillText('projektů', centerX, centerY + 18);
            
            ctx.restore();
        }
    };

    // Prepare labels and data arrays to ensure proper synchronization
    const projectLabels = validProjects.map(([name]) => name);
    const projectData = validProjects.map(([, exposure]) => exposure);
    
    charts.portfolioExposure = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: projectLabels,
            datasets: [{
                data: projectData,
                backgroundColor: colors.slice(0, validProjects.length),
                borderWidth: 3,
                borderColor: '#1F2937',
                hoverBorderWidth: 4,
                hoverBorderColor: '#FFFFFF',
                hoverBackgroundColor: colors.slice(0, validProjects.length).map(color => color + 'E6'), // Add transparency on hover
                borderRadius: 2,
                offset: 6 // Creates gap between segments
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%', // Slightly thicker than project type chart
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(31, 41, 55, 0.95)',
                    titleColor: '#FFFFFF',
                    bodyColor: '#E5E7EB',
                    borderColor: '#374151',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    displayColors: true,
                    titleFont: {
                        size: 14,
                        weight: '600'
                    },
                    bodyFont: {
                        size: 13,
                        weight: '500'
                    },
                    position: 'nearest',
                    xAlign: 'center',
                    yAlign: 'bottom',
                    callbacks: {
                        title: function(context) {
                            // Always use the label from the chart data which corresponds to the correct project name
                            return context[0].label;
                        },
                        label: function(context) {
                            const value = context.parsed;
                            const percentage = ((value / total) * 100).toFixed(1);
                            return [
                                `Expozice: ${locale.formatNumber(value)}`,
                                `Podíl: ${percentage}%`
                            ];
                        }
                    }
                }
            },
            animation: {
                duration: 1300,
                easing: 'easeInOutCubic',
                animateRotate: true,
                animateScale: true
            },
            hover: {
                animationDuration: 300
            },
            interaction: {
                intersect: true,
                mode: 'point'
            },
            elements: {
                arc: {
                    borderAlign: 'center'
                }
            }
        },
        plugins: [centerTextPlugin]
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
    
    tbody.innerHTML = paginatedData.map(row => {
        // Determine amount CSS class based on transaction type and amount
        let amountClass = row.castka >= 0 ? 'amount-positive' : 'amount-negative';
        if (row.typ === 'Investice' || row.typ === 'Autoinvestice') {
            amountClass = 'amount-investment';
        }
        
        return `
        <tr>
            <td>${locale.formatDate(row.datum)}</td>
            <td>${row.typ}</td>
            <td title="${row.detail}">${row.detail.length > 50 ? row.detail.substring(0, 50) + '...' : row.detail}</td>
            <td class="${amountClass}">${locale.formatNumber(row.castka)}</td>
            <td title="${row.projekt}">${row.projekt.length > 30 ? row.projekt.substring(0, 30) + '...' : row.projekt}</td>
            <td>${formatProjectType(row.typ_projektu)}</td>
        </tr>
        `;
    }).join('');
    
    updatePagination();
}

function formatProjectType(type) {
    if (!type) return '';
    const lowerType = type.toLowerCase();
    if (lowerType === 'crowdfunding') return 'CF';
    if (lowerType === 'legacy') return 'LC';
    return type; // Return original if not recognized
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
    const stats = calculateAdvancedStatistics(csvData);
    
    setStatValueWithZeroClass('monthly-rate', stats.monthlyRate);
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
function formatAmountWithZeroClass(amount) {
    const formattedAmount = locale.formatNumber(amount);
    const className = Math.abs(amount) < 0.01 ? 'amount-zero' : 
                     (amount >= 0 ? 'amount-positive' : 'amount-negative');
    return { formattedAmount, className };
}

function setStatValueWithZeroClass(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = locale.formatNumber(value);
        // Add or remove zero class
        if (Math.abs(value) < 0.01) {
            element.classList.add('zero');
        } else {
            element.classList.remove('zero');
        }
    }
}

function createChartEmptyState(iconClass, title, message) {
    return `
        <div class="chart-empty-modern">
            <div class="empty-icon-modern">
                <i class="${iconClass}"></i>
            </div>
            <h3 class="empty-title-modern">${title}</h3>
            ${message ? `<p class="empty-message-modern">${message}</p>` : ''}
        </div>
    `;
}

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

// Header scroll behavior
function setupHeaderScrollBehavior() {
    let lastScrollTop = 0;
    let scrollThreshold = 10; // Minimum scroll distance to trigger hide/show
    let isHeaderHidden = false;
    
    const header = document.querySelector('.dashboard-header');
    
    if (!header) return; // Exit if header doesn't exist
    
    const handleScroll = debounce(() => {
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Don't hide header when at the top of the page
        if (currentScrollTop <= scrollThreshold) {
            if (isHeaderHidden) {
                header.classList.remove('header-hidden');
                isHeaderHidden = false;
            }
            lastScrollTop = currentScrollTop;
            return;
        }
        
        // Check scroll direction and distance
        const scrollDifference = Math.abs(currentScrollTop - lastScrollTop);
        
        if (scrollDifference > scrollThreshold) {
            if (currentScrollTop > lastScrollTop && !isHeaderHidden) {
                // Scrolling down - hide header
                header.classList.add('header-hidden');
                isHeaderHidden = true;
            } else if (currentScrollTop < lastScrollTop && isHeaderHidden) {
                // Scrolling up - show header
                header.classList.remove('header-hidden');
                isHeaderHidden = false;
            }
            lastScrollTop = currentScrollTop;
        }
    }, 50); // Debounce scroll events for better performance
    
    window.addEventListener('scroll', handleScroll);
} 