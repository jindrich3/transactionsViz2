// Global Variables
let csvData = [];
let filteredData = [];
let charts = {};
let selectedFile = null;
let overviewStats = {};

// Global color palette for charts
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
        itemsPerPage: 10
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
    
    // About project modal functionality
    document.getElementById('about-project-btn').addEventListener('click', openAboutProjectModal);
    document.getElementById('close-about-project-modal').addEventListener('click', closeAboutProjectModal);
    document.getElementById('about-project-modal').addEventListener('click', handleAboutModalOverlayClick);
    
    // Filter modal functionality  
    document.getElementById('filters-btn').addEventListener('click', openFilterModal);
    document.getElementById('close-filter-modal').addEventListener('click', closeFilterModal);
    document.getElementById('filter-modal-overlay').addEventListener('click', handleModalOverlayClick);
    document.getElementById('clear-filters').addEventListener('click', clearAllFilters);
    document.getElementById('apply-filters').addEventListener('click', applyFiltersAndClose);
    
    // Timeline filter event listeners
    document.getElementById('close-timeline-filter-modal').addEventListener('click', closeTimelineFilterModal);
    document.getElementById('timeline-filter-modal-overlay').addEventListener('click', handleTimelineModalOverlayClick);
    document.getElementById('apply-timeline-filters').addEventListener('click', applyTimelineFilters);
    document.getElementById('clear-timeline-filters').addEventListener('click', clearTimelineFilters);
    
    // Date presets (works in modal)
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => setDatePreset(e.target.dataset.days));
    });
    
    // Table functionality
    document.querySelectorAll('[data-sort]').forEach(th => {
        th.addEventListener('click', (e) => {
            const table = th.closest('table');
            if (table.id === 'monthly-table') {
                handleMonthlyTableSort(e.target.dataset.sort);
            } else if (table.id === 'project-table') {
                sortProjectTable(e.target.dataset.sort);
            } else {
                handleTableSort(e.target.dataset.sort);
            }
        });
    });
    
    document.getElementById('export-btn').addEventListener('click', exportToCSV);
    
    // Rows per page dropdowns
    document.getElementById('table-rows-select').addEventListener('change', handleMainTableRowsChange);
    document.getElementById('project-table-rows-select').addEventListener('change', handleProjectTableRowsChange);
    document.getElementById('monthly-table-rows-select').addEventListener('change', handleMonthlyTableRowsChange);
    
    // Demo transactions button
    document.getElementById('demo-transactions-btn').addEventListener('click', loadDemoTransactions);
    
    // Period toggle buttons
    document.querySelectorAll('.period-toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mode = e.target.dataset.period;
            switchPeriodMode(mode);
        });
    });
    
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
                    typ: cleanRow.typ,
                    detail: cleanRow.detail,
                    projekt: cleanRow.projekt,
                    typ_projektu: cleanRow.typ_projektu
                });
                console.log('Original row data:', Object.keys(row).map(key => `${key}: "${row[key]}"`).join(', '));
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
    
    // Force body overflow to be scrollable (fix for responsive mode scrolling)
    document.body.style.overflow = 'auto !important';
    document.body.style.overflowY = 'auto !important';
    document.body.style.overflowX = 'hidden !important';
    document.documentElement.style.overflow = 'auto !important';
    document.documentElement.style.overflowY = 'auto !important';
    document.documentElement.style.overflowX = 'hidden !important';
    
    // Remove any classes that might affect scrolling
    document.body.classList.remove('no-scroll');
    document.documentElement.classList.remove('no-scroll');
    
    // Reset scroll position to top
    window.scrollTo(0, 0);
    
    // Force a reflow to ensure styles are applied
    document.body.offsetHeight;
    
    // Force hide all modals to prevent wheel event blocking
    const filterModal = document.getElementById('filter-modal-overlay');
    const detailsModal = document.getElementById('transaction-details-modal');
    if (filterModal) {
        filterModal.style.display = 'none';
        filterModal.classList.remove('show');
    }
    if (detailsModal) {
        detailsModal.style.display = 'none';
        detailsModal.classList.remove('show');
    }
}

function resetToLanding() {
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('landing-page').style.display = 'block';
    
    // Reset scroll position to top
    window.scrollTo(0, 0);
    
    // Reset body overflow for landing page
    document.body.style.overflow = '';
    document.body.style.overflowY = '';
    document.body.style.overflowX = '';
    document.documentElement.style.overflow = '';
    document.documentElement.style.overflowY = '';
    document.documentElement.style.overflowX = '';
    
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
    console.log('initializeDashboard called with', csvData.length, 'transactions');
    
    try {
    // Set filteredData to show all data initially (no filters)
    filteredData = [...csvData];
    
    // Update transaction count in header
        const transactionCountEl = document.getElementById('transaction-count');
        if (transactionCountEl) {
            transactionCountEl.textContent = csvData.length;
        }
    
        // Call functions with error handling
        try {
    calculateOverviewStatistics();
        } catch (e) {
            console.error('Error in calculateOverviewStatistics:', e);
        }
        
        try {
    updateStatistics();
        } catch (e) {
            console.error('Error in updateStatistics:', e);
        }
        
        try {
            updateFeeBreakdown();
        updateNetProfitBreakdown();
        updateMarketingRewardsBreakdown();
        updateCurrentMonthPayoutsBreakdown();
    } catch (e) {
        console.error('Error in breakdown updates:', e);
        }
        
        try {
    createFilterOptions();
        } catch (e) {
            console.error('Error in createFilterOptions:', e);
        }
        
        try {
    createCharts();
        } catch (e) {
            console.error('Error in createCharts:', e);
        }
        
        try {
    createMonthlyTable();
        } catch (e) {
            console.error('Error in createMonthlyTable:', e);
        }
        
        try {
    updateTable();
        } catch (e) {
            console.error('Error in updateTable:', e);
        }
        
        try {
    updateAdvancedStatistics();
        } catch (e) {
            console.error('Error in updateAdvancedStatistics:', e);
        }
        
        // Initialize timeline filters with defaults
        initializeTimelineFiltersDefault();
        
        // FORCE timeline creation
        console.log('About to call createTimeline...');
        try {
            createTimeline();
        } catch (e) {
            console.error('Error in createTimeline:', e);
        }
    
    // Initialize button state (should be disabled initially)
        try {
    updateClearFiltersButton();
        } catch (e) {
            console.error('Error in updateClearFiltersButton:', e);
        }
    
    // Set "Vše" preset as active by default
        try {
    setDefaultPresetButton();
        } catch (e) {
            console.error('Error in setDefaultPresetButton:', e);
        }
        
    } catch (error) {
        console.error('Critical error in initializeDashboard:', error);
    }
}

// Overview Statistics (Fixed - not affected by filters)
function calculateOverviewStatistics() {
    overviewStats = calculateStatistics(csvData);
    
    // Calculate date range and find oldest/newest transactions
    if (csvData && csvData.length > 0) {
    const sortedTransactions = csvData.slice().sort((a, b) => a.datum - b.datum);
    const oldestTransaction = sortedTransactions[0];
    const newestTransaction = sortedTransactions[sortedTransactions.length - 1];
    
    overviewStats.oldestDate = oldestTransaction.datum;
    overviewStats.newestDate = newestTransaction.datum;
    overviewStats.oldestAmount = Math.abs(oldestTransaction.castka);
    overviewStats.newestAmount = Math.abs(newestTransaction.castka);
        
        // Store full transaction objects for tooltips
        overviewStats.oldestTransaction = oldestTransaction;
        overviewStats.newestTransaction = newestTransaction;
    } else {
        // Handle case when no data is available
        overviewStats.oldestDate = null;
        overviewStats.newestDate = null;
        overviewStats.oldestAmount = 0;
        overviewStats.newestAmount = 0;
    }
    
    // Calculate marketing rewards
    const marketingRewards = csvData.filter(row => row.typ === 'Odměna')
        .reduce((sum, row) => sum + Math.abs(row.castka), 0);
    
    // Update fixed overview display with zero value styling
    setStatValueWithZeroClass('total-investment', overviewStats.totalInvestment);
    
    // Handle blocked on market display - show only if value is not 0
    const blockedElement = document.getElementById('blocked-on-market');
    if (blockedElement && overviewStats.blockedOnMarket !== 0) {
        blockedElement.textContent = `Z toho blok. na tržišti: ${formatAmountWithOptionalDecimals(overviewStats.blockedOnMarket).formattedAmount}`;
        blockedElement.style.display = 'block';
    } else if (blockedElement) {
        blockedElement.style.display = 'none';
    }
    
    setStatValueWithZeroClass('total-profits', overviewStats.totalProfits);
    
    // Handle marketing rewards display - show only if value is not 0
    const marketingRewardsElement = document.getElementById('total-marketing-rewards');
    if (marketingRewardsElement && overviewStats.totalMarketingRewards !== 0) {
        marketingRewardsElement.textContent = `Navíc market. odměny: ${formatAmountWithOptionalDecimals(overviewStats.totalMarketingRewards).formattedAmount}`;
        marketingRewardsElement.style.display = 'block';
    } else if (marketingRewardsElement) {
        marketingRewardsElement.style.display = 'none';
    }
    setStatValueWithZeroClass('total-deposits', overviewStats.totalDeposits);
    setStatValueWithZeroClass('total-withdrawals', overviewStats.totalWithdrawals);
    setStatValueWithZeroClass('largest-investment', overviewStats.largestInvestment);
    setStatValueWithZeroClass('average-investment', overviewStats.averageInvestment);
    setStatValueWithZeroClass('oldest-transaction-amount', overviewStats.oldestAmount);
    setStatValueWithZeroClass('newest-transaction-amount', overviewStats.newestAmount);
    setStatValueWithZeroClass('total-fees', overviewStats.totalFees);
    setStatValueWithZeroClass('wallet-balance', overviewStats.walletBalance);
    
    // Handle percentage display for gross current yield
    const grossYieldElement = document.getElementById('gross-current-yield');
    if (grossYieldElement) {
    if (overviewStats.grossCurrentYield === 0) {
        grossYieldElement.textContent = '0%';
        grossYieldElement.classList.add('amount-zero');
    } else {
        grossYieldElement.textContent = `${overviewStats.grossCurrentYield.toFixed(2)}%`;
        grossYieldElement.classList.remove('amount-zero');
    }
    }
    
    // Calculate and display 12-month TWRR
    const twrr12Months = calculate12MonthTWRR();
    const twrrElement = document.getElementById('twrr-12-months');
    if (twrrElement) {
        if (twrr12Months === 0) {
            twrrElement.textContent = '0%';
            twrrElement.classList.add('amount-zero');
        } else {
            twrrElement.textContent = `${twrr12Months.toFixed(2)}%`;
            twrrElement.classList.remove('amount-zero');
        }
    }
    
    // Check if there are any marketing reward transactions
    const hasMarketingRewards = csvData && csvData.some(row => 
        row.typ === 'Odměna' || row.typ === 'Mimořádný příjem'
    );
    
    // Show/hide the "Bez market. odměn:" row based on presence of marketing rewards
    const twrrNoMarketingSubvalue = document.getElementById('twrr-no-marketing-row');
    if (twrrNoMarketingSubvalue) {
        if (hasMarketingRewards) {
            twrrNoMarketingSubvalue.style.display = 'block';
            
            // Calculate and display 12-month TWRR without marketing rewards
            const twrr12MonthsNoMarketing = calculate12MonthTWRRNoMarketing();
            const twrrNoMarketingElement = document.getElementById('twrr-12-months-no-marketing');
            if (twrrNoMarketingElement) {
                if (twrr12MonthsNoMarketing === 0) {
                    twrrNoMarketingElement.textContent = '0%';
                    twrrNoMarketingElement.classList.add('amount-zero');
                } else {
                    twrrNoMarketingElement.textContent = `${twrr12MonthsNoMarketing.toFixed(2)}%`;
                    twrrNoMarketingElement.classList.remove('amount-zero');
                }
            }
        } else {
            twrrNoMarketingSubvalue.style.display = 'none';
        }
    }
    
    // These don't need zero styling (counts/dates) - add null checks
    const transactionCountElement = document.getElementById('transaction-count-stat');
    if (transactionCountElement) {
        transactionCountElement.textContent = overviewStats.totalTransactions;
    }
    
    const portfolioStagesElement = document.getElementById('portfolio-stages');
    if (portfolioStagesElement) {
        portfolioStagesElement.innerHTML = `${overviewStats.portfolioStages.active} <span style="color: rgba(255, 255, 255, 0.6); font-size: 0.8em;"> / ${overviewStats.portfolioStages.total}</span>`;
    }
    
    const dateRangeStartElement = document.getElementById('date-range-start');
    if (dateRangeStartElement) {
        dateRangeStartElement.textContent = overviewStats.oldestDate ? locale.formatDate(overviewStats.oldestDate) : '--';
    }
    
    const dateRangeEndElement = document.getElementById('date-range-end');
    if (dateRangeEndElement) {
        dateRangeEndElement.textContent = overviewStats.newestDate ? locale.formatDate(overviewStats.newestDate) : '--';
    }
    
    // Calculate and display autoinvest statistics
    calculateAutoinvestStatistics();
    
    // Update welcome message
    updateWelcomeMessage();
    
    // Setup transaction tooltips
    setupTransactionTooltips();
    
    // Setup current month breakdown listeners
    setupCurrentMonthBreakdownListeners();
}

// Update welcome message based on investment duration
function updateWelcomeMessage() {
    const welcomeMessageElement = document.getElementById('welcome-message');
    const welcomeTextElement = document.getElementById('welcome-text');
    
    if (!overviewStats.oldestDate || !welcomeMessageElement || !welcomeTextElement) {
        return;
    }
    
    // Calculate duration from oldest transaction to now
    const currentDate = new Date();
    const oldestDate = overviewStats.oldestDate;
    const timeDiff = currentDate - oldestDate;
    const totalDays = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    
    let durationText = '';
    
    if (totalDays < 90) {
        // Less than 90 days: show in days
        durationText = `${totalDays} ${getDayPlural(totalDays)}`;
    } else if (totalDays < (24 * 30)) {
        // Less than 24 months: show in months
        const months = Math.floor(totalDays / 30);
        durationText = `${months} ${getMonthPlural(months)}`;
    } else {
        // 24+ months: show in years
        const years = Math.floor(totalDays / 365);
        durationText = `${years} ${getYearPlural(years)}`;
    }
    
            welcomeTextElement.textContent = `Na platformě Investown jste již ${durationText}. 💪`;
    welcomeMessageElement.style.display = 'block';
}

// Setup tooltips for transaction stat boxes
function setupTransactionTooltips() {
    // Remove existing event listeners to avoid duplicates
    const transactionElements = document.querySelectorAll('.transaction-tooltip');
    
    transactionElements.forEach(element => {
        // Clone element to remove all event listeners
        const newElement = element.cloneNode(true);
        element.parentNode.replaceChild(newElement, element);
    });
    
    // Setup tooltips for oldest and newest transactions
    const oldestElement = document.getElementById('date-range-start');
    const newestElement = document.getElementById('date-range-end');
    const largestInvestmentElement = document.getElementById('largest-investment');
    const firstAutoinvestElement = document.getElementById('autoinvest-first-date');
    const lastAutoinvestElement = document.getElementById('autoinvest-last-date');
    
    if (oldestElement && overviewStats.oldestTransaction) {
        addTransactionStatTooltip(oldestElement, overviewStats.oldestTransaction);
    }
    
    if (newestElement && overviewStats.newestTransaction) {
        addTransactionStatTooltip(newestElement, overviewStats.newestTransaction);
    }
    
    if (largestInvestmentElement && overviewStats.largestInvestmentTransaction) {
        addTransactionStatTooltip(largestInvestmentElement, overviewStats.largestInvestmentTransaction);
    }
    
    if (firstAutoinvestElement && overviewStats.firstAutoinvestTransaction) {
        addTransactionStatTooltip(firstAutoinvestElement, overviewStats.firstAutoinvestTransaction);
    }
    
    if (lastAutoinvestElement && overviewStats.lastAutoinvestTransaction) {
        addTransactionStatTooltip(lastAutoinvestElement, overviewStats.lastAutoinvestTransaction);
    }
}

// Helper functions for Czech pluralization
function getDayPlural(count) {
    if (count === 1) return 'den';
    if (count >= 2 && count <= 4) return 'dny';
    return 'dní';
}

function getMonthPlural(count) {
    if (count === 1) return 'měsíc';
    if (count >= 2 && count <= 4) return 'měsíce';
    return 'měsíců';
}

function getYearPlural(count) {
    if (count === 1) return 'rok';
    if (count >= 2 && count <= 4) return 'roky';
    return 'let';
}

function calculate12MonthTWRR() {
    if (!csvData || csvData.length === 0) {
        return 0;
    }
    
    // Get current date and 12 months ago
    const currentDate = new Date();
    const twelveMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 12, 1);
    
    // Group data by month for the last 12 months
    const monthlyData = {};
    const monthlyProfit = {};
    
    csvData.forEach((row, index) => {
        if (row.datum >= twelveMonthsAgo) {
            const monthKey = `${row.datum.getFullYear()}-${String(row.datum.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = 0;
            }
            if (!monthlyProfit[monthKey]) {
                monthlyProfit[monthKey] = 0;
            }
            
            const amount = Math.abs(row.castka);
            
            // Calculate net investment (capital movements)
            switch (row.typ) {
                case 'Autoinvestice':
                case 'Investice':
                    monthlyData[monthKey] += amount;
                    break;
                case 'Prodej':
                case 'Vrácení peněz':
                case 'Odstoupení':
                case 'Splacení jistiny':
                case 'Částečné splacení jistiny':
                    monthlyData[monthKey] -= amount;
                    break;
            }
            
            // Calculate profit (performance)
            switch (row.typ) {
                case 'Výnos':
                case 'Bonusový výnos':
                case 'Smluvní pokuta':
                case 'Zákonné úroky z prodlení':
                case 'Odměna':
                case 'Mimořádný příjem':
                    monthlyProfit[monthKey] += amount;
                    break;
                case 'Poplatek za předčasný prodej':
                case 'Poplatek za výběr':
                    monthlyProfit[monthKey] -= amount;
                    break;
            }
        }
    });
    
    // Get months in chronological order
    const allMonths = [...new Set([...Object.keys(monthlyData), ...Object.keys(monthlyProfit)])].sort();
    
    // Calculate CAPITAL BASE (investments only) at the start of 12-month period
    let capitalBaseAtStart = 0;
    
    csvData.forEach(row => {
        if (row.datum < twelveMonthsAgo) {
            const amount = Math.abs(row.castka);
            
            // Calculate net capital investment before the 12-month period (NO PROFITS)
            switch (row.typ) {
                case 'Autoinvestice':
                case 'Investice':
                    capitalBaseAtStart += amount;
                    break;
                case 'Prodej':
                case 'Vrácení peněz':
                case 'Odstoupení':
                case 'Splacení jistiny':
                case 'Částečné splacení jistiny':
                    capitalBaseAtStart -= amount;
                    break;
            }
            // NOTE: We DO NOT include profits in the capital base calculation
            // Profits are performance results, not capital movements
        }
    });
    
    // Track running capital base (investments only, no profits)
    let runningCapitalBase = capitalBaseAtStart;
    let compoundedReturn = 1; // Start with 1 for geometric compounding
    
    allMonths.forEach((month, index) => {
        const investment = monthlyData[month] || 0;
        const profit = monthlyProfit[month] || 0;
        
        // Beginning value = capital base at START of this month (before cash flows)
        const beginningCapitalBase = runningCapitalBase;
        
        // Ending value = capital base at END of this month (after cash flows, but still no profits)
        const endingCapitalBase = beginningCapitalBase + investment;
        
        // Update running capital base for next month
        runningCapitalBase = endingCapitalBase;
        
        // TWRR calculation: profit divided by beginning capital base
        if (beginningCapitalBase > 0) {
            const monthlyReturn = profit / beginningCapitalBase;
            compoundedReturn *= (1 + monthlyReturn);
        }
    });
    
    const annualizedReturn = (compoundedReturn - 1) * 100;
    
    return annualizedReturn;
}

function calculate12MonthTWRRNoMarketing() {
    if (!csvData || csvData.length === 0) {
        return 0;
    }
    
    // Get current date and 12 months ago
    const currentDate = new Date();
    const twelveMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 12, 1);
    
    // Group data by month for the last 12 months
    const monthlyData = {};
    const monthlyProfit = {};
    
    csvData.forEach((row, index) => {
        if (row.datum >= twelveMonthsAgo) {
            const monthKey = `${row.datum.getFullYear()}-${String(row.datum.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = 0;
            }
            if (!monthlyProfit[monthKey]) {
                monthlyProfit[monthKey] = 0;
            }
            
            const amount = Math.abs(row.castka);
            
            // Calculate net investment (capital movements) - SAME AS REGULAR TWRR
            switch (row.typ) {
                case 'Autoinvestice':
                case 'Investice':
                    monthlyData[monthKey] += amount;
                    break;
                case 'Prodej':
                case 'Vrácení peněz':
                case 'Odstoupení':
                case 'Splacení jistiny':
                case 'Částečné splacení jistiny':
                    monthlyData[monthKey] -= amount;
                    break;
            }
            
            // Calculate profit (performance) - EXCLUDING MARKETING REWARDS
            switch (row.typ) {
                case 'Výnos':
                case 'Bonusový výnos':
                case 'Smluvní pokuta':
                case 'Zákonné úroky z prodlení':
                    monthlyProfit[monthKey] += amount;
                    break;
                case 'Poplatek za předčasný prodej':
                case 'Poplatek za výběr':
                    monthlyProfit[monthKey] -= amount;
                    break;
                case 'Odměna':
                case 'Mimořádný příjem':
                    // Explicitly exclude marketing rewards from profit calculation
                    break;
            }
        }
    });
    
    // Get months in chronological order
    const allMonths = [...new Set([...Object.keys(monthlyData), ...Object.keys(monthlyProfit)])].sort();
    
    // Calculate CAPITAL BASE (investments only) at the start of 12-month period - SAME AS REGULAR TWRR
    let capitalBaseAtStart = 0;
    
    csvData.forEach(row => {
        if (row.datum < twelveMonthsAgo) {
            const amount = Math.abs(row.castka);
            
            // Calculate net capital investment before the 12-month period (NO PROFITS)
            switch (row.typ) {
                case 'Autoinvestice':
                case 'Investice':
                    capitalBaseAtStart += amount;
                    break;
                case 'Prodej':
                case 'Vrácení peněz':
                case 'Odstoupení':
                case 'Splacení jistiny':
                case 'Částečné splacení jistiny':
                    capitalBaseAtStart -= amount;
                    break;
            }
            // NOTE: We DO NOT include profits in the capital base calculation
            // Profits are performance results, not capital movements
        }
    });
    
    // Track running capital base (investments only, no profits)
    let runningCapitalBase = capitalBaseAtStart;
    let compoundedReturn = 1; // Start with 1 for geometric compounding
    
    allMonths.forEach((month, index) => {
        const investment = monthlyData[month] || 0;
        const profit = monthlyProfit[month] || 0;
        
        // Beginning value = capital base at START of this month (before cash flows)
        const beginningCapitalBase = runningCapitalBase;
        
        // Ending value = capital base at END of this month (after cash flows, but still no profits)
        const endingCapitalBase = beginningCapitalBase + investment;
        
        // Update running capital base for next month
        runningCapitalBase = endingCapitalBase;
        
        // TWRR calculation: profit divided by beginning capital base
        if (beginningCapitalBase > 0) {
            const monthlyReturn = profit / beginningCapitalBase;
            compoundedReturn *= (1 + monthlyReturn);
        }
    });
    
    const annualizedReturn = (compoundedReturn - 1) * 100;
    
    return annualizedReturn;
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
        
        // Clear transaction objects for tooltips
        overviewStats.firstAutoinvestTransaction = null;
        overviewStats.lastAutoinvestTransaction = null;
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
        
        // Store transaction objects for tooltips
        overviewStats.firstAutoinvestTransaction = firstTransaction;
        overviewStats.lastAutoinvestTransaction = lastTransaction;
        
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

// Fee Breakdown Calculation
function updateFeeBreakdown() {
    if (!csvData || csvData.length === 0) {
        // Set all values to zero
        setStatValueWithZeroClass('fee-breakdown-total', 0);
        setStatValueWithZeroClass('early-sale-fee', 0);
        setStatValueWithZeroClass('withdrawal-fee', 0);
        
        // Reset progress bars and percentages
        const earlySaleProgress = document.getElementById('early-sale-progress');
        const withdrawalProgress = document.getElementById('withdrawal-progress');
        const earlySalePercentageEl = document.getElementById('early-sale-percentage');
        const withdrawalPercentageEl = document.getElementById('withdrawal-percentage');
        
        if (earlySaleProgress) {
            earlySaleProgress.style.width = '0%';
        }
        if (withdrawalProgress) {
            withdrawalProgress.style.width = '0%';
        }
        if (earlySalePercentageEl) {
            earlySalePercentageEl.textContent = '0%';
            earlySalePercentageEl.classList.add('amount-zero');
        }
        if (withdrawalPercentageEl) {
            withdrawalPercentageEl.textContent = '0%';
            withdrawalPercentageEl.classList.add('amount-zero');
        }
        
        return;
    }
    
    // Calculate fee breakdown
    const earlySaleFees = csvData.filter(row => row.typ === 'Poplatek za předčasný prodej');
    const withdrawalFees = csvData.filter(row => row.typ === 'Poplatek za výběr');
    
    const earlySaleTotal = earlySaleFees.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    const withdrawalTotal = withdrawalFees.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    const totalFees = earlySaleTotal + withdrawalTotal;
    
    // Update total
    setStatValueWithZeroClass('fee-breakdown-total', totalFees);
    
    // Update individual fee amounts with zero styling
    setStatValueWithZeroClass('early-sale-fee', earlySaleTotal);
    setStatValueWithZeroClass('withdrawal-fee', withdrawalTotal);
    
    // Calculate percentages for display
    const earlySalePercentage = totalFees > 0 ? (earlySaleTotal / totalFees) * 100 : 0;
    const withdrawalPercentage = totalFees > 0 ? (withdrawalTotal / totalFees) * 100 : 0;
    
    // Update progress bars with animation
    const earlySaleProgress = document.getElementById('early-sale-progress');
    const withdrawalProgress = document.getElementById('withdrawal-progress');
    const earlySalePercentageEl = document.getElementById('early-sale-percentage');
    const withdrawalPercentageEl = document.getElementById('withdrawal-percentage');
    
    // Update percentage displays with zero styling
    if (earlySalePercentageEl) {
        earlySalePercentageEl.textContent = `${earlySalePercentage.toFixed(0)}%`;
        if (earlySalePercentage === 0) {
            earlySalePercentageEl.classList.add('amount-zero');
        } else {
            earlySalePercentageEl.classList.remove('amount-zero');
        }
    }
    
    if (withdrawalPercentageEl) {
        withdrawalPercentageEl.textContent = `${withdrawalPercentage.toFixed(0)}%`;
        if (withdrawalPercentage === 0) {
            withdrawalPercentageEl.classList.add('amount-zero');
        } else {
            withdrawalPercentageEl.classList.remove('amount-zero');
        }
    }
    
    // Animate progress bars
    if (earlySaleProgress) {
        earlySaleProgress.style.width = '0%';
        setTimeout(() => {
            earlySaleProgress.style.width = `${earlySalePercentage}%`;
        }, 100);
    }
    
    if (withdrawalProgress) {
        withdrawalProgress.style.width = '0%';
        setTimeout(() => {
            withdrawalProgress.style.width = `${withdrawalPercentage}%`;
        }, 100);
    }
}

// Net Investment Profit Breakdown Calculation
function updateNetProfitBreakdown() {
    if (!csvData || csvData.length === 0) {
        // Set all values to zero
        setStatValueWithZeroClass('net-profit-breakdown-total', 0);
        setStatValueWithZeroClass('profit-returns', 0);
        setStatValueWithZeroClass('profit-bonus', 0);
        setStatValueWithZeroClass('profit-penalty', 0);
        setStatValueWithZeroClass('profit-interest', 0);
        setStatValueWithZeroClass('profit-fees', 0);
        
        // Reset progress bars and percentages
        const elements = ['profit-returns', 'profit-bonus', 'profit-penalty', 'profit-interest', 'profit-fees'];
        elements.forEach(element => {
            const progressEl = document.getElementById(`${element}-progress`);
            const percentageEl = document.getElementById(`${element}-percentage`);
            
            if (progressEl) progressEl.style.width = '0%';
            if (percentageEl) {
                percentageEl.textContent = '0%';
                percentageEl.classList.add('amount-zero');
            }
        });
        
        return;
    }
    
    // Calculate individual components
    const returns = csvData.filter(row => row.typ === 'Výnos');
    const bonusReturns = csvData.filter(row => row.typ === 'Bonusový výnos');
    const penalties = csvData.filter(row => row.typ === 'Smluvní pokuta');
    const legalInterest = csvData.filter(row => row.typ === 'Zákonné úroky z prodlení');
    const earlySaleFees = csvData.filter(row => row.typ === 'Poplatek za předčasný prodej');
    const withdrawalFees = csvData.filter(row => row.typ === 'Poplatek za výběr');
    
    const returnsTotal = returns.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    const bonusTotal = bonusReturns.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    const penaltyTotal = penalties.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    const interestTotal = legalInterest.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    const earlySaleFeesTotal = earlySaleFees.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    const withdrawalFeesTotal = withdrawalFees.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    
    const totalFees = earlySaleFeesTotal + withdrawalFeesTotal;
    const grossProfit = returnsTotal + bonusTotal + penaltyTotal + interestTotal;
    const netProfit = grossProfit - totalFees;
    
    // Update total
    setStatValueWithZeroClass('net-profit-breakdown-total', netProfit);
    
    // Update individual amounts with zero styling
    setStatValueWithZeroClass('profit-returns', returnsTotal);
    setStatValueWithZeroClass('profit-bonus', bonusTotal);
    setStatValueWithZeroClass('profit-penalty', penaltyTotal);
    setStatValueWithZeroClass('profit-interest', interestTotal);
    setStatValueWithZeroClass('profit-fees', totalFees);
    
    // Calculate percentages for display (based on gross profit for positive components, total fees for negative)
    const totalGross = grossProfit + totalFees; // Total for percentage calculation
    
    if (totalGross > 0) {
        const returnsPercentage = (returnsTotal / totalGross) * 100;
        const bonusPercentage = (bonusTotal / totalGross) * 100;
        const penaltyPercentage = (penaltyTotal / totalGross) * 100;
        const interestPercentage = (interestTotal / totalGross) * 100;
        const feesPercentage = (totalFees / totalGross) * 100;
        
        // Update percentage displays and progress bars
        const updates = [
            { id: 'profit-returns', percentage: returnsPercentage },
            { id: 'profit-bonus', percentage: bonusPercentage },
            { id: 'profit-penalty', percentage: penaltyPercentage },
            { id: 'profit-interest', percentage: interestPercentage },
            { id: 'profit-fees', percentage: feesPercentage }
        ];
        
        updates.forEach(({ id, percentage }, index) => {
            const percentageEl = document.getElementById(`${id}-percentage`);
            const progressEl = document.getElementById(`${id}-progress`);
            
            if (percentageEl) {
                percentageEl.textContent = `${percentage.toFixed(0)}%`;
                if (percentage === 0) {
                    percentageEl.classList.add('amount-zero');
                } else {
                    percentageEl.classList.remove('amount-zero');
                }
            }
            
            if (progressEl) {
                progressEl.style.width = '0%';
                setTimeout(() => {
                    progressEl.style.width = `${percentage}%`;
                }, 100 + (index * 50));
            }
        });
    }
}

// Marketing Rewards Breakdown Calculation
function updateMarketingRewardsBreakdown() {
    if (!csvData || csvData.length === 0) {
        // Set all values to zero
        setStatValueWithZeroClass('marketing-rewards-breakdown-total', 0);
        setStatValueWithZeroClass('marketing-extraordinary', 0);
        setStatValueWithZeroClass('marketing-reward', 0);
        
        // Reset progress bars and percentages
        const elements = ['marketing-extraordinary', 'marketing-reward'];
        elements.forEach(element => {
            const progressEl = document.getElementById(`${element}-progress`);
            const percentageEl = document.getElementById(`${element}-percentage`);
            
            if (progressEl) progressEl.style.width = '0%';
            if (percentageEl) {
                percentageEl.textContent = '0%';
                percentageEl.classList.add('amount-zero');
            }
        });
        
        return;
    }
    
    // Calculate marketing rewards breakdown
    const extraordinaryIncome = csvData.filter(row => row.typ === 'Mimořádný příjem');
    const rewards = csvData.filter(row => row.typ === 'Odměna');
    
    const extraordinaryTotal = extraordinaryIncome.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    const rewardsTotal = rewards.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    const totalRewards = extraordinaryTotal + rewardsTotal;
    
    // Update total
    setStatValueWithZeroClass('marketing-rewards-breakdown-total', totalRewards);
    
    // Update individual amounts with zero styling
    setStatValueWithZeroClass('marketing-extraordinary', extraordinaryTotal);
    setStatValueWithZeroClass('marketing-reward', rewardsTotal);
    
    // Calculate percentages for display
    const extraordinaryPercentage = totalRewards > 0 ? (extraordinaryTotal / totalRewards) * 100 : 0;
    const rewardsPercentage = totalRewards > 0 ? (rewardsTotal / totalRewards) * 100 : 0;
    
    // Update percentage displays and progress bars
    const updates = [
        { id: 'marketing-extraordinary', percentage: extraordinaryPercentage },
        { id: 'marketing-reward', percentage: rewardsPercentage }
    ];
    
    updates.forEach(({ id, percentage }, index) => {
        const percentageEl = document.getElementById(`${id}-percentage`);
        const progressEl = document.getElementById(`${id}-progress`);
        
        if (percentageEl) {
            percentageEl.textContent = `${percentage.toFixed(0)}%`;
            if (percentage === 0) {
                percentageEl.classList.add('amount-zero');
            } else {
                percentageEl.classList.remove('amount-zero');
            }
        }
        
        if (progressEl) {
            progressEl.style.width = '0%';
            setTimeout(() => {
                progressEl.style.width = `${percentage}%`;
            }, 100 + (index * 100));
        }
    });
}

// Current Month Payouts Breakdown Calculation
function updateCurrentMonthPayoutsBreakdown() {
    if (!csvData || csvData.length === 0) {
        // Set all values to zero
        setStatValueWithZeroClass('current-month-payouts-total', 0);
        setStatValueWithZeroClass('current-month-returns', 0);
        setStatValueWithZeroClass('current-month-bonus', 0);
        setStatValueWithZeroClass('current-month-penalty', 0);
        setStatValueWithZeroClass('current-month-interest', 0);
        
        // Reset progress bars and percentages
        const elements = ['current-month-returns', 'current-month-bonus', 'current-month-penalty', 'current-month-interest'];
        elements.forEach(element => {
            const progressEl = document.getElementById(`${element}-progress`);
            const percentageEl = document.getElementById(`${element}-percentage`);
            
            if (progressEl) progressEl.style.width = '0%';
            if (percentageEl) {
                percentageEl.textContent = '0%';
                percentageEl.classList.add('amount-zero');
            }
        });
        
        return;
    }
    
    // Find the latest month from transactions
    const sortedTransactions = csvData.slice().sort((a, b) => b.datum - a.datum);
    if (sortedTransactions.length === 0) return;
    
    const latestDate = sortedTransactions[0].datum;
    const latestYear = latestDate.getFullYear();
    const latestMonth = latestDate.getMonth();
    
    // Filter transactions for the latest month
    const currentMonthTransactions = csvData.filter(row => {
        const transactionDate = row.datum;
        return transactionDate.getFullYear() === latestYear && 
               transactionDate.getMonth() === latestMonth;
    });
    
    // Calculate individual components for current month
    const returns = currentMonthTransactions.filter(row => row.typ === 'Výnos');
    const bonusReturns = currentMonthTransactions.filter(row => row.typ === 'Bonusový výnos');
    const penalties = currentMonthTransactions.filter(row => row.typ === 'Smluvní pokuta');
    const legalInterest = currentMonthTransactions.filter(row => row.typ === 'Zákonné úroky z prodlení');
    
    const returnsTotal = returns.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    const bonusTotal = bonusReturns.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    const penaltyTotal = penalties.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    const interestTotal = legalInterest.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    
    const totalPayouts = returnsTotal + bonusTotal + penaltyTotal + interestTotal;
    
    // Store transaction data for modal
    window.currentMonthTransactionData = {
        year: latestYear,
        month: latestMonth,
        returns: returns,
        bonusReturns: bonusReturns,
        penalties: penalties,
        legalInterest: legalInterest
    };
    
    // Update total
    setStatValueWithZeroClass('current-month-payouts-total', totalPayouts);
    
    // Update individual amounts with zero styling
    setStatValueWithZeroClass('current-month-returns', returnsTotal);
    setStatValueWithZeroClass('current-month-bonus', bonusTotal);
    setStatValueWithZeroClass('current-month-penalty', penaltyTotal);
    setStatValueWithZeroClass('current-month-interest', interestTotal);
    
    // Calculate percentages for display
    if (totalPayouts > 0) {
        const returnsPercentage = (returnsTotal / totalPayouts) * 100;
        const bonusPercentage = (bonusTotal / totalPayouts) * 100;
        const penaltyPercentage = (penaltyTotal / totalPayouts) * 100;
        const interestPercentage = (interestTotal / totalPayouts) * 100;
        
        // Update percentage displays and progress bars
        const updates = [
            { id: 'current-month-returns', percentage: returnsPercentage },
            { id: 'current-month-bonus', percentage: bonusPercentage },
            { id: 'current-month-penalty', percentage: penaltyPercentage },
            { id: 'current-month-interest', percentage: interestPercentage }
        ];
        
        updates.forEach(({ id, percentage }, index) => {
            const percentageEl = document.getElementById(`${id}-percentage`);
            const progressEl = document.getElementById(`${id}-progress`);
            
            if (percentageEl) {
                percentageEl.textContent = `${percentage.toFixed(0)}%`;
                if (percentage === 0) {
                    percentageEl.classList.add('amount-zero');
                } else {
                    percentageEl.classList.remove('amount-zero');
                }
            }
            
            if (progressEl) {
                progressEl.style.width = '0%';
                setTimeout(() => {
                    progressEl.style.width = `${percentage}%`;
                }, 100 + (index * 100));
            }
        });
    } else {
        // All zero case
        const elements = ['current-month-returns', 'current-month-bonus', 'current-month-penalty', 'current-month-interest'];
        elements.forEach(element => {
            const progressEl = document.getElementById(`${element}-progress`);
            const percentageEl = document.getElementById(`${element}-percentage`);
            
            if (progressEl) progressEl.style.width = '0%';
            if (percentageEl) {
                percentageEl.textContent = '0%';
                percentageEl.classList.add('amount-zero');
            }
        });
    }
}

// Setup event listeners for clickable breakdown rows
function setupCurrentMonthBreakdownListeners() {
    const clickableRows = document.querySelectorAll('.breakdown-row-clickable');
    
    clickableRows.forEach(row => {
        row.addEventListener('click', function() {
            const transactionType = this.getAttribute('data-transaction-type');
            showTransactionDetailsModal(transactionType);
        });
    });
    
    // Setup modal close listeners
    const modal = document.getElementById('transaction-details-modal');
    const closeBtn = document.getElementById('close-transaction-details-modal');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeTransactionDetailsModal);
    }
    
    if (modal) {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                closeTransactionDetailsModal();
            }
        });
    }
    
    // Escape key to close modal
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeTransactionDetailsModal();
        }
    });
}

// Show transaction details modal
function showTransactionDetailsModal(transactionType) {
    if (!window.currentMonthTransactionData) return;
    
    const data = window.currentMonthTransactionData;
    let transactions = [];
    let typeLabel = '';
    
    // Get transactions based on type
    switch (transactionType) {
        case 'Výnos':
            transactions = data.returns;
            typeLabel = 'Výnosy';
            break;
        case 'Bonusový výnos':
            transactions = data.bonusReturns;
            typeLabel = 'Bonusový výnos';
            break;
        case 'Smluvní pokuta':
            transactions = data.penalties;
            typeLabel = 'Smluvní pokuty';
            break;
        case 'Zákonné úroky z prodlení':
            transactions = data.legalInterest;
            typeLabel = 'Zákonné úroky z prodlení';
            break;
        default:
            return;
    }
    
    if (transactions.length === 0) return;
    
    // Update modal content
    const monthNames = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
                       'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
    const monthLabel = `${monthNames[data.month]} ${data.year}`;
    
    const transactionCount = transactions.length;
    const transactionLabel = transactionCount === 1 ? 'transakce' : 
                            transactionCount < 5 ? 'transakce' : 'transakcí';
    
    document.getElementById('transaction-details-title').innerHTML = `
        <div>
            <i class="fas fa-calendar-check"></i> 
            ${typeLabel} - ${monthLabel}
        </div>
        <div class="modal-subtitle">
            ${transactionCount} ${transactionLabel}
        </div>
    `;
    
    document.getElementById('transaction-details-summary').textContent = '';
    
    // Populate table
    const tableBody = document.getElementById('transaction-details-table-body');
    tableBody.innerHTML = transactions.map(transaction => {
        return `
            <tr>
                <td>${locale.formatDate(transaction.datum)}</td>
                <td>${transaction.projekt || '-'}</td>
                <td class="amount-positive modal-amount-bold">${formatAmountWithOptionalDecimals(Math.abs(transaction.castka)).formattedAmount}</td>
            </tr>
        `;
    }).join('');
    
    // Show modal
    const modal = document.getElementById('transaction-details-modal');
    if (modal) {
        lockBodyScroll();
        modal.style.display = 'flex';
        
        // Add wheel event listener to prevent background scrolling
        modal.addEventListener('wheel', handleModalWheelEvent, { passive: false });
        
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
    }
}

// Close transaction details modal
function closeTransactionDetailsModal() {
    const modal = document.getElementById('transaction-details-modal');
    if (modal) {
        modal.classList.remove('show');
        unlockBodyScroll();
        
        // Remove wheel event listener
        modal.removeEventListener('wheel', handleModalWheelEvent);
        
        setTimeout(() => {
            modal.style.display = 'none';
        }, 250);
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
            totalDeposits: 0,
            averageInvestment: 0,
            portfolioStages: 0,
            largestInvestment: 0,
            totalFees: 0,
            totalProfits: 0,
            grossCurrentYield: 0,
            walletBalance: 0,
            blockedOnMarket: 0
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
    
    // Celkové vklady = sum of deposits
    const deposits = data.filter(row => row.typ === 'Vklad peněz');
    const totalDeposits = deposits.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    
    // Největší investice = highest amount from investments
    const largestInvestment = investments.length > 0 ? 
        Math.max(...investments.map(row => Math.abs(row.castka))) : 0;
    
    // Find the largest investment transaction for tooltip
    const largestInvestmentTransaction = investments.length > 0 ? 
        investments.find(row => Math.abs(row.castka) === largestInvestment) : null;
    
    // Průměrná výše investice = mean of all investments
    const averageInvestment = investments.length > 0 ? 
        investments.reduce((sum, row) => sum + Math.abs(row.castka), 0) / investments.length : 0;
    
    // Počet etap v portfoliu = count of projects with positive exposure
    // Exposure = (Investice do příležitosti + Autoinvestice + Investice) - (Odstoupení + Splacení jistiny + Vrácení peněz + Částečné splacení jistiny)
    const projectExposures = {};
    
    // Calculate exposure for each project
    data.forEach(row => {
        if (!row.projekt || row.projekt.trim() === '') return;
        
        if (!projectExposures[row.projekt]) {
            projectExposures[row.projekt] = 0;
        }
        
        const amount = Math.abs(row.castka);
        const rawAmount = row.castka; // Original signed value
        const type = row.typ;
        
        // Debug: Log various transaction types to see raw values
        if (Object.keys(projectExposures).length < 3) {
            if (type === 'Investice do příležitosti' || type === 'Autoinvestice' || type === 'Investice' ||
                type === 'Odstoupení' || type === 'Splacení jistiny' || type === 'Vrácení peněz' || 
                type === 'Částečné splacení jistiny' || type === 'Prodej') {
                console.log(`DEBUG: Raw transaction - Type: ${type}, Project: ${row.projekt}, Raw Amount: ${rawAmount}`);
            }
        }
        
        // Use raw signed values for proper exposure calculation
        // Investments (negative values) should increase exposure when subtracted (double negative = positive)
        // Returns (positive values) should decrease exposure when subtracted
        if (type === 'Investice do příležitosti' || type === 'Autoinvestice' || type === 'Investice') {
            projectExposures[row.projekt] -= rawAmount; // Subtract negative = add positive
        }
        // Subtract returns and withdrawals (positive values)
        else if (type === 'Odstoupení' || type === 'Splacení jistiny' || 
                 type === 'Vrácení peněz' || type === 'Částečné splacení jistiny' || type === 'Prodej') {
            projectExposures[row.projekt] -= rawAmount; // Subtract positive values
        }
    });
    
    console.log("DEBUG: Chart - Project Exposures:", projectExposures);
    
    // Debug: Check for floating point precision issues and apply rounding
    Object.entries(projectExposures).forEach(([project, exposure]) => {
        // Round to cents to avoid floating point precision issues
        const roundedExposure = Math.round(exposure * 100) / 100;
        projectExposures[project] = roundedExposure;
        
        if (Math.abs(exposure - roundedExposure) > 0.0001) {
            console.log(`DEBUG: Precision issue fixed - Project: ${project}, Original: ${exposure.toString()}, Rounded: ${roundedExposure.toString()}`);
        }
        if (roundedExposure > 0 && roundedExposure < 0.01) {
            console.log(`DEBUG: Very small positive exposure - Project: ${project}, Exposure: ${roundedExposure.toString()}`);
        }
    });
    
    // Filter to show only projects with positive exposure
    const validProjects = Object.entries(projectExposures)
        .filter(([projectName, exposure]) => exposure > 0)
        .map(([projectName, exposure]) => [projectName, exposure])
        .sort(([,a], [,b]) => b - a);

    console.log("DEBUG: Chart - Valid Projects:", validProjects);
    console.log("DEBUG: Chart - Valid Projects Count:", validProjects.length);
    
    // Total stages = all projects that had any investment activity
    const allInvestmentProjects = new Set();
    data.forEach(row => {
        if (row.projekt && row.projekt.trim() !== '' && 
            (row.typ === 'Investice do příležitosti' || row.typ === 'Autoinvestice' || row.typ === 'Investice')) {
            allInvestmentProjects.add(row.projekt);
        }
    });
    
    const activeStages = validProjects.length;
    const totalStages = allInvestmentProjects.size;
    
    console.log("DEBUG: Statistics - Project Exposures:", projectExposures);
    console.log("DEBUG: Statistics - Active Projects:", validProjects);
    console.log("DEBUG: Statistics - activeStages:", activeStages, "totalStages:", totalStages);
    
    const portfolioStages = {
        active: activeStages,
        total: totalStages,
        display: `${activeStages} / ${totalStages}`
    };
    
    // Poplatky = sum of all fees
    const totalFees = fees.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    
    // Calculate new statistics
    // Celkový čistý výnos investic = SUM(Bonusový výnos, Smluvní pokuta, Výnos, Zákonné úroky z prodlení) - SUM(Poplatek za předčasný prodej, Poplatek za výběr)
    const profitTransactions = data.filter(row => 
        row.typ === 'Bonusový výnos' || 
        row.typ === 'Smluvní pokuta' || 
        row.typ === 'Výnos' || 
        row.typ === 'Zákonné úroky z prodlení'
    );
    const totalProfitIncome = profitTransactions.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    
    // Subtract specific fees from profits
    const profitReducingFees = data.filter(row => 
        row.typ === 'Poplatek za předčasný prodej' || 
        row.typ === 'Poplatek za výběr'
    );
    const totalProfitReducingFees = profitReducingFees.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    
    const totalProfits = totalProfitIncome - totalProfitReducingFees;
    
    // Calculate marketing rewards separately (Mimořádný příjem + Odměna)
    const allMarketingRewards = data.filter(row => 
        row.typ === 'Mimořádný příjem' || 
        row.typ === 'Odměna'
    );
    const totalMarketingRewards = allMarketingRewards.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    
    // Total base investments for yield calculation = SUM(Investice, Autoinvestice)
    const baseInvestments = data.filter(row => 
        row.typ === 'Investice' || 
        row.typ === 'Autoinvestice'
    );
    const totalBaseInvestments = baseInvestments.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    
    // Hrubý aktuální výnos = (Total Profits / Total Base Investments) * 100
    const grossCurrentYield = totalBaseInvestments > 0 ? (totalProfits / totalBaseInvestments) * 100 : 0;
    
    // Calculate only "Odměna" for wallet balance calculation (keep existing logic)
    const rewardTransactions = data.filter(row => row.typ === 'Odměna');
    const marketingRewards = rewardTransactions.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    
    // Calculate purchase offers and returns
    const purchaseOffers = data.filter(row => row.typ === 'Nabídka ke koupi');
    const totalPurchaseOffers = purchaseOffers.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    
    const offerReturns = data.filter(row => row.typ === 'Vrácení nabídky');
    const totalOfferReturns = offerReturns.reduce((sum, row) => sum + Math.abs(row.castka), 0);
    
    // Z toho blokováno na tržišti = Nabídka ke koupi - Vrácení nabídky
    const blockedOnMarket = totalPurchaseOffers - totalOfferReturns;
    
    // Stav peněženky = Celkové vklady - Aktuální velikost portfolia + Celkový čistý výnos investic - Celkové výběry - Nabídka ke koupi + Vrácení nabídky + Marketingové odměny
    const walletBalance = totalDeposits - totalInvestment + totalProfits - totalWithdrawals - totalPurchaseOffers + totalOfferReturns + totalMarketingRewards;
    const walletBalanceAbs = Math.abs(walletBalance);
    console.log("DEBUG: Wallet Balance Components:", { totalDeposits, totalInvestment, totalProfits, totalWithdrawals, totalPurchaseOffers, totalOfferReturns, totalMarketingRewards });
    console.log("DEBUG: Wallet Balance Calculation:", totalDeposits, "-", totalInvestment, "+", totalProfits, "-", totalWithdrawals, "-", totalPurchaseOffers, "+", totalOfferReturns, "+", totalMarketingRewards, "=", walletBalance);
    console.log("DEBUG: Final Wallet Balance:", walletBalanceAbs);
    
    return {
        totalTransactions: data.length,
        totalInvestment,
        totalWithdrawals,
        totalDeposits,
        averageInvestment,
        portfolioStages,
        largestInvestment,
        largestInvestmentTransaction,
        totalFees,
        totalProfits,
        totalMarketingRewards,
        grossCurrentYield,
        walletBalance: walletBalanceAbs,
        blockedOnMarket
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

// Apply Filters - Only affects the main transactions table and timeline
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
    
    // Update the main transactions table and timeline
    updateTable();
    updateTimeline();
}

// Modal scroll management functions
function lockBodyScroll() {
    const scrollY = window.scrollY;
    document.body.style.top = `-${scrollY}px`;
    document.body.classList.add('modal-open');
}

function unlockBodyScroll() {
    const scrollY = document.body.style.top;
    document.body.classList.remove('modal-open');
    document.body.style.top = '';
    window.scrollTo(0, parseInt(scrollY || '0') * -1);
}

// Prevent background scrolling on modal overlays
function handleModalWheelEvent(event) {
    const modalContainer = event.currentTarget.querySelector('.modal-container, .modal');
    if (modalContainer && modalContainer.contains(event.target)) {
        // Allow scrolling within modal content
        return;
    }
    // Prevent scrolling on overlay background
    event.preventDefault();
    event.stopPropagation();
}

// Modal Functions
function openFilterModal() {
    const modalOverlay = document.getElementById('filter-modal-overlay');
    lockBodyScroll();
    modalOverlay.style.display = 'flex';
    modalOverlay.classList.add('show');
    
    // Add wheel event listener to prevent background scrolling
    modalOverlay.addEventListener('wheel', handleModalWheelEvent, { passive: false });
    
    // Update clear filters button state when modal opens
    updateClearFiltersButton();
    
    // Trap focus in modal
    document.addEventListener('keydown', handleModalKeydown);
}

function closeFilterModal() {
    const modalOverlay = document.getElementById('filter-modal-overlay');
    modalOverlay.classList.remove('show');
    modalOverlay.style.display = 'none';
    unlockBodyScroll();
    
    // Remove wheel event listener
    modalOverlay.removeEventListener('wheel', handleModalWheelEvent);
    
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
        closeAboutProjectModal();
    }
}

// About Project Modal Functions
function openAboutProjectModal() {
    const modalOverlay = document.getElementById('about-project-modal');
    lockBodyScroll();
    modalOverlay.style.display = 'flex';
    modalOverlay.classList.add('show');
    
    // Add wheel event listener to prevent background scrolling
    modalOverlay.addEventListener('wheel', handleModalWheelEvent, { passive: false });
    
    // Trap focus in modal
    document.addEventListener('keydown', handleAboutModalKeydown);
}

function closeAboutProjectModal() {
    const modalOverlay = document.getElementById('about-project-modal');
    modalOverlay.classList.remove('show');
    unlockBodyScroll();
    
    // Remove wheel event listener
    modalOverlay.removeEventListener('wheel', handleModalWheelEvent);
    
    setTimeout(() => {
        modalOverlay.style.display = 'none';
    }, 200);
    
    // Remove keydown listener
    document.removeEventListener('keydown', handleAboutModalKeydown);
}

function handleAboutModalKeydown(event) {
    if (event.key === 'Escape') {
        closeAboutProjectModal();
    }
}

function handleAboutModalOverlayClick(event) {
    if (event.target === event.currentTarget) {
        closeAboutProjectModal();
    }
}

function applyFiltersAndClose() {
    applyFilters();
    closeFilterModal();
}

// Timeline Filter Modal Functions
function openTimelineFilterModal() {
    const modalOverlay = document.getElementById('timeline-filter-modal-overlay');
    lockBodyScroll();
    modalOverlay.style.display = 'flex';
    modalOverlay.classList.add('show');
    
    // Add wheel event listener to prevent background scrolling
    modalOverlay.addEventListener('wheel', handleModalWheelEvent, { passive: false });
    
    // Populate filters with current data
    populateTimelineFilters();
    
    // Trap focus in modal
    document.addEventListener('keydown', handleTimelineModalKeydown);
}

function closeTimelineFilterModal() {
    const modalOverlay = document.getElementById('timeline-filter-modal-overlay');
    modalOverlay.classList.remove('show');
    modalOverlay.style.display = 'none';
    unlockBodyScroll();
    
    // Remove wheel event listener
    modalOverlay.removeEventListener('wheel', handleModalWheelEvent);
    
    // Remove focus trap
    document.removeEventListener('keydown', handleTimelineModalKeydown);
}

function handleTimelineModalOverlayClick(event) {
    if (event.target.id === 'timeline-filter-modal-overlay') {
        closeTimelineFilterModal();
    }
}

function handleTimelineModalKeydown(event) {
    if (event.key === 'Escape') {
        closeTimelineFilterModal();
    }
}

function populateTimelineFilters() {
    // Populate projects dropdown - use the same data as main filters
    const projectSelect = document.getElementById('timeline-project-filter-select');
    projectSelect.innerHTML = '';
    
    // Add "Všechny projekty" option
    const allProjectsOption = document.createElement('option');
    allProjectsOption.value = '';
    allProjectsOption.textContent = 'Všechny projekty';
    projectSelect.appendChild(allProjectsOption);
    
    const projects = [...new Set(csvData.map(row => row.projekt))]
        .filter(project => project && project.trim() !== '') // Filter out empty/null projects
        .sort();
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project;
        option.textContent = project;
        projectSelect.appendChild(option);
    });
    
    // Clean up any potential duplicate empty options that might have been created
    const options = Array.from(projectSelect.options);
    const emptyOptions = options.filter(option => option.value === '' && option.textContent !== 'Všechny projekty');
    emptyOptions.forEach(option => option.remove());
    
    // Set the selected value - when selectedProject is empty, it will select the "Všechny projekty" option
    if (timelineState.filters.selectedProject === '' || !timelineState.filters.selectedProject) {
        projectSelect.selectedIndex = 0; // Select "Všechny projekty"
    } else {
        projectSelect.value = timelineState.filters.selectedProject;
        // If the project doesn't exist anymore, fallback to "Všechny projekty"
        if (projectSelect.selectedIndex === -1) {
            projectSelect.selectedIndex = 0;
        }
    }
    
    // Populate transaction types checkboxes - only timeline relevant types
    const checkboxContainer = document.getElementById('timeline-transaction-type-checkboxes');
    checkboxContainer.innerHTML = '';
    
    const allowedTypes = ['Investice', 'Autoinvestice', 'Prodej', 'Odstoupení', 'Vklad peněz', 'Výběr peněz', 'Vrácení peněz'];
    const availableTypes = [...new Set(csvData.map(row => row.typ))].filter(type => allowedTypes.includes(type)).sort();
    
    availableTypes.forEach(type => {
        const checkboxItem = document.createElement('div');
        checkboxItem.className = 'checkbox-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `timeline-type-${type}`;
        checkbox.value = type;
        checkbox.checked = timelineState.filters.selectedTransactionTypes.includes(type);
        
        const label = document.createElement('label');
        label.htmlFor = `timeline-type-${type}`;
        label.textContent = type;
        
        checkboxItem.appendChild(checkbox);
        checkboxItem.appendChild(label);
        checkboxContainer.appendChild(checkboxItem);
    });
}

function applyTimelineFilters() {
    // Get selected project
    const projectSelect = document.getElementById('timeline-project-filter-select');
    timelineState.filters.selectedProject = projectSelect.value;
    
    // Get selected transaction types
    const checkboxes = document.querySelectorAll('#timeline-transaction-type-checkboxes input[type="checkbox"]:checked');
    timelineState.filters.selectedTransactionTypes = Array.from(checkboxes).map(cb => cb.value);
    
    // Recreate timeline with new filters
    createTimeline();
    
    closeTimelineFilterModal();
}

function clearTimelineFilters() {
    // Reset timeline filters to defaults
    timelineState.filters.selectedProject = '';
    initializeTimelineFiltersDefault();
    
    // Recreate timeline
    createTimeline();
    
    closeTimelineFilterModal();
}

function initializeTimelineFiltersDefault() {
    // Set all transaction types to be checked by default
    if (csvData && csvData.length > 0) {
        const allowedTypes = ['Investice', 'Autoinvestice', 'Prodej', 'Odstoupení', 'Vklad peněz', 'Výběr peněz', 'Vrácení peněz'];
        const availableTypes = [...new Set(csvData.map(row => row.typ))].filter(type => allowedTypes.includes(type));
        timelineState.filters.selectedTransactionTypes = availableTypes;
    }
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
        const investiceFormatted = formatAmountWithOptionalDecimals(project.investice);
        const vynosyFormatted = formatAmountWithOptionalDecimals(project.vynosy);
        const splacenoFormatted = formatAmountWithOptionalDecimals(project.splaceno);
        const prodejeFormatted = formatAmountWithOptionalDecimals(project.prodeje);
        const zbyvaFormatted = formatAmountWithOptionalDecimals(project.zbyva_splatit);
        
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
    itemsPerPage: 10
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
    
    const canvas = document.getElementById('time-chart');
    if (!canvas) {
        console.error('Time series chart canvas not found');
        return;
    }
    const ctx = canvas.getContext('2d');
    
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
                            display: false
                        }
                    },
                    y: {
                        title: {
                            display: false
                        }
                    }
            }
        }
    });
        return;
}

    
    
    // Group data by month and calculate net investment and profit
    const monthlyData = {};
    const monthlyProfit = {};
    
    csvData.forEach(row => {
        const monthKey = `${row.datum.getFullYear()}-${String(row.datum.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = 0;
        }
        if (!monthlyProfit[monthKey]) {
            monthlyProfit[monthKey] = 0;
        }
        
        const amount = Math.abs(row.castka);
        
        // Calculate net investment: Autoinvestice + Investice - Prodej - Vrácení peněz - Odstoupení - Splacení jistiny - Částečné splacení jistiny
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
        
        // Calculate profit: Výnos + Bonusový výnos + Smluvní pokuta + Zákonné úroky z prodlení + Odměna + Mimořádný příjem - Poplatek za předčasný prodej - Poplatek za výběr
        switch (row.typ) {
            case 'Výnos':
            case 'Bonusový výnos':
            case 'Smluvní pokuta':
            case 'Zákonné úroky z prodlení':
            case 'Odměna':
            case 'Mimořádný příjem':
                monthlyProfit[monthKey] += amount; // Add positive
                break;
            case 'Poplatek za předčasný prodej':
            case 'Poplatek za výběr':
                monthlyProfit[monthKey] -= amount; // Subtract
                break;
        }
    });
    
    // Get all months that have either investment or profit data
    const allMonths = [...new Set([...Object.keys(monthlyData), ...Object.keys(monthlyProfit)])].sort();
    
    // Convert to chart data format with cumulative values
    let cumulativeInvestment = 0;
    let cumulativeProfit = 0;
    
    const investmentData = allMonths.map(month => {
        const investment = monthlyData[month] || 0;
        cumulativeInvestment += investment;
        return {
            x: month + '-01', // First day of month for proper time parsing
            y: cumulativeInvestment
        };
    });
    
    const profitData = allMonths.map(month => {
        const profit = monthlyProfit[month] || 0;
        cumulativeProfit += profit;
        return {
            x: month + '-01', // First day of month for proper time parsing
            y: cumulativeProfit
        };
    });
    
    // Calculate TWRR correctly
    let twrrCumulativeInvestment = 0;
    let twrrCumulativeProfit = 0;
    const twrrData = [];
    allMonths.forEach(month => {
        const investment = monthlyData[month] || 0;
        const profit = monthlyProfit[month] || 0;
        
        // Portfolio value at beginning of month (before new investments)
        const beginningValue = twrrCumulativeInvestment + twrrCumulativeProfit;
        
        // Add new investments and profits
        twrrCumulativeInvestment += investment;
        twrrCumulativeProfit += profit;
        
        // Portfolio value at end of month
        const endingValue = twrrCumulativeInvestment + twrrCumulativeProfit;

        // Calculate TWRR: (Ending Value - Cash Flows) / Beginning Value
        // Only calculate if there's a beginning value and some activity
        if (beginningValue > 0 && (investment !== 0 || profit !== 0)) {
            const returnRate = profit / beginningValue; // Only profit contributes to return, not new investments
            twrrData.push({
                x: month + '-01',
                y: returnRate * 100 // Convert to percentage
            });
        } else if (beginningValue === 0 && (investment !== 0 || profit !== 0)) {
            // First month with activity - no return calculation possible
            twrrData.push({
                x: month + '-01',
                y: 0
            });
        }
    });
    

    
    charts.timeSeries = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Kumulativní čistá investice',
                data: investmentData,
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
            }, {
                label: 'Kumulativní zisk',
                data: profitData,
                borderColor: '#10B981',
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
                    if (!chartArea) {
                        return null;
                    }
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
                    gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.15)');
                    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
                    return gradient;
                },
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 8,
                pointHoverBorderWidth: 3,
                pointHoverBorderColor: '#FFFFFF',
                pointHoverBackgroundColor: '#10B981',
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
                    display: true,
                    position: 'bottom',
                    align: 'center',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'line',
                        font: {
                            size: 12,
                            weight: '500',
                            family: 'Inter, system-ui, sans-serif'
                        },
                        color: '#FFFFFF',
                        generateLabels: function(chart) {
                            const original = Chart.defaults.plugins.legend.labels.generateLabels;
                            const labels = original.call(this, chart);
                            labels.forEach(label => {
                                label.text = ''; // Remove text, keep only the colored indicator
                            });
                            return labels;
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
                    position: 'nearest',
                    xAlign: 'center',
                    yAlign: 'bottom',
                    callbacks: {
                        title: function(context) {
                            const date = new Date(context[0].parsed.x);
                            return date.toLocaleDateString('cs-CZ', { 
                                year: 'numeric', 
                                month: 'long' 
                            });
                        },
                        label: function(context) {
                            const datasetLabel = context.dataset.label;
                            const value = context.parsed.y;
                            if (datasetLabel === 'Kumulativní čistá investice') {
                                return `Velikost portfolia: ${formatAmountWithOptionalDecimals(value).formattedAmount}`;
                            } else if (datasetLabel === 'Kumulativní zisk') {
                                return `Celkový zisk: ${formatAmountWithOptionalDecimals(value).formattedAmount}`;
                            }
                            return `${datasetLabel}: ${formatAmountWithOptionalDecimals(value).formattedAmount}`;
                        },
                        labelColor: function(context) {
                            return {
                                borderColor: context.dataset.borderColor,
                                backgroundColor: context.dataset.borderColor,
                                borderWidth: 2,
                                borderDash: [],
                                borderRadius: 2,
                            };
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
                            display: false
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
                            display: false
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
    

    
    const canvas = document.getElementById('project-type-chart');
    if (!canvas) {
        console.error('Project type chart canvas not found');
        return;
    }
    const ctx = canvas.getContext('2d');
    
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
                    position: 'nearest',
                    xAlign: 'center',
                    yAlign: 'bottom',
                    callbacks: {
                        title: function(context) {
                            const label = context[0].label;
                            return label.toLowerCase() === 'legacy' ? 'participace' : label;
                        },
                        label: function(context) {
                            const value = context.parsed;
                            const percentage = ((value / total) * 100).toFixed(1);
                            return [
                                `Částka: ${formatAmountWithOptionalDecimals(value).formattedAmount}`,
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
    
    const canvas = document.getElementById('top-projects-chart');
    if (!canvas) {
        console.error('Top projects chart canvas not found');
        return;
    }
    const ctx = canvas.getContext('2d');
    
    // Calculate net investment by project, showing only active projects
    // Active project: Splaceno (Částečné splacení jistiny + Splacení jistiny) - Investice value (Autoinvestice + Investice - Odstoupení - Vrácení peněz) ≠ 0
    const projectTopData = {};
    
    // First, collect all transaction data by project
    csvData.forEach(row => {
        if (!row.projekt) return;
        
        if (!projectTopData[row.projekt]) {
            projectTopData[row.projekt] = {
                investiceValue: 0,  // Autoinvestice + Investice - Odstoupení - Vrácení peněz
                splacenoValue: 0,   // Částečné splacení jistiny + Splacení jistiny
                netInvestment: 0    // Net investment for display
            };
            }
        
        const amount = Math.abs(row.castka);
        const type = row.typ;
        
        // Calculate Investice value (Autoinvestice + Investice - Odstoupení - Vrácení peněz)
        if (type === 'Autoinvestice' || type === 'Investice') {
            projectTopData[row.projekt].investiceValue += amount;
        } else if (type === 'Odstoupení' || type === 'Vrácení peněz') {
            projectTopData[row.projekt].investiceValue -= amount;
        }
        
        // Calculate Splaceno value (Částečné splacení jistiny + Splacení jistiny)
        if (type === 'Částečné splacení jistiny' || type === 'Splacení jistiny') {
            projectTopData[row.projekt].splacenoValue += amount;
        }
        
        // Calculate net investment (for display purposes)
        if (type === 'Autoinvestice' || type === 'Investice') {
            projectTopData[row.projekt].netInvestment += amount;
        } else if (type === 'Prodej' || type === 'Částečné splacení jistiny' || 
                   type === 'Vrácení peněz' || type === 'Odstoupení') {
            projectTopData[row.projekt].netInvestment -= amount;
        }
    });
    
    // Filter to show only active projects where Splaceno - Investice ≠ 0 and net investment > 0
    const validProjects = Object.entries(projectTopData)
        .filter(([projectName, data]) => {
            const difference = data.splacenoValue - data.investiceValue;
            const isActive = Math.abs(difference) >= 0.01; // Use small tolerance for floating point comparison
            const hasPositiveInvestment = data.netInvestment > 0;
            return isActive && hasPositiveInvestment;
        })
        .map(([projectName, data]) => [projectName, data.netInvestment])
        .sort(([,a], [,b]) => b - a)
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
                backgroundColor: colors.slice(0, validProjects.length),
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
                            // Use the stored full project names array to ensure correct mapping
                            const dataIndex = context[0].dataIndex;
                            return fullProjectNames[dataIndex];
                        },
                        label: function(context) {
                            const value = context.parsed.x;
                            return `Expozice: ${formatAmountWithOptionalDecimals(value).formattedAmount}`;
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
    
    // Calculate portfolio exposure using the same logic as statistics
    // Use raw signed values: investments (negative) - returns (positive) = exposure
    const projectExposures = {};
    
    // Calculate exposure for each project using signed values
    csvData.forEach(row => {
        if (!row.projekt || row.projekt.trim() === '') return;
        
        if (!projectExposures[row.projekt]) {
            projectExposures[row.projekt] = 0;
        }
        
        const rawAmount = row.castka; // Original signed value
        const type = row.typ;
        
        // Use raw signed values for proper exposure calculation
        if (type === 'Investice do příležitosti' || type === 'Autoinvestice' || type === 'Investice') {
            projectExposures[row.projekt] -= rawAmount; // Subtract negative = add positive
        }
        // Subtract returns and withdrawals (positive values)
        else if (type === 'Odstoupení' || type === 'Splacení jistiny' || 
                 type === 'Vrácení peněz' || type === 'Částečné splacení jistiny' || type === 'Prodej') {
            projectExposures[row.projekt] -= rawAmount; // Subtract positive values
        }
    });
    
    // Apply rounding to avoid floating point precision issues
    Object.entries(projectExposures).forEach(([project, exposure]) => {
        const roundedExposure = Math.round(exposure * 100) / 100;
        projectExposures[project] = roundedExposure;
    });
    
    console.log("DEBUG: Chart - Project Exposures:", projectExposures);
    
    // Filter to show only projects with positive exposure (same logic as statistics)
    const validProjects = Object.entries(projectExposures)
        .filter(([projectName, exposure]) => exposure > 0)
        .map(([projectName, exposure]) => [projectName, exposure])
        .sort(([,a], [,b]) => b - a);
    
    console.log("DEBUG: Chart - Valid Projects:", validProjects);
    console.log("DEBUG: Chart - Valid Projects Count:", validProjects.length);
    
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
                                `Expozice: ${formatAmountWithOptionalDecimals(value).formattedAmount}`,
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
        if (row.typ === 'Investice' || row.typ === 'Autoinvestice' || row.typ === 'Nabídka ke koupi') {
            amountClass = 'amount-investment';
        }
        
        return `
        <tr>
            <td>${locale.formatDate(row.datum)}</td>
            <td>${row.typ}</td>
            <td title="${row.detail}">${row.detail.length > 50 ? row.detail.substring(0, 50) + '...' : row.detail}</td>
            <td class="${amountClass}">${formatAmountWithOptionalDecimals(row.castka).formattedAmount}</td>
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

// Monthly table variables and functions
let monthlyTableSortField = 'mesic';
let monthlyTableSortDirection = 'desc';

// Monthly table pagination state
let monthlyTablePagination = {
    currentPage: 1,
    itemsPerPage: 10
};
let allMonthlyData = [];
let currentPeriodMode = 'monthly'; // 'monthly' or 'yearly'

function calculateMonthlyData() {
    const monthlyData = {};
    
    // Process each transaction and group by month
    csvData.forEach(row => {
        const monthKey = `${row.datum.getFullYear()}-${String(row.datum.getMonth() + 1).padStart(2, '0')}`;
        const displayMonth = `${String(row.datum.getMonth() + 1).padStart(2, '0')}/${String(row.datum.getFullYear()).slice(-2)}`;
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                mesic: displayMonth,
                yearMonth: monthKey, // For sorting
                investice: 0,
                vynosy: 0,
                splaceno: 0,
                prodeje: 0,
                marketingove_odmeny: 0,
                poplatky: 0,
                vklady: 0,
                vybery: 0,
                zisk: 0,
                zmena_procenta: null
            };
        }
        
        const amount = Math.abs(row.castka);
        
        // Investice = Autoinvestice + Investice - Odstoupení - Vrácení peněz
        if (row.typ === 'Autoinvestice' || row.typ === 'Investice') {
            monthlyData[monthKey].investice += amount;
        } else if (row.typ === 'Odstoupení' || row.typ === 'Vrácení peněz') {
            monthlyData[monthKey].investice -= amount;
        }
        
        // Výnosy = Výnos + Bonusový výnos + Zákonné úroky z prodlení + Smluvní pokuta
        else if (row.typ === 'Výnos' || 
                 row.typ === 'Bonusový výnos' || 
                 row.typ === 'Zákonné úroky z prodlení' || 
                 row.typ === 'Smluvní pokuta') {
            monthlyData[monthKey].vynosy += amount;
        }
        
        // Splaceno = Splacení jistiny + Částečné splacení jistiny
        else if (row.typ === 'Splacení jistiny' || 
                 row.typ === 'Částečné splacení jistiny') {
            monthlyData[monthKey].splaceno += amount;
        }
        
        // Prodeje = Prodej
        else if (row.typ === 'Prodej') {
            monthlyData[monthKey].prodeje += amount;
        }
        
        // Marketingové odměny = Odměna + Mimořádný příjem
        else if (row.typ === 'Odměna' || row.typ === 'Mimořádný příjem') {
            monthlyData[monthKey].marketingove_odmeny += amount;
        }
        
        // Poplatky = Poplatek za předčasný prodej + Poplatek za výběr
        else if (row.typ === 'Poplatek za předčasný prodej' || 
                 row.typ === 'Poplatek za výběr') {
            monthlyData[monthKey].poplatky += amount;
        }
        
        // Vklady = Vklad peněz
        else if (row.typ === 'Vklad peněz') {
            monthlyData[monthKey].vklady += amount;
        }
        
        // Výběry = Výběr peněz
        else if (row.typ === 'Výběr peněz') {
            monthlyData[monthKey].vybery += amount;
        }
    });
    
    // Calculate zisk for each month: Výnosy + Odměny - Poplatky
    Object.values(monthlyData).forEach(month => {
        month.zisk = month.vynosy + month.marketingove_odmeny - month.poplatky;
    });
    
    // Convert to array and sort by month for percentage calculation
    const monthlyArray = Object.values(monthlyData).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    
    // Calculate percentage change for each month
    for (let i = 1; i < monthlyArray.length; i++) {
        const currentMonth = monthlyArray[i];
        const previousMonth = monthlyArray[i - 1];
        
        if (previousMonth.zisk !== 0) {
            currentMonth.zmena_procenta = ((currentMonth.zisk - previousMonth.zisk) / Math.abs(previousMonth.zisk)) * 100;
        } else if (currentMonth.zisk !== 0) {
            // If previous month was 0 but current is not, it's infinite growth - show as 100%
            currentMonth.zmena_procenta = currentMonth.zisk > 0 ? 100 : -100;
        } else {
            currentMonth.zmena_procenta = 0;
        }
    }
    
    // Filter out months with no significant activity
    return monthlyArray.filter(month => 
        month.investice !== 0 || month.vynosy !== 0 || month.splaceno !== 0 || 
        month.prodeje !== 0 || month.marketingove_odmeny !== 0 || month.poplatky !== 0 ||
        month.zisk !== 0 || month.vklady !== 0 || month.vybery !== 0
    );
}

function calculateYearlyData() {
    const yearlyData = {};
    
    // Process each transaction and group by year
    csvData.forEach(row => {
        const yearKey = row.datum.getFullYear().toString();
        const displayYear = yearKey;
        
        if (!yearlyData[yearKey]) {
            yearlyData[yearKey] = {
                mesic: displayYear,
                yearMonth: yearKey, // For sorting
                investice: 0,
                vynosy: 0,
                splaceno: 0,
                prodeje: 0,
                marketingove_odmeny: 0,
                poplatky: 0,
                vklady: 0,
                vybery: 0,
                zisk: 0,
                zmena_procenta: null
            };
        }
        
        const amount = Math.abs(row.castka);
        
        // Investice = Autoinvestice + Investice - Odstoupení - Vrácení peněz
        if (row.typ === 'Autoinvestice' || row.typ === 'Investice') {
            yearlyData[yearKey].investice += amount;
        } else if (row.typ === 'Odstoupení' || row.typ === 'Vrácení peněz') {
            yearlyData[yearKey].investice -= amount;
        }
        
        // Výnosy = Výnos + Bonusový výnos + Zákonné úroky z prodlení + Smluvní pokuta
        else if (row.typ === 'Výnos' || 
                 row.typ === 'Bonusový výnos' || 
                 row.typ === 'Zákonné úroky z prodlení' || 
                 row.typ === 'Smluvní pokuta') {
            yearlyData[yearKey].vynosy += amount;
        }
        
        // Splaceno = Splacení jistiny + Částečné splacení jistiny
        else if (row.typ === 'Splacení jistiny' || 
                 row.typ === 'Částečné splacení jistiny') {
            yearlyData[yearKey].splaceno += amount;
        }
        
        // Prodeje = Prodej
        else if (row.typ === 'Prodej') {
            yearlyData[yearKey].prodeje += amount;
        }
        
        // Marketingové odměny = Odměna + Mimořádný příjem
        else if (row.typ === 'Odměna' || row.typ === 'Mimořádný příjem') {
            yearlyData[yearKey].marketingove_odmeny += amount;
        }
        
        // Poplatky = Poplatek za předčasný prodej + Poplatek za výběr
        else if (row.typ === 'Poplatek za předčasný prodej' || 
                 row.typ === 'Poplatek za výběr') {
            yearlyData[yearKey].poplatky += amount;
        }
        
        // Vklady = Vklad peněz
        else if (row.typ === 'Vklad peněz') {
            yearlyData[yearKey].vklady += amount;
        }
        
        // Výběry = Výběr peněz
        else if (row.typ === 'Výběr peněz') {
            yearlyData[yearKey].vybery += amount;
        }
    });
    
    // Calculate zisk for each year: Výnosy + Odměny - Poplatky
    Object.values(yearlyData).forEach(year => {
        year.zisk = year.vynosy + year.marketingove_odmeny - year.poplatky;
    });
    
    // Convert to array and sort by year for percentage calculation
    const yearlyArray = Object.values(yearlyData).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    
    // Calculate percentage change for each year
    for (let i = 1; i < yearlyArray.length; i++) {
        const currentYear = yearlyArray[i];
        const previousYear = yearlyArray[i - 1];
        
        if (previousYear.zisk !== 0) {
            currentYear.zmena_procenta = ((currentYear.zisk - previousYear.zisk) / Math.abs(previousYear.zisk)) * 100;
        } else if (currentYear.zisk !== 0) {
            // If previous year was 0 but current is not, it's infinite growth - show as 100%
            currentYear.zmena_procenta = currentYear.zisk > 0 ? 100 : -100;
        } else {
            currentYear.zmena_procenta = 0;
        }
    }
    
    // Filter out years with no significant activity
    return yearlyArray.filter(year => 
        year.investice !== 0 || year.vynosy !== 0 || year.splaceno !== 0 || 
        year.prodeje !== 0 || year.marketingove_odmeny !== 0 || year.poplatky !== 0 ||
        year.zisk !== 0 || year.vklady !== 0 || year.vybery !== 0
    );
}

function createMonthlyTable() {
    if (currentPeriodMode === 'monthly') {
    allMonthlyData = calculateMonthlyData();
    } else {
        allMonthlyData = calculateYearlyData();
    }
    allMonthlyData = sortMonthlyData(allMonthlyData);
    updateMonthlyTable();
}

function sortMonthlyData(data) {
    return [...data].sort((a, b) => {
        const field = monthlyTableSortField;
        let comparison = 0;
        
        if (field === 'mesic') {
            // Sort by yearMonth for proper chronological order
            comparison = a.yearMonth.localeCompare(b.yearMonth);
        } else {
            comparison = a[field] - b[field];
        }
        
        return monthlyTableSortDirection === 'asc' ? comparison : -comparison;
    });
}

function updateMonthlyTable() {
    const tableBody = document.getElementById('monthly-table-body');
    
    if (allMonthlyData.length === 0) {
        const emptyMessage = currentPeriodMode === 'monthly' ? 'Žádné měsíční data nenalezena' : 'Žádné roční data nenalezena';
        tableBody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 20px; color: #666;">${emptyMessage}</td></tr>`;
        updateMonthlyTablePagination();
        return;
    }
    
    // Paginate the data
    const paginatedData = paginateMonthlyData(allMonthlyData);
    
    tableBody.innerHTML = paginatedData.map(month => {
        const investiceFormatted = formatAmountWithOptionalDecimals(month.investice);
        const vynosyFormatted = formatAmountWithOptionalDecimals(month.vynosy);
        const splacenoFormatted = formatAmountWithOptionalDecimals(month.splaceno);
        const prodejeFormatted = formatAmountWithOptionalDecimals(month.prodeje);
        const marketingovyFormatted = formatAmountWithOptionalDecimals(month.marketingove_odmeny);
        const poplatkyFormatted = formatAmountWithOptionalDecimals(month.poplatky);
        const vkladyFormatted = formatAmountWithOptionalDecimals(month.vklady);
        const vyberyFormatted = formatAmountWithOptionalDecimals(month.vybery);
        const ziskFormatted = formatAmountWithOptionalDecimals(month.zisk);
        const zmenaFormatted = formatPercentageChange(month.zmena_procenta);
        
        // Set poplatky to red if not zero
        const poplatkyClassName = Math.abs(month.poplatky) > 0.01 ? 'amount-negative' : poplatkyFormatted.className;
        
        return `
            <tr>
                <td>${month.mesic}</td>
                <td class="${investiceFormatted.className}">${investiceFormatted.formattedAmount}</td>
                <td class="${vynosyFormatted.className}">${vynosyFormatted.formattedAmount}</td>
                <td class="${splacenoFormatted.className}">${splacenoFormatted.formattedAmount}</td>
                <td class="${prodejeFormatted.className}">${prodejeFormatted.formattedAmount}</td>
                <td class="${marketingovyFormatted.className}">${marketingovyFormatted.formattedAmount}</td>
                <td class="${poplatkyClassName}">${poplatkyFormatted.formattedAmount}</td>
                <td class="${vkladyFormatted.className}">${vkladyFormatted.formattedAmount}</td>
                <td class="${vyberyFormatted.className}">${vyberyFormatted.formattedAmount}</td>
                <td class="${ziskFormatted.className}">${ziskFormatted.formattedAmount}</td>
                <td class="${zmenaFormatted.className}">${zmenaFormatted.formattedValue}</td>
            </tr>
        `;
    }).join('');
    
    // Update sort indicators
    updateMonthlySortIndicators(monthlyTableSortField);
    
    // Update pagination
    updateMonthlyTablePagination();
}

function updateMonthlySortIndicators(field) {
    // Update header indicators - only target sort icons (not info-circle icons)
    const headers = document.querySelectorAll('#monthly-table th[data-sort] i.fa-sort, #monthly-table th[data-sort] i.fa-sort-up, #monthly-table th[data-sort] i.fa-sort-down');
    headers.forEach(icon => {
        icon.className = 'fas fa-sort';
    });
    
    // Find the sort icon for the current field (last <i> element in the header)
    const currentHeaderCell = document.querySelector(`#monthly-table th[data-sort="${field}"]`);
    if (currentHeaderCell) {
        const sortIcon = currentHeaderCell.querySelector('i:last-child');
        if (sortIcon) {
            sortIcon.className = monthlyTableSortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
        }
    }
}

function paginateMonthlyData(data) {
    const startIndex = (monthlyTablePagination.currentPage - 1) * monthlyTablePagination.itemsPerPage;
    const endIndex = startIndex + monthlyTablePagination.itemsPerPage;
    return data.slice(startIndex, endIndex);
}

function updateMonthlyTablePagination() {
    const totalItems = allMonthlyData.length;
    const totalPages = Math.ceil(totalItems / monthlyTablePagination.itemsPerPage);
    const currentPage = monthlyTablePagination.currentPage;
    
    const paginationInfo = document.querySelector('#monthly-table-pagination .pagination-info');
    const paginationControls = document.querySelector('#monthly-table-pagination .pagination-controls');
    
    if (totalItems === 0) {
        paginationInfo.innerHTML = '';
        paginationControls.innerHTML = '';
        return;
    }
    
    const startItem = (currentPage - 1) * monthlyTablePagination.itemsPerPage + 1;
    const endItem = Math.min(currentPage * monthlyTablePagination.itemsPerPage, totalItems);
    
    paginationInfo.innerHTML = `Zobrazeno ${startItem}-${endItem} z ${totalItems} měsíců`;
    
    paginationControls.innerHTML = `
        <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changeMonthlyPage(${currentPage - 1})">
            <i class="fas fa-chevron-left"></i>
        </button>
        ${generateMonthlyPageNumbers(currentPage, totalPages)}
        <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changeMonthlyPage(${currentPage + 1})">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
}

function generateMonthlyPageNumbers(currentPage, totalPages) {
    let pages = '';
    const maxVisible = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        pages += `
            <button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changeMonthlyPage(${i})">
                ${i}
            </button>
        `;
    }
    
    return pages;
}

function changeMonthlyPage(page) {
    const totalPages = Math.ceil(allMonthlyData.length / monthlyTablePagination.itemsPerPage);
    if (page >= 1 && page <= totalPages) {
        monthlyTablePagination.currentPage = page;
        updateMonthlyTable();
    }
}

// Debounced sort function to prevent rapid clicking issues
const debouncedSortMonthlyTable = debounce(function(field) {
    // Toggle direction if same field
    if (monthlyTableSortField === field) {
        monthlyTableSortDirection = monthlyTableSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        monthlyTableSortField = field;
        // Default direction depends on field type
        monthlyTableSortDirection = field === 'mesic' ? 'desc' : 'desc';
    }
    
    // Update header indicators
    updateMonthlySortIndicators(field);
    
    // Reset to first page when sorting changes
    monthlyTablePagination.currentPage = 1;
    
    // Sort existing data instead of recalculating everything
    if (allMonthlyData.length > 0) {
        allMonthlyData = sortMonthlyData(allMonthlyData);
        updateMonthlyTable();
    }
}, 100);

function handleMonthlyTableSort(field) {
    debouncedSortMonthlyTable(field);
}

function handleMonthlyTableRowsChange(event) {
    const newItemsPerPage = parseInt(event.target.value);
    monthlyTablePagination.itemsPerPage = newItemsPerPage;
    monthlyTablePagination.currentPage = 1; // Reset to first page
    updateMonthlyTable();
}

function switchPeriodMode(mode) {
    if (mode === currentPeriodMode) return;
    
    currentPeriodMode = mode;
    
    // Update UI elements
    updatePeriodUI();
    
    // Reset pagination to first page
    monthlyTablePagination.currentPage = 1;
    
    // Recreate table with new data
    createMonthlyTable();
}

function updatePeriodUI() {
    // Update toggle buttons
    document.querySelectorAll('.period-toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-period="${currentPeriodMode}"]`).classList.add('active');
    
    // Update title and tooltip
    const title = document.getElementById('period-stats-title');
    const tooltip = document.getElementById('period-stats-tooltip');
    const columnHeader = document.getElementById('period-column-header');
    
    if (currentPeriodMode === 'monthly') {
        title.textContent = 'Měsíční statistiky';
        columnHeader.textContent = 'Měsíc';
        tooltip.innerHTML = `Měsíční souhrn všech transakcí s výpočty:<br/><br/>
<strong>Investice:</strong> Autoinvestice + Investice - Odstoupení - Vrácení peněz<br/><br/>
<strong>Výnosy:</strong> Výnos + Bonusový výnos + Zákonné úroky z prodlení + Smluvní pokuta<br/><br/>
<strong>Splaceno:</strong> Splacení jistiny + Částečné splacení jistiny<br/><br/>
<strong>Prodeje:</strong> Prodej<br/><br/>
<strong>Odměny:</strong> Odměna + Mimořádný příjem<br/><br/>
<strong>Poplatky:</strong> Poplatek za předčasný prodej + Poplatek za výběr<br/><br/>
<strong>Vklady:</strong> Vklad peněz<br/><br/>
<strong>Výběry:</strong> Výběr peněz<br/><br/>
<strong>Zisk:</strong> Výnosy + Odměny - Poplatky<br/><br/>
<strong>% změna:</strong> Procentuální změna zisku oproti předchozímu měsíci`;
    } else {
        title.textContent = 'Roční statistiky';
        columnHeader.textContent = 'Rok';
        tooltip.innerHTML = `Roční souhrn všech transakcí s výpočty:<br/><br/>
<strong>Investice:</strong> Autoinvestice + Investice - Odstoupení - Vrácení peněz<br/><br/>
<strong>Výnosy:</strong> Výnos + Bonusový výnos + Zákonné úroky z prodlení + Smluvní pokuta<br/><br/>
<strong>Splaceno:</strong> Splacení jistiny + Částečné splacení jistiny<br/><br/>
<strong>Prodeje:</strong> Prodej<br/><br/>
<strong>Odměny:</strong> Odměna + Mimořádný příjem<br/><br/>
<strong>Poplatky:</strong> Poplatek za předčasný prodej + Poplatek za výběr<br/><br/>
<strong>Vklady:</strong> Vklad peněz<br/><br/>
<strong>Výběry:</strong> Výběr peněz<br/><br/>
<strong>Zisk:</strong> Výnosy + Odměny - Poplatky<br/><br/>
<strong>% změna:</strong> Procentuální změna zisku oproti předchozímu roku`;
    }
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
    
    // Only update elements that exist in the DOM
    const investmentStreakEl = document.getElementById('investment-streak');
    if (investmentStreakEl) {
        investmentStreakEl.textContent = stats.investmentStreak + ' dnů';
    }
    
    const seasonalPatternEl = document.getElementById('seasonal-pattern');
    if (seasonalPatternEl) {
        seasonalPatternEl.textContent = stats.seasonalPattern;
    }
    
    const investmentConcentrationEl = document.getElementById('investment-concentration');
    if (investmentConcentrationEl) {
        investmentConcentrationEl.textContent = stats.concentrationPercentage + '%';
    }
    
    const avgDaysBetweenEl = document.getElementById('avg-days-between');
    if (avgDaysBetweenEl) {
        avgDaysBetweenEl.textContent = Math.round(stats.avgDaysBetween);
    }
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
    const formattedAmount = formatAmountWithOptionalDecimals(amount).formattedAmount;
    const className = Math.abs(amount) < 0.01 ? 'amount-zero' : 
                     (amount >= 0 ? 'amount-positive' : 'amount-negative');
    return { formattedAmount, className };
}

function formatAmountWithOptionalDecimals(amount) {
    // Round to 2 decimal places first to avoid floating point precision issues
    const roundedAmount = Math.round(amount * 100) / 100;
    
    // Check if it's a whole number (no significant decimals)
    if (Math.abs(roundedAmount - Math.round(roundedAmount)) < 0.01) {
        // It's a whole number, show no decimals
        const formattedAmount = new Intl.NumberFormat('cs-CZ', {
            style: 'currency',
            currency: 'CZK',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(Math.round(roundedAmount));
        
        const className = Math.abs(amount) < 0.01 ? 'amount-zero' : 
                         (amount >= 0 ? 'amount-positive' : 'amount-negative');
        return { formattedAmount, className };
    }
    
    // Check if it's a round tenth (like 85.4)
    const roundedToOneDec = Math.round(roundedAmount * 10) / 10;
    if (Math.abs(roundedAmount - roundedToOneDec) < 0.01) {
        // It's a round tenth, show 1 decimal
        const formattedAmount = new Intl.NumberFormat('cs-CZ', {
            style: 'currency',
            currency: 'CZK',
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }).format(roundedToOneDec);
        
        const className = Math.abs(amount) < 0.01 ? 'amount-zero' : 
                         (amount >= 0 ? 'amount-positive' : 'amount-negative');
        return { formattedAmount, className };
    }
    
    // Otherwise, show 2 decimals
    const formattedAmount = new Intl.NumberFormat('cs-CZ', {
        style: 'currency',
        currency: 'CZK',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(roundedAmount);
    
    const className = Math.abs(amount) < 0.01 ? 'amount-zero' : 
                     (amount >= 0 ? 'amount-positive' : 'amount-negative');
    return { formattedAmount, className };
}

function formatPercentageChange(percentage) {
    if (percentage === null || percentage === undefined) {
        return { 
            formattedValue: '<span style="color: #666;">—</span>', 
            className: 'amount-neutral' 
        };
    }
    
    const absPercentage = Math.abs(percentage);
    let className, icon, color;
    
    if (percentage > 0) {
        className = 'amount-positive';
        icon = '<i class="fas fa-arrow-up" style="margin-right: 4px;"></i>';
        color = '#10b981'; // Green
    } else if (percentage < 0) {
        className = 'amount-negative';
        icon = '<i class="fas fa-arrow-down" style="margin-right: 4px;"></i>';
        color = '#ef4444'; // Red
    } else {
        className = 'amount-neutral';
        icon = '';
        color = '#666';
    }
    
    const formattedValue = `<span style="color: ${color};">${icon}${absPercentage.toFixed(1)}%</span>`;
    
    return { formattedValue, className };
}

function setStatValueWithZeroClass(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = formatAmountWithOptionalDecimals(value).formattedAmount;
        // Add or remove zero class
        if (Math.abs(value) < 0.01) {
            element.classList.add('amount-zero');
        } else {
            element.classList.remove('amount-zero');
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
    let lastScrollY = window.scrollY;
    const header = document.querySelector('.dashboard-header');
    
    if (!header) return;
    
    const throttledScroll = debounce(() => {
        const currentScrollY = window.scrollY;
        
        if (currentScrollY > lastScrollY && currentScrollY > 100) {
            // Scrolling down & past threshold
            header.style.transform = 'translateY(-100%)';
        } else {
            // Scrolling up or at top
            header.style.transform = 'translateY(0)';
        }
        
        lastScrollY = currentScrollY;
    }, 10);
    
    window.addEventListener('scroll', throttledScroll);
}

// Timeline state
let timelineState = {
    currentPage: 0,
    pagesData: [],
    filteredTransactions: [],
    monthsPerPage: 4, // Default zoom level (can be 1-12)
    filters: {
        selectedProject: '',
        selectedTransactionTypes: []
    }
};

// Timeline functionality
function createTimeline() {
    console.log('Creating timeline with data:', filteredData.length, 'transactions');
    const timelineContainer = document.getElementById('timeline-container');
    if (!timelineContainer) {
        console.error('Timeline container not found');
        return;
    }
    if (!filteredData.length) {
        console.log('No filtered data available for timeline');
        timelineContainer.innerHTML = '<div class="timeline-empty">Žádná data k zobrazení</div>';
            return;
        }
        
    // Filter using timeline filters
    const allowedTypes = ['Investice', 'Autoinvestice', 'Prodej', 'Odstoupení', 'Vklad peněz', 'Výběr peněz', 'Vrácení peněz'];
    const timelineTransactions = filteredData.filter(transaction => {
        // Transaction type filter - if no types selected, show all allowed types
        const typeFilter = timelineState.filters.selectedTransactionTypes.length > 0 
            ? timelineState.filters.selectedTransactionTypes.includes(transaction.typ)
            : allowedTypes.includes(transaction.typ);
        
        // Project filter
        const projectFilter = timelineState.filters.selectedProject === '' || 
            transaction.projekt === timelineState.filters.selectedProject;
        
        return typeFilter && projectFilter;
    });
    
    console.log('Filtered timeline transactions:', timelineTransactions.length);
    
    if (timelineTransactions.length === 0) {
        timelineContainer.innerHTML = '<div class="timeline-empty">Žádné relevantní transakce k zobrazení</div>';
        return;
    }
    
    // Sort transactions by date (oldest first for horizontal timeline)
    timelineState.filteredTransactions = timelineTransactions.sort((a, b) => a.datum - b.datum);
    
    // Group transactions into 4-month pages
    createTimelinePages();
    
    // Set to last page (most recent transactions)
    timelineState.currentPage = Math.max(0, timelineState.pagesData.length - 1);
    
    // Render timeline with pagination
    renderTimelinePage();
}

function createTimelinePages() {
    if (timelineState.filteredTransactions.length === 0) return;
    
    // Get date range
    const firstDate = timelineState.filteredTransactions[0].datum;
    const lastDate = timelineState.filteredTransactions[timelineState.filteredTransactions.length - 1].datum;
    
    // Use the zoom level from state
    const monthsPerPage = timelineState.monthsPerPage;
    
    // Create month periods
    timelineState.pagesData = [];
    let currentDate = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
    const endDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 0);
    
    while (currentDate <= endDate) {
        const pageStartDate = new Date(currentDate);
        const pageEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + monthsPerPage, 0);
        
        // Filter transactions for this period
        const pageTransactions = timelineState.filteredTransactions.filter(transaction => {
            return transaction.datum >= pageStartDate && transaction.datum <= pageEndDate;
        });
        
        if (pageTransactions.length > 0) {
            timelineState.pagesData.push({
                startDate: pageStartDate,
                endDate: pageEndDate,
                transactions: pageTransactions,
                label: formatPageLabel(pageStartDate, pageEndDate)
            });
        }
        
        // Move to next period
        currentDate.setMonth(currentDate.getMonth() + monthsPerPage);
    }
    
    console.log('Created', timelineState.pagesData.length, 'timeline pages');
}

function formatPageLabel(startDate, endDate) {
    const monthNames = [
        'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
        'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'
    ];
    
    const startMonthName = monthNames[startDate.getMonth()];
    const startYear = startDate.getFullYear();
    const endMonthName = monthNames[endDate.getMonth()];
    const endYear = endDate.getFullYear();
    
    // If it's a single month (same month and year), show only one month
    if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
        return `${startMonthName} ${startYear}`;
    }
    
    return `${startMonthName} ${startYear} - ${endMonthName} ${endYear}`;
}

function renderTimelinePage() {
    const timelineContainer = document.getElementById('timeline-container');
    timelineContainer.innerHTML = '';
    
    if (timelineState.pagesData.length === 0) {
        timelineContainer.innerHTML = '<div class="timeline-empty">Žádné relevantní transakce k zobrazení</div>';
        return;
    }
    
    const currentPageData = timelineState.pagesData[timelineState.currentPage];
    
    // Create timeline wrapper
    const timelineWrapper = document.createElement('div');
    timelineWrapper.className = 'timeline-paged';
    
    // Create navigation header
    const timelineHeader = document.createElement('div');
    timelineHeader.className = 'timeline-header';
    
    // Navigation controls (left side)
    const navControls = document.createElement('div');
    navControls.className = 'timeline-nav-controls';
    
    const navButtons = document.createElement('div');
    navButtons.className = 'timeline-nav-buttons';
    
    const prevButton = document.createElement('button');
    prevButton.className = 'timeline-nav-btn timeline-nav-prev';
    prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevButton.disabled = timelineState.currentPage === 0;
    prevButton.addEventListener('click', () => navigateTimeline(-1));
    
    const nextButton = document.createElement('button');
    nextButton.className = 'timeline-nav-btn timeline-nav-next';
    nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextButton.disabled = timelineState.currentPage === timelineState.pagesData.length - 1;
    nextButton.addEventListener('click', () => navigateTimeline(1));
    
    navButtons.appendChild(prevButton);
    navButtons.appendChild(nextButton);
    
    // Add filter button to navigation buttons
    const filterButton = document.createElement('button');
    filterButton.className = 'btn btn-secondary timeline-filter-btn';
    filterButton.innerHTML = '<i class="fas fa-filter"></i> Filtrace';
    filterButton.title = 'Filtrace časové osy';
    filterButton.addEventListener('click', openTimelineFilterModal);
    navButtons.appendChild(filterButton);
    
    const pageCounter = document.createElement('div');
    pageCounter.className = 'timeline-page-counter';
    pageCounter.textContent = `${timelineState.currentPage + 1} / ${timelineState.pagesData.length}`;
    
    navControls.appendChild(navButtons);
    navControls.appendChild(pageCounter);
    
    const pageInfo = document.createElement('div');
    pageInfo.className = 'timeline-page-info';
    pageInfo.innerHTML = `
        <div class="timeline-period-label">${currentPageData.label}</div>
    `;
    
    // Filter controls moved to navigation buttons
    
    // Zoom controls (right side)
    const zoomControls = document.createElement('div');
    zoomControls.className = 'timeline-zoom-controls';
    
    const zoomButtons = document.createElement('div');
    zoomButtons.className = 'timeline-zoom-buttons';
    
    const zoomOutButton = document.createElement('button');
    zoomOutButton.className = 'timeline-nav-btn timeline-zoom-out';
    zoomOutButton.innerHTML = '<i class="fas fa-minus"></i>';
    zoomOutButton.title = 'Zobrazit více měsíců (zoom out)';
    zoomOutButton.disabled = timelineState.monthsPerPage >= 12;
    zoomOutButton.addEventListener('click', () => adjustTimelineZoom(1));
    
    const zoomInButton = document.createElement('button');
    zoomInButton.className = 'timeline-nav-btn timeline-zoom-in';
    zoomInButton.innerHTML = '<i class="fas fa-plus"></i>';
    zoomInButton.title = 'Zobrazit méně měsíců (zoom in)';
    zoomInButton.disabled = timelineState.monthsPerPage <= 1;
    zoomInButton.addEventListener('click', () => adjustTimelineZoom(-1));
    
    zoomButtons.appendChild(zoomOutButton);
    zoomButtons.appendChild(zoomInButton);
    
    const zoomInfo = document.createElement('div');
    zoomInfo.className = 'timeline-zoom-info';
    zoomInfo.textContent = `${timelineState.monthsPerPage} ${timelineState.monthsPerPage === 1 ? 'měsíc' : timelineState.monthsPerPage <= 4 ? 'měsíce' : 'měsíců'}`;
    
    zoomControls.appendChild(zoomButtons);
    zoomControls.appendChild(zoomInfo);
    
    timelineHeader.appendChild(navControls);
    timelineHeader.appendChild(pageInfo);
    timelineHeader.appendChild(zoomControls);
    
    // Create timeline track
    const timelineTrack = document.createElement('div');
    timelineTrack.className = 'timeline-track';
    
    // Create timeline line
    const timelineLine = document.createElement('div');
    timelineLine.className = 'timeline-line-horizontal';
    timelineTrack.appendChild(timelineLine);
    
    // Create month labels container
    const monthLabelsContainer = document.createElement('div');
    monthLabelsContainer.className = 'timeline-month-labels';
    
    // Generate month labels for the period
    const startDate = new Date(currentPageData.startDate);
    const endDate = new Date(currentPageData.endDate);
    
    let currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const periodEnd = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
    
    while (currentMonth <= periodEnd) {
        const monthLabel = document.createElement('div');
        monthLabel.className = 'timeline-month-label';
        
        // Calculate position of this month within the period
        const monthPosition = ((currentMonth.getTime() - currentPageData.startDate.getTime()) / 
                             (currentPageData.endDate.getTime() - currentPageData.startDate.getTime())) * 100;
        
        monthLabel.style.left = `${Math.max(0, Math.min(100, monthPosition))}%`;
        monthLabel.textContent = `${(currentMonth.getMonth() + 1).toString().padStart(2, '0')}/${currentMonth.getFullYear().toString().slice(-2)}`;
        
        monthLabelsContainer.appendChild(monthLabel);
        
        // Move to next month
        currentMonth.setMonth(currentMonth.getMonth() + 1);
    }
    
    timelineTrack.appendChild(monthLabelsContainer);
    
    // Create events container
    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'timeline-events-horizontal';
    
    // Add events for current page with overlap detection
    const eventElements = currentPageData.transactions.map((transaction, index) => 
        createPagedTimelineEvent(transaction, index, currentPageData)
    );
    
    // Handle overlapping events by stacking them vertically
    handleEventOverlaps(eventElements);
    
    eventElements.forEach(eventElement => {
        eventsContainer.appendChild(eventElement);
    });
    
    timelineTrack.appendChild(eventsContainer);
    timelineWrapper.appendChild(timelineHeader);
    timelineWrapper.appendChild(timelineTrack);
    timelineContainer.appendChild(timelineWrapper);
    
    console.log('Rendered timeline page', timelineState.currentPage + 1, 'with', currentPageData.transactions.length, 'events');
}

function navigateTimeline(direction) {
    const newPage = timelineState.currentPage + direction;
    if (newPage >= 0 && newPage < timelineState.pagesData.length) {
        timelineState.currentPage = newPage;
        renderTimelinePage();
    }
}

function adjustTimelineZoom(direction) {
    const newMonthsPerPage = timelineState.monthsPerPage + direction;
    
    // Constrain zoom level between 1 and 12
    if (newMonthsPerPage >= 1 && newMonthsPerPage <= 12) {
        timelineState.monthsPerPage = newMonthsPerPage;
        
        // Recreate timeline pages with new zoom level
        createTimelinePages();
        
        // Try to stay on a similar time period by adjusting current page
        if (timelineState.pagesData.length > 0) {
            // Clamp current page to valid range
            timelineState.currentPage = Math.min(timelineState.currentPage, timelineState.pagesData.length - 1);
        }
        
        // Re-render timeline
        renderTimelinePage();
    }
}

function createPagedTimelineEvent(transaction, index, pageData) {
    const eventElement = document.createElement('div');
    eventElement.className = 'timeline-event-horizontal';
    
    // Calculate position based on date within the period
    const pageStartTime = pageData.startDate.getTime();
    const pageEndTime = pageData.endDate.getTime();
    const transactionTime = transaction.datum.getTime();
    
    const position = ((transactionTime - pageStartTime) / (pageEndTime - pageStartTime)) * 100;
    eventElement.style.left = `${Math.max(0, Math.min(100, position))}%`;
    
    // Store position and transaction data for overlap detection
    eventElement.dataset.position = position;
    eventElement.dataset.date = transaction.datum.toDateString();
    eventElement.transaction = transaction;
    
    // Get transaction type info
    const typeInfo = getTransactionTypeInfo(transaction.typ);
    
    // Create event marker (small dot)
    const eventMarker = document.createElement('div');
    eventMarker.className = `event-marker ${typeInfo.colorClass}`;
    eventMarker.innerHTML = `<i class="${typeInfo.icon}"></i>`;
    
    // Add tooltip functionality
    addHorizontalTimelineTooltip(eventElement, transaction);
    
    eventElement.appendChild(eventMarker);
    
    return eventElement;
}

function handleEventOverlaps(eventElements) {
    // Group events by date to detect same-day transactions
    const eventsByDate = {};
    
    eventElements.forEach(element => {
        const date = element.dataset.date;
        if (!eventsByDate[date]) {
            eventsByDate[date] = [];
        }
        eventsByDate[date].push(element);
    });
    
    // For each date with multiple events, create a small cluster
    Object.values(eventsByDate).forEach(dateEvents => {
        if (dateEvents.length > 1) {
            // Sort by transaction time if available, otherwise by type
            dateEvents.sort((a, b) => {
                const timeA = a.transaction.datum.getTime();
                const timeB = b.transaction.datum.getTime();
                if (timeA !== timeB) return timeA - timeB;
                return a.transaction.typ.localeCompare(b.transaction.typ);
            });
            
            // Create a small horizontal spread for same-day events
            const clusterWidth = Math.min(dateEvents.length * 8, 24); // Max 24px spread
            const startOffset = -clusterWidth / 2;
            
            dateEvents.forEach((element, index) => {
                if (index === 0) {
                    // First event stays at original position
                    element.style.zIndex = 15;
                } else {
                    // Subsequent events get slight horizontal offset and higher z-index
                    const offsetX = startOffset + (index * (clusterWidth / (dateEvents.length - 1)));
                    element.style.left = `calc(${element.dataset.position}% + ${offsetX}px)`;
                    element.style.zIndex = 15 + index;
                    element.classList.add('clustered-event');
                }
            });
        }
    });
}

function getTransactionTypeInfo(type) {
    const typeMap = {
        'Investice': { icon: 'fas fa-arrow-up', colorClass: 'investice' },
        'Autoinvestice': { icon: 'fas fa-sync-alt', colorClass: 'autoinvestice' },
        'Odstoupení': { icon: 'fas fa-sign-out-alt', colorClass: 'odstoupeni' },
        'Prodej': { icon: 'fas fa-handshake', colorClass: 'prodej' },
        'Vklad peněz': { icon: 'fas fa-plus', colorClass: 'vklad-penez' },
        'Výběr peněz': { icon: 'fas fa-minus', colorClass: 'vyber-penez' },
        'Vrácení peněz': { icon: 'fas fa-undo', colorClass: 'vyber-penez' }
    };
    
    return typeMap[type] || { icon: 'fas fa-circle', colorClass: 'investice' };
}

function calculatePortfolioSizeAtDate(targetDate) {
    // Get all transactions up to the target date, sorted by date
    const transactionsUpToDate = filteredData
        .filter(transaction => transaction.datum <= targetDate)
        .sort((a, b) => a.datum - b.datum);
    
    let portfolioSize = 0;
    
    // Calculate portfolio size using the same formula as in the portfolio chart
    transactionsUpToDate.forEach(transaction => {
        const amount = Math.abs(transaction.castka);
        const type = transaction.typ;
        
        // Apply portfolio calculation formula
        if (type === 'Autoinvestice' || type === 'Investice') {
            portfolioSize += amount;
        } else if (type === 'Prodej' || type === 'Částečné splacení jistiny' || 
                   type === 'Splacení jistiny' || type === 'Vrácení peněz' || type === 'Odstoupení') {
            portfolioSize -= amount;
        }
        // Other transaction types (Vklad peněz, Výběr peněz) don't affect portfolio size
    });
    
    return portfolioSize;
}

function addTransactionStatTooltip(element, transaction) {
    let tooltip = null;
    
    element.addEventListener('mouseenter', (e) => {
        // Get type information for the transaction
        const typeInfo = getTransactionTypeInfo(transaction.typ);
        
        // Create tooltip
        tooltip = document.createElement('div');
        tooltip.className = 'timeline-tooltip-horizontal';
        
        // Calculate portfolio size at the date of this transaction
        const portfolioSize = calculatePortfolioSizeAtDate(transaction.datum);
        
        let tooltipContent = `
            <div class="tooltip-header"><i class="${typeInfo.icon}"></i> ${transaction.typ}</div>
            <div class="tooltip-row"><strong>Datum:</strong> ${locale.formatDate(transaction.datum)}</div>
            <div class="tooltip-row"><strong>Částka:</strong> ${formatAmountWithOptionalDecimals(Math.abs(transaction.castka)).formattedAmount}</div>
            <div class="tooltip-row"><strong>Velikost portfolia:</strong> ${formatAmountWithOptionalDecimals(portfolioSize).formattedAmount}</div>
        `;
        
        if (transaction.projekt && transaction.projekt.trim()) {
            tooltipContent += `<div class="tooltip-row"><strong>Projekt:</strong> ${transaction.projekt}</div>`;
        }
        
        tooltip.innerHTML = tooltipContent;
        tooltip.style.position = 'fixed';
        tooltip.style.zIndex = '10000';
        tooltip.style.pointerEvents = 'none';
        
        document.body.appendChild(tooltip);
        
        // Position tooltip
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        // Position above the element by default
        let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
        let top = rect.top - tooltipRect.height - 15;
        
        // Adjust if tooltip goes off screen horizontally
        if (left < 10) {
            left = 10;
        } else if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }
        
        // If tooltip would go above viewport, show below instead
        if (top < 10) {
            top = rect.bottom + 15;
            tooltip.classList.add('tooltip-below');
        } else {
            tooltip.classList.remove('tooltip-below');
        }
        
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
        tooltip.style.visibility = 'visible';
        tooltip.style.opacity = '1';
    });
    
    element.addEventListener('mouseleave', () => {
        if (tooltip && tooltip.parentNode) {
            tooltip.style.opacity = '0';
            tooltip.style.visibility = 'hidden';
            setTimeout(() => {
                if (tooltip && tooltip.parentNode) {
                    tooltip.parentNode.removeChild(tooltip);
                }
                tooltip = null;
            }, 200);
        }
    });
}

function addHorizontalTimelineTooltip(element, transaction) {
    let tooltip = null;
    
    element.addEventListener('mouseenter', (e) => {
        // Get type information for the transaction
        const typeInfo = getTransactionTypeInfo(transaction.typ);
        
        // Create tooltip
        tooltip = document.createElement('div');
        tooltip.className = 'timeline-tooltip-horizontal';
        
        // Calculate portfolio size at the date of this transaction
        const portfolioSize = calculatePortfolioSizeAtDate(transaction.datum);
        
        let tooltipContent = `
            <div class="tooltip-header"><i class="${typeInfo.icon}"></i> ${transaction.typ}</div>
            <div class="tooltip-row"><strong>Datum:</strong> ${locale.formatDate(transaction.datum)}</div>
            <div class="tooltip-row"><strong>Částka:</strong> ${formatAmountWithOptionalDecimals(Math.abs(transaction.castka)).formattedAmount}</div>
            <div class="tooltip-row"><strong>Velikost portfolia:</strong> ${formatAmountWithOptionalDecimals(portfolioSize).formattedAmount}</div>
        `;
        
        if (transaction.projekt && transaction.projekt.trim()) {
            tooltipContent += `<div class="tooltip-row"><strong>Projekt:</strong> ${transaction.projekt}</div>`;
        }
        
        tooltip.innerHTML = tooltipContent;
        tooltip.style.position = 'fixed';
        tooltip.style.zIndex = '10000';
        tooltip.style.pointerEvents = 'none';
        
        document.body.appendChild(tooltip);
        
        // Position tooltip
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        // Position above the event by default
        let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
        let top = rect.top - tooltipRect.height - 15;
        
        // Adjust if tooltip goes off screen horizontally
        if (left < 10) {
            left = 10;
        } else if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }
        
        // If tooltip would go above viewport, show below instead
        if (top < 10) {
            top = rect.bottom + 15;
            tooltip.classList.add('tooltip-below');
        } else {
            tooltip.classList.remove('tooltip-below');
        }
        
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
        tooltip.style.visibility = 'visible';
        tooltip.style.opacity = '1';
    });
    
    element.addEventListener('mouseleave', () => {
        if (tooltip && tooltip.parentNode) {
            tooltip.style.opacity = '0';
            tooltip.style.visibility = 'hidden';
            setTimeout(() => {
                if (tooltip && tooltip.parentNode) {
                    tooltip.parentNode.removeChild(tooltip);
                }
                tooltip = null;
            }, 200);
        }
    });
}

// Update timeline when data changes
function updateTimeline() {
    console.log('updateTimeline called');
    try {
        createTimeline();
    } catch (error) {
        console.error('Error creating timeline:', error);
        const timelineContainer = document.getElementById('timeline-container');
        if (timelineContainer) {
            timelineContainer.innerHTML = `<div class="timeline-empty">Chyba při vytváření časové osy: ${error.message}</div>`;
        }
    }
}

// Debug function for testing timeline
window.debugTimeline = function() {
    console.log('=== TIMELINE DEBUG ===');
    console.log('csvData length:', csvData.length);
    console.log('filteredData length:', filteredData.length);
    console.log('Timeline container exists:', !!document.getElementById('timeline-container'));
    console.log('Dashboard visible:', document.getElementById('dashboard').style.display !== 'none');
    console.log('Current zoom level:', timelineState.monthsPerPage);
    console.log('Timeline pages:', timelineState.pagesData.length);
    
    if (filteredData.length > 0) {
        console.log('Sample transaction:', filteredData[0]);
        console.log('Calling createTimeline...');
        createTimeline();
    } else {
        console.log('No filtered data available');
    }
};

// Debug function for testing zoom
window.debugTimelineZoom = function() {
    console.log('=== TIMELINE ZOOM DEBUG ===');
    console.log('Current zoom level:', timelineState.monthsPerPage);
    console.log('Pages:', timelineState.pagesData.length);
    console.log('Current page:', timelineState.currentPage);
}; 
// Mobile tooltip support
function initializeMobileTooltips() {
    const tooltips = document.querySelectorAll('.info-tooltip');
    let activeTooltip = null;
    
    tooltips.forEach(tooltip => {
        // Handle touch events for mobile
        tooltip.addEventListener('touchstart', function(e) {
            e.preventDefault(); // Prevent default touch behavior
            
            // Close any currently active tooltip
            if (activeTooltip && activeTooltip !== this) {
                activeTooltip.classList.remove('active');
            }
            
            // Toggle the clicked tooltip
            if (this.classList.contains('active')) {
                this.classList.remove('active');
                activeTooltip = null;
            } else {
                this.classList.add('active');
                activeTooltip = this;
            }
        });
        
        // Handle click events as fallback
        tooltip.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Close any currently active tooltip
            if (activeTooltip && activeTooltip !== this) {
                activeTooltip.classList.remove('active');
            }
            
            // Toggle the clicked tooltip
            if (this.classList.contains('active')) {
                this.classList.remove('active');
                activeTooltip = null;
            } else {
                this.classList.add('active');
                activeTooltip = this;
            }
        });
    });
    
    // Close tooltip when clicking outside
    document.addEventListener('touchstart', function(e) {
        if (activeTooltip && !activeTooltip.contains(e.target)) {
            activeTooltip.classList.remove('active');
            activeTooltip = null;
        }
    });
    
    // Close tooltip when clicking outside (fallback)
    document.addEventListener('click', function(e) {
        if (activeTooltip && !activeTooltip.contains(e.target)) {
            activeTooltip.classList.remove('active');
            activeTooltip = null;
        }
    });
}

// Initialize mobile tooltips when DOM is ready
document.addEventListener('DOMContentLoaded', initializeMobileTooltips);

// Re-initialize tooltips when dashboard is updated
const originalUpdateStatistics = updateStatistics;
updateStatistics = function(data) {
    originalUpdateStatistics(data);
    // Re-initialize tooltips after updating statistics
    setTimeout(initializeMobileTooltips, 100);
};
