document.addEventListener('DOMContentLoaded', () => {
  const DateTime = luxon.DateTime;

  const updateDateTime = () => {
    const now = DateTime.now();
    const dateEl = document.getElementById('current-date');
    const timeEl = document.getElementById('current-time');
    if (dateEl) dateEl.textContent = now.toLocaleString(DateTime.DATE_HUGE);
    if (timeEl) timeEl.textContent = now.toLocaleString(DateTime.TIME_WITH_SECONDS);
  };
  
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  const numberFormatOptions = { minimumFractionDigits: 0, maximumFractionDigits: 0 };
  
  const SPREADSHEET_ID = '1D54c79yejujdFIJKVu4m3iM3ndUVnxP_fSgwSqGec5U';
  const SHEET_NAME = 'Form_Responses1';
  const SALES_COLUMN_START = 1;
  const SALES_COLUMN_END = 10;
  const ADVISOR_COLUMN_INDEX = 11;
  const UPDATE_INTERVAL = 5 * 60 * 1000;
  
  const advisorColors = ['#106b63', '#eec55b', '#000000'];
  const incomeExpenseColors = ['#106b63', '#ef4444'];
  
  const $ = id => document.getElementById(id);
  const transactionForm = $('transaction-form');
  const transactionTypeSelect = $('transaction-type');
  const transactionCompanyContainer = $('transaction-company-container');
  const transactionCompanySelect = $('transaction-company');
  const manualSalesForm = $('manual-sales-form');
  const advisorForm = $('advisor-form');
  const manualSalesTotalEl = $('manual-sales-total');
  const totalBalanceEl = $('total-balance');
  const netCashFlowEl = $('net-cash-flow');
  const totalSalesMonthEl = $('total-sales-month');
  const avgDailySalesEl = $('avg-daily-sales');
  const automaticNoteEl = $('automatic-note');
  const lastTransactionNoteEl = $('last-transaction-note');
  const alertsContainer = $('alerts-container');
  const transactionHistoryBody = $('transaction-history-body');
  const advisorsTableBody = $('advisors-table-body');
  const balanceChartCanvasEl = $('balance-chart');
  const balanceChartCanvas = balanceChartCanvasEl ? balanceChartCanvasEl.getContext('2d') : null;
  const balanceTrendChartCanvasEl = $('balance-trend-chart');
  const balanceTrendChartCanvas = balanceTrendChartCanvasEl ? balanceTrendChartCanvasEl.getContext('2d') : null;
  const advisorsLoadingState = $('advisors-loading-state');
  const advisorsTableContent = $('advisors-table-content');
  const clearDataButton = $('clear-data-button');
  const deleteSelectedButton = $('delete-selected-button');
  const flowDetailsModal = $('flow-details-modal');
  const closeFlowModal = $('close-flow-modal');
  const netCashFlowCard = $('net-cash-flow-card');
  const currentPeriodDisplay = $('current-period-display');
  const chartPeriodBadge = $('chart-period-badge');
  const advisorsList = $('advisors-list');
  
  const exportDataButton = $('export-data-button');
  const copyDataButton = $('copy-data-button');
  const importDataButton = $('import-data-button');
  const importDataFile = $('import-data-file');
  const showImportTextButton = $('show-import-text-button');
  const importTextContainer = $('import-text-container');
  const importTextArea = $('import-text-area');
  const importFromTextButton = $('import-from-text-button');
  const cancelImportButton = $('cancel-import-button');
  const copySuccess = $('copy-success');
  
  // =============================================
  // NUEVAS VARIABLES Y ELEMENTOS DE CAJA
  // =============================================
  const cajaBalanceEl = $('caja-balance');
  const cajaActionButton = $('caja-action-button');
  const cajaInitialBadge = $('caja-initial-badge');
  const cajaConfigModal = $('caja-config-modal');
  const cajaInitialForm = $('caja-initial-form');
  const cajaInitialAmount = $('caja-initial-amount');
  const closeCajaModal = $('close-caja-modal');
  const cancelCajaModal = $('cancel-caja-modal');
  const cajaAlertsContainer = $('caja-alerts-container');
  const cajaCard = $('caja-card');
  
  let balanceChart, balanceTrendChart;
  let transactions = getFromLocalStorage('nova_transactions', []);
  let manualSalesTotal = getFromLocalStorage('nova_manual_sales_total', 0);
  let createdAdvisors = getFromLocalStorage('nova_created_advisors', []);
  // =============================================
  // NUEVAS VARIABLES DE ESTADO PARA CAJA
  // =============================================
  let cajaSaldoInicial = getFromLocalStorage('nova_caja_saldo_inicial', null);
  let cajaSaldoActual = getFromLocalStorage('nova_caja_saldo_actual', 0);
  
  let sheetRawData = null;
  let dateFilter = { type: 'last10', start: null, end: null };
  let selectedTransactions = new Set();
  let totalMonthSales = 0;
  let avgMonthDailySales = 0;
  
  function saveToLocalStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('No se pudo guardar en localStorage', e);
    }
  }
  
  function getFromLocalStorage(key, defaultValue = []) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }
  
  // =============================================
  // NUEVAS FUNCIONES PARA GUARDAR/CARGAR ESTADO DE CAJA
  // =============================================
  function saveCajaState() {
    saveToLocalStorage('nova_caja_saldo_inicial', cajaSaldoInicial);
    saveToLocalStorage('nova_caja_saldo_actual', cajaSaldoActual);
  }

  function loadCajaState() {
    cajaSaldoInicial = getFromLocalStorage('nova_caja_saldo_inicial', null);
    cajaSaldoActual = getFromLocalStorage('nova_caja_saldo_actual', 0);
  }
  
  const generateUniqueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
  const parseSalesValue = (value) => parseInt(String(value).replace(/[^0-9]/g, ''), 10) || 0;
  const normalizeName = (name) => (name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, ' ');
  
  // ==================== TRANSACTION TYPE SELECTOR ====================
  
  transactionTypeSelect?.addEventListener('change', (e) => {
    const type = e.target.value;
    if (type === 'ingreso' || type === 'egreso') {
      transactionCompanyContainer.classList.remove('hidden');
    } else {
      transactionCompanyContainer.classList.add('hidden');
      transactionCompanySelect.value = '';
    }
  });
  
  const getLocalDataForExport = () => JSON.stringify({
    transactions,
    manualSalesTotal,
    createdAdvisors,
    // =============================================
    // NUEVO: Incluir estado de caja en exportación
    // =============================================
    cajaSaldoInicial,
    cajaSaldoActual,
    exportDate: DateTime.now().toISO(),
    version: "3.0",
    note: "Datos locales de Nova Finanzas"
  }, null, 2);
  
  // ==================== EXPORT/IMPORT ====================
  
  copyDataButton?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(getLocalDataForExport());
      if (copySuccess) {
        copySuccess.classList.remove('hidden');
        setTimeout(() => copySuccess.classList.add('hidden'), 2500);
      }
    } catch (err) {
      alert('No se pudo copiar automáticamente. Selecciona y copia el texto manualmente.');
    }
  });
  
  exportDataButton?.addEventListener('click', () => {
    const dataStr = getLocalDataForExport();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nova_datos_${DateTime.now().toFormat('yyyy-MM-dd_HH-mm-ss')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
  
  importDataButton?.addEventListener('click', () => importDataFile?.click());
  
  importDataFile?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        importData(imported);
      } catch {
        alert('Archivo JSON inválido');
      }
    };
    reader.readAsText(file);
  });
  
  showImportTextButton?.addEventListener('click', () => {
    importTextContainer?.classList.toggle('hidden');
    importTextArea?.focus();
  });
  
  cancelImportButton?.addEventListener('click', () => {
    importTextContainer?.classList.add('hidden');
    if (importTextArea) importTextArea.value = '';
  });
  
  importFromTextButton?.addEventListener('click', () => {
    try {
      const imported = JSON.parse(importTextArea.value);
      importData(imported);
      importTextArea.value = '';
      importTextContainer.classList.add('hidden');
    } catch (e) {
      alert('JSON inválido en el texto pegado.');
    }
  });
  
  function importData(importedData) {
    if (!confirm('¿Estás seguro de que quieres cargar estos datos? Se reemplazarán los datos locales actuales.')) return;
    
    if (importedData.transactions && Array.isArray(importedData.transactions)) {
      transactions = importedData.transactions;
      saveToLocalStorage('nova_transactions', transactions);
    }
    
    if (importedData.manualSalesTotal !== undefined) {
      manualSalesTotal = importedData.manualSalesTotal;
      saveToLocalStorage('nova_manual_sales_total', manualSalesTotal);
    }

    if (importedData.createdAdvisors && Array.isArray(importedData.createdAdvisors)) {
      createdAdvisors = importedData.createdAdvisors;
      saveToLocalStorage('nova_created_advisors', createdAdvisors);
    }
    
    // =============================================
    // NUEVO: Importar estado de caja
    // =============================================
    if (importedData.cajaSaldoInicial !== undefined) {
      cajaSaldoInicial = importedData.cajaSaldoInicial;
      cajaSaldoActual = importedData.cajaSaldoActual !== undefined ? importedData.cajaSaldoActual : cajaSaldoInicial;
      saveCajaState();
    }
    
    if (importDataFile) importDataFile.value = '';
    updateUI();
    alert('Datos locales cargados exitosamente.');
  }
  
  // ==================== ADVISORS MANAGEMENT ====================
  
  const renderAdvisorsList = () => {
    if (!advisorsList) return;
    if (createdAdvisors.length === 0) {
      advisorsList.innerHTML = '<p class="text-sm text-[#000000]/60 text-center py-2">Sin asesores creados</p>';
      return;
    }
    advisorsList.innerHTML = createdAdvisors.map(advisor => `
      <div class="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
        <div>
          <p class="text-sm font-medium text-[#000000]">${advisor.name}</p>
          <p class="text-xs text-[#000000]/50">${advisor.company}</p>
        </div>
        <button onclick="window.deleteAdvisor('${advisor.id}')" class="text-red-500 hover:text-red-700 text-sm font-bold">
          ✕
        </button>
      </div>
    `).join('');
  };

  window.deleteAdvisor = (advisorId) => {
    if (!confirm('¿Eliminar este asesor?')) return;
    createdAdvisors = createdAdvisors.filter(a => a.id !== advisorId);
    saveToLocalStorage('nova_created_advisors', createdAdvisors);
    renderAdvisorsList();
    updateAdvisorsPerformance();
  };

  advisorForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('advisor-name').value.trim();
    const company = $('advisor-company').value;

    if (!name || !company) {
      alert('Por favor completa todos los campos');
      return;
    }

    const newAdvisor = {
      id: generateUniqueId(),
      name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
      company: company
    };

    createdAdvisors.push(newAdvisor);
    saveToLocalStorage('nova_created_advisors', createdAdvisors);
    advisorForm.reset();
    renderAdvisorsList();
    updateAdvisorsPerformance();
  });
  
  // ==================== FETCH GOOGLE SHEETS DATA ====================
  
  const fetchAndProcessSheetsData = async () => {
    try {
      const cacheBuster = Date.now();
      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?sheet=${SHEET_NAME}&range=A:L&t=${cacheBuster}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`${resp.status}: ${resp.statusText}`);
      
      const text = await resp.text();
      
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
      if (!match || !match[1]) throw new Error('Respuesta inesperada');
      
      const data = JSON.parse(match[1]);
      
      if (!data.table || !data.table.rows) throw new Error('Estructura de datos inesperada');
      
      sheetRawData = data.table.rows;
      
      totalMonthSales = 0;
      sheetRawData.forEach(row => {
        if (!row.c) return;
        for (let i = SALES_COLUMN_START; i <= SALES_COLUMN_END; i++) {
          if (row.c[i]) {
            const cell = row.c[i];
            const value = (cell.v !== null && cell.v !== undefined) ? cell.v : (cell.f || 0);
            totalMonthSales += parseSalesValue(value);
          }
        }
      });
      
      updateAdvisorsPerformance();
      updateMonthSalesMetrics();
      
    } catch (error) {
      console.error('Error al cargar Sheets:', error);
      if (advisorsTableBody) {
        advisorsTableBody.innerHTML = `
          <tr>
            <td colspan="3" class="text-center p-4 text-red-500 text-sm">
              ⚠️ Error al cargar Google Sheets
            </td>
          </tr>
        `;
      }
    }
  };
  
  const getAdvisorSalesFromSheet = (advisorName) => {
    if (!sheetRawData || sheetRawData.length === 0) return 0;
    
    const normalized = normalizeName(advisorName);
    let totalSales = 0;
    
    sheetRawData.forEach(row => {
      if (!row.c) return;
      
      const advisorCell = row.c[ADVISOR_COLUMN_INDEX];
      if (advisorCell && advisorCell.v !== null && advisorCell.v !== undefined) {
        const sheetAdvisorName = String(advisorCell.v).trim();
        const sheetNormalized = normalizeName(sheetAdvisorName);
        
        if (sheetNormalized === normalized) {
          for (let i = SALES_COLUMN_START; i <= SALES_COLUMN_END; i++) {
            if (row.c[i]) {
              const cell = row.c[i];
              const value = (cell.v !== null && cell.v !== undefined) ? cell.v : (cell.f || 0);
              totalSales += parseSalesValue(value);
            }
          }
        }
      }
    });
    
    return totalSales;
  };
  
  const renderAdvisors = (advisors) => {
    if (!advisorsTableBody) return;
    advisorsTableBody.innerHTML = '';
    
    const sorted = advisors.sort((a, b) => b.sales - a.sales);
    const totalSales = sorted.reduce((sum, a) => sum + a.sales, 0);
    
    sorted.forEach((a, index) => {
      const percentage = totalSales > 0 ? ((a.sales / totalSales) * 100).toFixed(1) : 0;
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="font-medium flex items-center gap-2">
          <div class="w-3 h-3 rounded-full" style="background-color: ${advisorColors[index % advisorColors.length]}"></div>
          ${a.name}
        </td>
        <td class="text-right font-semibold">${a.sales.toLocaleString('es-CO')}</td>
        <td class="text-right">
          <span class="text-[#000000]/50">${percentage}%</span>
        </td>
      `;
      advisorsTableBody.appendChild(row);
    });
  };
  
  const updateAdvisorsPerformance = () => {
    if (advisorsLoadingState) advisorsLoadingState.classList.remove('hidden');
    if (advisorsTableContent) advisorsTableContent.classList.add('hidden');
    
    try {
      if (createdAdvisors.length === 0) {
        advisorsTableBody.innerHTML = `
          <tr>
            <td colspan="3" class="text-center p-4 text-[#000000]/50">
              📝 Registra asesores para ver su desempeño
            </td>
          </tr>
        `;
      } else {
        const advisorsList = createdAdvisors.map(advisor => ({
          name: advisor.name,
          company: advisor.company,
          sales: getAdvisorSalesFromSheet(advisor.name)
        })).filter(a => a.sales > 0);
        
        if (advisorsList.length === 0) {
          advisorsTableBody.innerHTML = `
            <tr>
              <td colspan="3" class="text-center p-4 text-[#000000]/50">
                ⏳ Los asesores no tienen ventas registradas
              </td>
            </tr>
          `;
        } else {
          renderAdvisors(advisorsList);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      advisorsTableBody.innerHTML = `
        <tr>
          <td colspan="3" class="text-center p-4 text-red-500 text-sm">
            ⚠️ Error al procesar datos
          </td>
        </tr>
      `;
    } finally {
      if (advisorsLoadingState) advisorsLoadingState.classList.add('hidden');
      if (advisorsTableContent) advisorsTableContent.classList.remove('hidden');
    }
  };
  
  const updateManualSalesTotal = () => {
    if (manualSalesTotalEl) manualSalesTotalEl.textContent = manualSalesTotal.toLocaleString('es-CO', numberFormatOptions);
  };
  
  function sumTransactions(predicate) {
    return transactions.filter(predicate).reduce((s, t) => s + (t.amount || 0), 0);
  }

  // ==================== NUEVA FUNCIÓN: OBTENER DATOS SEPARADOS POR USUARIO ====================
  
  const getCashFlowByUser = (month, year) => {
    const novaklar = {
      income: 0,
      expense: 0,
      conversion: 0
    };
    
    const hanabi = {
      income: 0,
      expense: 0,
      conversion: 0
    };
    
    transactions.forEach(t => {
      const tDate = DateTime.fromISO(t.date);
      
      if (tDate.month === month && tDate.year === year) {
        const user = t.company === 'hanabi' ? hanabi : novaklar;
        
        if (t.type === 'ingreso') {
          user.income += t.amount || 0;
        } else if (t.type === 'egreso') {
          user.expense += t.amount || 0;
        } else if (t.type === 'conversion') {
          user.conversion += t.amount || 0;
        }
      }
    });
    
    return { novaklar, hanabi };
  };
  
  function getFilteredTransactions() {
    const now = DateTime.now();
    let startDate, endDate;
    
    switch(dateFilter.type) {
      case 'last10':
        startDate = now.minus({ days: 10 }).toISODate();
        endDate = now.toISODate();
        break;
      case 'month':
        startDate = now.startOf('month').toISODate();
        endDate = now.endOf('month').toISODate();
        break;
      case 'all':
        return transactions;
      case 'custom':
        startDate = dateFilter.start;
        endDate = dateFilter.end;
        break;
      default:
        startDate = now.minus({ days: 10 }).toISODate();
        endDate = now.toISODate();
    }
    
    if (startDate && endDate) {
      return transactions.filter(t => t.date >= startDate && t.date <= endDate);
    }
    
    return transactions;
  }
  
  // =============================================
  // NUEVA FUNCIÓN: Actualizar la interfaz de Caja
  // =============================================
  const updateCajaUI = () => {
    if (!cajaBalanceEl || !cajaActionButton || !cajaInitialBadge || !cajaCard) return;
    
    // Aplicar la clase de estilo especial a la tarjeta de caja
    cajaCard.classList.add('kpi-card-caja');
    
    if (cajaSaldoInicial !== null) {
      // Caja configurada
      cajaBalanceEl.textContent = `$${cajaSaldoActual.toLocaleString('es-CO', numberFormatOptions)}`;
      cajaInitialBadge.classList.remove('hidden');
      cajaActionButton.textContent = 'Ver Historial';
      
      // Cambiar el color del saldo si es bajo (ejemplo: < 1000)
      if (cajaSaldoActual < 1000) {
        cajaBalanceEl.classList.add('text-red-600');
        cajaBalanceEl.classList.remove('text-[#000000]');
      } else {
        cajaBalanceEl.classList.remove('text-red-600');
        cajaBalanceEl.classList.add('text-[#000000]');
      }
    } else {
      // Caja NO configurada
      cajaBalanceEl.textContent = '$0';
      cajaInitialBadge.classList.add('hidden');
      cajaActionButton.textContent = 'Configurar Saldo Inicial';
      cajaBalanceEl.classList.remove('text-red-600');
      cajaBalanceEl.classList.add('text-[#000000]');
    }
  };

  // =============================================
  // NUEVA FUNCIÓN: Actualizar saldo de caja desde una transacción
  // =============================================
  const updateCajaSaldoFromTransaction = (transaction) => {
    if (cajaSaldoInicial === null) return; // Caja no configurada, no afecta
    
    const amount = transaction.amount || 0;
    
    switch(transaction.type) {
      case 'ingreso':
        cajaSaldoActual += amount;
        break;
      case 'egreso':
      case 'conversion':
        cajaSaldoActual -= amount;
        break;
    }
    
    saveCajaState();
    updateCajaUI();
  };

  // =============================================
  // NUEVA FUNCIÓN: Recalcular saldo de caja desde cero
  // (Útil después de importar o eliminar transacciones)
  // =============================================
  const recalcularCajaDesdeInicial = () => {
    if (cajaSaldoInicial === null) {
      cajaSaldoActual = 0;
    } else {
      cajaSaldoActual = transactions.reduce((saldo, t) => {
        if (t.type === 'ingreso') {
          return saldo + (t.amount || 0);
        } else if (t.type === 'egreso' || t.type === 'conversion') {
          return saldo - (t.amount || 0);
        }
        return saldo;
      }, cajaSaldoInicial);
    }
    saveCajaState();
    updateCajaUI();
  };
  
  const checkForAlerts = () => {
    if (!alertsContainer) return;
    
    // Limpiar contenedores de alertas
    alertsContainer.innerHTML = '';
    if (cajaAlertsContainer) cajaAlertsContainer.innerHTML = '';
    
    const now = DateTime.now();
    
    const currentMonthIncome = sumTransactions(t => {
      const d = DateTime.fromISO(t.date);
      return d.month === now.month && d.year === now.year && t.type === 'ingreso';
    });
    
    const currentMonthExpense = sumTransactions(t => {
      const d = DateTime.fromISO(t.date);
      return d.month === now.month && d.year === now.year && t.type === 'egreso';
    });

    const currentMonthConversion = sumTransactions(t => {
      const d = DateTime.fromISO(t.date);
      return d.month === now.month && d.year === now.year && t.type === 'conversion';
    });
    
    const alerts = [];

    if (currentMonthIncome > 0) {
      alerts.push({
        type: 'success',
        message: `💰 La empresa ha generado $${currentMonthIncome.toLocaleString('es-CO')} en ingresos este mes.`
      });
    }

    if (currentMonthExpense > 0) {
      alerts.push({
        type: 'warning',
        message: `💸 Se ha gastado $${currentMonthExpense.toLocaleString('es-CO')} en egresos este mes.`
      });
    }

    if (currentMonthConversion > 0) {
      alerts.push({
        type: 'info',
        message: `🔄 Se ha convertido $${currentMonthConversion.toLocaleString('es-CO')} a dinero personal del CEO.`
      });
    }
    
    if (currentMonthExpense > currentMonthIncome) {
      alerts.push({
        type: 'warning',
        message: `⚠️ Los egresos superan los ingresos este mes.`
      });
    }
    
    if (!alerts.length) {
      alertsContainer.innerHTML = `
        <div class="text-center py-8 text-[#000000]/50">
          <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p class="text-sm">No hay alertas en este momento</p>
        </div>
      `;
    } else {
      alerts.forEach(a => {
        const node = document.createElement('div');
        node.className = `alert-modern alert-${a.type}`;
        node.textContent = a.message;
        alertsContainer.appendChild(node);
      });
    }
    
    // =============================================
    // NUEVAS ALERTAS DE CAJA
    // =============================================
    if (cajaAlertsContainer && cajaSaldoInicial !== null) {
      const cajaAlerts = [];
      
      // Alerta de Saldo Bajo (menos de $1,000)
      const UMBRAL_SALDO_BAJO = 1000;
      if (cajaSaldoActual < UMBRAL_SALDO_BAJO) {
        cajaAlerts.push({
          type: 'caja',
          message: `⚠️ Saldo de caja bajo: $${cajaSaldoActual.toLocaleString('es-CO')} (menos de $${UMBRAL_SALDO_BAJO.toLocaleString('es-CO')})`
        });
      }
      
      // Alerta por Conversiones Excesivas en los últimos 30 días
      const treintaDiasAtras = now.minus({ days: 30 }).toISODate();
      const conversionesRecientes = transactions.filter(t => 
        t.type === 'conversion' && t.date >= treintaDiasAtras
      );
      const totalConversionesRecientes = conversionesRecientes.reduce((sum, t) => sum + (t.amount || 0), 0);
      
      if (totalConversionesRecientes > cajaSaldoActual * 0.5) { // Si conversiones > 50% del saldo actual
        cajaAlerts.push({
          type: 'caja',
          message: `🔄 Conversiones excesivas ($${totalConversionesRecientes.toLocaleString('es-CO')}) en los últimos 30 días representan más del 50% del saldo actual.`
        });
      }
      
      if (cajaAlerts.length > 0) {
        cajaAlerts.forEach(alert => {
          const node = document.createElement('div');
          node.className = 'alert-modern alert-caja';
          node.textContent = alert.message;
          cajaAlertsContainer.appendChild(node);
        });
      }
    }
  };
  
  const updateAutomaticNote = () => {
    if (!automaticNoteEl || !lastTransactionNoteEl) return;
    if (!transactions.length) {
      automaticNoteEl.textContent = 'No hay registros recientes.';
      lastTransactionNoteEl.textContent = '';
      return;
    }
    
    const lastTransaction = [...transactions].sort((a, b) => 
      new Date(b.date + 'T' + (b.time || '00:00')) - new Date(a.date + 'T' + (a.time || '00:00'))
    )[0];
    
    const now = DateTime.now();
    automaticNoteEl.textContent = `Sistema actualizado: ${now.toLocaleString(DateTime.TIME_SIMPLE)}`;
    
    const lastDate = DateTime.fromISO(lastTransaction.date).toLocaleString(DateTime.DATE_FULL);
    const typeText = lastTransaction.type === 'ingreso' ? 'Ingreso' : (lastTransaction.type === 'egreso' ? 'Egreso' : 'Conversión');
    lastTransactionNoteEl.textContent = `Última transacción: ${typeText} de $${(lastTransaction.amount || 0).toLocaleString('es-CO')} el ${lastDate}`;
  };
  
  const toggleDeleteButton = () => {
    if (!deleteSelectedButton) return;
    if (selectedTransactions.size > 0) {
      deleteSelectedButton.classList.remove('opacity-0', 'pointer-events-none');
      deleteSelectedButton.classList.add('opacity-100');
    } else {
      deleteSelectedButton.classList.add('opacity-0', 'pointer-events-none');
      deleteSelectedButton.classList.remove('opacity-100');
    }
  };
  
  const setupTransactionDeletion = () => {
    if (!deleteSelectedButton) return;
    deleteSelectedButton.addEventListener('click', () => {
      if (!selectedTransactions.size) return;
      if (!confirm(`¿Eliminar ${selectedTransactions.size} transacción(es)?`)) return;
      
      transactions = transactions.filter(t => !selectedTransactions.has(t.id));
      saveToLocalStorage('nova_transactions', transactions);
      selectedTransactions.clear();
      toggleDeleteButton();
      
      // =============================================
      // NUEVO: Recalcular caja después de eliminar transacciones
      // =============================================
      recalcularCajaDesdeInicial();
      
      updateUI();
    });
  };
  
  const updateMonthlyFinancials = () => {
    const now = DateTime.now();
    
    const cashInflow = sumTransactions(t => {
      const d = DateTime.fromISO(t.date);
      return d.month === now.month && d.year === now.year && t.type === 'ingreso';
    });
    
    const cashOutflow = sumTransactions(t => {
      const d = DateTime.fromISO(t.date);
      return d.month === now.month && d.year === now.year && t.type === 'egreso';
    });

    const cashConversion = sumTransactions(t => {
      const d = DateTime.fromISO(t.date);
      return d.month === now.month && d.year === now.year && t.type === 'conversion';
    });
    
    const net = cashInflow - cashOutflow;
    
    updateMonthSalesMetrics();
    
    if (netCashFlowEl) {
      netCashFlowEl.textContent = `$${net.toLocaleString('es-CO', numberFormatOptions)}`;
      netCashFlowEl.className = `kpi-value-new ${net >= 0 ? 'text-[#106b63]' : 'text-red-600'}`;
    }
    
    return { cashInflow, cashOutflow, cashConversion, net };
  };
  
  const updateMonthSalesMetrics = () => {
    const now = DateTime.now();
    
    if (totalSalesMonthEl) {
      totalSalesMonthEl.textContent = totalMonthSales.toLocaleString('es-CO', numberFormatOptions);
    }
    
    if (avgDailySalesEl) {
      const daysPassed = Math.max(1, now.day);
      avgMonthDailySales = totalMonthSales > 0 ? Math.round(totalMonthSales / daysPassed) : 0;
      avgDailySalesEl.textContent = avgMonthDailySales.toLocaleString('es-CO', numberFormatOptions);
    }
  };
  
  // ==================== MODAL CON DESGLOSE POR USUARIO ====================
  
  const showFlowDetailsModal = () => {
    const now = DateTime.now();
    const { cashInflow, cashOutflow, cashConversion, net } = updateMonthlyFinancials();
    const { novaklar, hanabi } = getCashFlowByUser(now.month, now.year);
    
    if ($('modal-income-total')) {
      $('modal-income-total').textContent = `$${cashInflow.toLocaleString('es-CO', numberFormatOptions)}`;
    }
    
    if ($('modal-expense-total')) {
      $('modal-expense-total').textContent = `$${cashOutflow.toLocaleString('es-CO', numberFormatOptions)}`;
    }

    if ($('modal-conversion-total')) {
      $('modal-conversion-total').textContent = `$${cashConversion.toLocaleString('es-CO', numberFormatOptions)}`;
    }
    
    if ($('modal-net-flow')) {
      $('modal-net-flow').textContent = `$${net.toLocaleString('es-CO', numberFormatOptions)}`;
    }
    
    if ($('modal-month-display')) {
      $('modal-month-display').textContent = now.toFormat('MMMM yyyy');
    }
    
    const categoryBreakdown = $('modal-category-breakdown');
    if (categoryBreakdown) {
      categoryBreakdown.innerHTML = `
        <!-- RESUMEN GENERAL -->
        <div class="mb-6 pb-4 border-b border-gray-200">
          <h5 class="font-bold text-[#000000] text-sm uppercase tracking-wider mb-3">Resumen General del Mes</h5>
          <div class="flex items-center justify-between p-2 bg-green-50 rounded-lg mb-2">
            <span class="text-sm text-green-700">Ingresos Totales</span>
            <span class="text-sm font-semibold text-green-700">$${cashInflow.toLocaleString('es-CO')}</span>
          </div>
          <div class="flex items-center justify-between p-2 bg-red-50 rounded-lg mb-2">
            <span class="text-sm text-red-700">Egresos Totales</span>
            <span class="text-sm font-semibold text-red-700">$${cashOutflow.toLocaleString('es-CO')}</span>
          </div>
          <div class="flex items-center justify-between p-2 bg-yellow-50 rounded-lg" style="border-left: 4px solid #eec55b">
            <span class="text-sm text-yellow-700">Conversiones</span>
            <span class="text-sm font-semibold text-yellow-700">$${cashConversion.toLocaleString('es-CO')}</span>
          </div>
        </div>

        <!-- NOVAKLAR -->
        <div class="user-breakdown-section mb-4">
          <div class="user-breakdown-header">👤 Novaklar</div>
          <div class="breakdown-item">
            <span class="breakdown-label">Ingresos</span>
            <span class="breakdown-value text-green-600">$${novaklar.income.toLocaleString('es-CO')}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Egresos</span>
            <span class="breakdown-value text-red-600">$${novaklar.expense.toLocaleString('es-CO')}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Conversiones</span>
            <span class="breakdown-value text-yellow-600">$${novaklar.conversion.toLocaleString('es-CO')}</span>
          </div>
          <div class="breakdown-item border-t pt-2">
            <span class="breakdown-label font-semibold">Flujo Neto</span>
            <span class="breakdown-value ${(novaklar.income - novaklar.expense) >= 0 ? 'text-green-600' : 'text-red-600'}">
              $${(novaklar.income - novaklar.expense).toLocaleString('es-CO')}
            </span>
          </div>
        </div>

        <!-- HANABI -->
        <div class="user-breakdown-section">
          <div class="user-breakdown-header">👤 Hanabi</div>
          <div class="breakdown-item">
            <span class="breakdown-label">Ingresos</span>
            <span class="breakdown-value text-green-600">$${hanabi.income.toLocaleString('es-CO')}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Egresos</span>
            <span class="breakdown-value text-red-600">$${hanabi.expense.toLocaleString('es-CO')}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Conversiones</span>
            <span class="breakdown-value text-yellow-600">$${hanabi.conversion.toLocaleString('es-CO')}</span>
          </div>
          <div class="breakdown-item border-t pt-2">
            <span class="breakdown-label font-semibold">Flujo Neto</span>
            <span class="breakdown-value ${(hanabi.income - hanabi.expense) >= 0 ? 'text-green-600' : 'text-red-600'}">
              $${(hanabi.income - hanabi.expense).toLocaleString('es-CO')}
            </span>
          </div>
        </div>
      `;
    }
    
    flowDetailsModal.style.display = 'flex';
  };
  
  if (netCashFlowCard) {
    netCashFlowCard.addEventListener('click', showFlowDetailsModal);
  }
  
  if (closeFlowModal) {
    closeFlowModal.addEventListener('click', () => {
      flowDetailsModal.style.display = 'none';
    });
  }
  
  flowDetailsModal.addEventListener('click', (e) => {
    if (e.target === flowDetailsModal) {
      flowDetailsModal.style.display = 'none';
    }
  });
  
  const selectAllCheckbox = document.getElementById('select-all-checkbox');
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      const checkboxes = document.querySelectorAll('.transaction-checkbox');
      checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
        if (e.target.checked) selectedTransactions.add(cb.dataset.id);
        else selectedTransactions.delete(cb.dataset.id);
      });
      toggleDeleteButton();
    });
  }
  
  const renderTransactions = () => {
    if (!transactionHistoryBody) return;
    transactionHistoryBody.innerHTML = '';
    
    const sorted = [...transactions].sort((a, b) => 
      new Date(b.date) - new Date(a.date) || (b.time || '').localeCompare(a.time || '')
    );
    
    sorted.forEach(t => {
      const row = document.createElement('tr');
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'transaction-checkbox rounded border-gray-300 hover:border-[#106b63]';
      checkbox.dataset.id = t.id;
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) selectedTransactions.add(t.id);
        else selectedTransactions.delete(t.id);
        toggleDeleteButton();
      });
      
      const checkboxCell = document.createElement('td');
      checkboxCell.className = 'text-center';
      checkboxCell.appendChild(checkbox);
      
      const dateCell = document.createElement('td');
      const dateObj = DateTime.fromISO(t.date);
      dateCell.textContent = dateObj.toFormat('dd/MM/yyyy');
      
      const typeCell = document.createElement('td');
      let statusClass = 'status-income';
      let typeText = 'Ingreso';
      
      if (t.type === 'egreso') {
        statusClass = 'status-expense';
        typeText = 'Egreso';
      } else if (t.type === 'conversion') {
        statusClass = 'status-conversion';
        typeText = 'Conversión';
      }

      typeCell.innerHTML = `
        <span class="status-indicator ${statusClass}">
          ${typeText}
        </span>
      `;

      const companyCell = document.createElement('td');
      companyCell.textContent = t.company ? (t.company === 'novaklar' ? 'Novaklar' : 'Hanabi') : '-';
      companyCell.className = 'text-[#000000]/70 text-sm';
      
      const amountCell = document.createElement('td');
      amountCell.className = 'text-right font-semibold';
      amountCell.textContent = `$${(t.amount || 0).toLocaleString('es-CO', numberFormatOptions)}`;
      
      if (t.type === 'ingreso') {
        amountCell.classList.add('text-green-600');
      } else if (t.type === 'egreso') {
        amountCell.classList.add('text-red-600');
      } else {
        amountCell.classList.add('text-yellow-600');
      }
      
      row.appendChild(checkboxCell);
      row.appendChild(dateCell);
      row.appendChild(typeCell);
      row.appendChild(companyCell);
      row.appendChild(amountCell);
      
      transactionHistoryBody.appendChild(row);
    });
    
    toggleDeleteButton();
  };
  
  const updateTotalBalance = () => {
    if (!totalBalanceEl) return;
    const total = transactions.reduce((sum, t) => {
      if (t.type === 'conversion') return sum;
      return t.type === 'ingreso' ? sum + (t.amount || 0) : sum - (t.amount || 0);
    }, 0);
    
    totalBalanceEl.textContent = `$${total.toLocaleString('es-CO', numberFormatOptions)}`;
  };
  
  const updateCharts = () => {
    if (!balanceChartCanvas || !balanceTrendChartCanvas) {
      updateBalanceTrendChart();
      return;
    }
    if (balanceChart) balanceChart.destroy();
    
    const filteredTransactions = getFilteredTransactions();
    
    const totalIncome = filteredTransactions
      .filter(t => t.type === 'ingreso')
      .reduce((s, t) => s + (t.amount || 0), 0);
    
    const totalExpense = filteredTransactions
      .filter(t => t.type === 'egreso')
      .reduce((s, t) => s + (t.amount || 0), 0);
    
    if (chartPeriodBadge) {
      let periodText = '';
      switch(dateFilter.type) {
        case 'last10': periodText = 'Últimos 10 días'; break;
        case 'month': periodText = 'Mes Actual'; break;
        case 'all': periodText = 'Periodo Completo'; break;
        case 'custom': periodText = 'Personalizado'; break;
        default: periodText = 'Últimos 10 días';
      }
      chartPeriodBadge.textContent = periodText;
    }
    
    if (totalIncome > 0 || totalExpense > 0) {
      balanceChart = new Chart(balanceChartCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Ingresos', 'Egresos'],
          datasets: [{
            data: [totalIncome, totalExpense],
            backgroundColor: incomeExpenseColors,
            borderWidth: 0,
            hoverOffset: 8
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
                usePointStyle: true,
                pointStyle: 'circle'
              }
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const label = context.label || '';
                  const value = context.parsed;
                  const total = context.dataset.data.reduce((sum, cur) => sum + cur, 0);
                  const percentage = total ? ((value / total) * 100).toFixed(2) + '%' : '0%';
                  return `${label}: $${value.toLocaleString('es-CO')} (${percentage})`;
                }
              }
            }
          }
        }
      });
    } else {
      balanceChart = new Chart(balanceChartCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Sin datos'],
          datasets: [{
            data: [1],
            backgroundColor: ['#e5e7eb'],
            borderWidth: 0
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
              enabled: false
            }
          }
        }
      });
    }
    
    updateBalanceTrendChart();
  };
  
  const updateBalanceTrendChart = () => {
    if (!balanceTrendChartCanvas) return;
    if (balanceTrendChart) balanceTrendChart.destroy();
    
    const filteredTransactions = getFilteredTransactions();
    
    const dailyData = filteredTransactions.reduce((acc, t) => {
      const dt = t.date;
      if (!acc[dt]) acc[dt] = { income: 0, expense: 0 };
      if (t.type === 'ingreso') acc[dt].income += t.amount || 0;
      else if (t.type === 'egreso') acc[dt].expense += t.amount || 0;
      return acc;
    }, {});
    
    const sortedDates = Object.keys(dailyData).sort((a, b) => new Date(a) - new Date(b));
    let running = 0;
    const dailyBalances = sortedDates.map(d => {
      running += (dailyData[d].income - dailyData[d].expense);
      return running;
    });
    
    if (currentPeriodDisplay) {
      let displayText = '';
      switch(dateFilter.type) {
        case 'last10': displayText = 'Últimos 10 días'; break;
        case 'month': displayText = 'Mes Actual'; break;
        case 'all': displayText = 'Periodo Completo'; break;
        case 'custom': 
          if (dateFilter.start && dateFilter.end) {
            displayText = `${DateTime.fromISO(dateFilter.start).toFormat('dd/MM')} - ${DateTime.fromISO(dateFilter.end).toFormat('dd/MM')}`;
          } else {
            displayText = 'Periodo Personalizado';
          }
          break;
        default: displayText = 'Últimos 10 días';
      }
      currentPeriodDisplay.textContent = displayText;
    }
    
    if (sortedDates.length > 0) {
      balanceTrendChart = new Chart(balanceTrendChartCanvas, {
        type: 'line',
        data: {
          labels: sortedDates,
          datasets: [{
            label: 'Balance Acumulado',
            data: dailyBalances,
            borderColor: '#106b63',
            backgroundColor: 'rgba(16, 107, 99, 0.08)',
            borderWidth: 2,
            tension: 0.1,
            fill: true,
            pointBackgroundColor: '#106b63',
            pointRadius: 3,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: {
                display: false
              }
            },
            y: {
              beginAtZero: false,
              grid: {
                color: 'rgba(0,0,0,0.05)'
              },
              ticks: {
                callback: function(value) {
                  return '$' + value.toLocaleString('es-CO');
                }
              }
            }
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  return `Balance: $${context.parsed.y.toLocaleString('es-CO')}`;
                }
              }
            }
          }
        }
      });
    } else {
      balanceTrendChart = new Chart(balanceTrendChartCanvas, {
        type: 'line',
        data: {
          labels: ['Sin datos'],
          datasets: [{
            label: 'Balance Acumulado',
            data: [0],
            borderColor: '#e5e7eb',
            backgroundColor: 'rgba(229, 231, 235, 0.1)',
            borderWidth: 2,
            tension: 0.1,
            fill: true,
            pointBackgroundColor: '#e5e7eb'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: {
                display: false
              }
            },
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(0,0,0,0.05)'
              },
              ticks: {
                callback: function(value) {
                  return '$' + value.toLocaleString('es-CO');
                }
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    }
  };
  
  const periodButtons = document.querySelectorAll('.period-btn[data-period]');
  periodButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      periodButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      dateFilter.type = btn.dataset.period;
      updateCharts();
    });
  });
  
  const customPeriodBtn = document.getElementById('custom-period-btn');
  if (customPeriodBtn) {
    customPeriodBtn.addEventListener('click', () => {
      const startDate = prompt('Ingresa fecha de inicio (YYYY-MM-DD):', DateTime.now().minus({ days: 30 }).toISODate());
      const endDate = prompt('Ingresa fecha de fin (YYYY-MM-DD):', DateTime.now().toISODate());
      
      if (startDate && endDate) {
        dateFilter.type = 'custom';
        dateFilter.start = startDate;
        dateFilter.end = endDate;
        
        periodButtons.forEach(b => b.classList.remove('active'));
        customPeriodBtn.classList.add('active');
        
        updateCharts();
      }
    });
  }
  
  // =============================================
  // NUEVA LÓGICA: Modal de Configuración de Caja
  // =============================================
  if (cajaActionButton) {
    cajaActionButton.addEventListener('click', () => {
      if (cajaSaldoInicial === null) {
        // Mostrar modal para configurar saldo inicial
        if (cajaConfigModal) {
          cajaConfigModal.style.display = 'flex';
          if (cajaInitialAmount) {
            cajaInitialAmount.value = '';
            cajaInitialAmount.focus();
          }
        }
      } else {
        // TODO: Mostrar historial de caja (futura funcionalidad)
        alert('Funcionalidad "Ver Historial" próximamente disponible.');
      }
    });
  }

  // Cerrar modal de caja
  const closeCajaModalFunc = () => {
    if (cajaConfigModal) cajaConfigModal.style.display = 'none';
  };

  if (closeCajaModal) {
    closeCajaModal.addEventListener('click', closeCajaModalFunc);
  }

  if (cancelCajaModal) {
    cancelCajaModal.addEventListener('click', closeCajaModalFunc);
  }

  if (cajaConfigModal) {
    cajaConfigModal.addEventListener('click', (e) => {
      if (e.target === cajaConfigModal) {
        closeCajaModalFunc();
      }
    });
  }

  // Guardar saldo inicial de caja
  if (cajaInitialForm) {
    cajaInitialForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const monto = parseInt(cajaInitialAmount.value, 10);
      if (isNaN(monto) || monto <= 0) {
        alert('Por favor ingresa un monto válido mayor a cero.');
        return;
      }
      
      cajaSaldoInicial = monto;
      cajaSaldoActual = monto;
      saveCajaState();
      
      closeCajaModalFunc();
      updateCajaUI();
      checkForAlerts(); // Actualizar alertas (ahora la caja está configurada)
    });
  }
  
  transactionForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const type = $('transaction-type').value;
    const company = (type === 'ingreso' || type === 'egreso') ? transactionCompanySelect.value : '';
    const amount = parseInt($('transaction-amount').value, 10) || 0;
    
    if ((type === 'ingreso' || type === 'egreso') && !company) {
      alert('Por favor selecciona una empresa');
      return;
    }
    
    // =============================================
    // NUEVO: Validación de saldo de caja para egresos y conversiones
    // =============================================
    if (cajaSaldoInicial !== null && (type === 'egreso' || type === 'conversion')) {
      if (amount > cajaSaldoActual) {
        const confirmar = confirm(`⚠️ ADVERTENCIA: Este ${type === 'egreso' ? 'egreso' : 'conversión'} de $${amount.toLocaleString('es-CO')} supera el saldo actual de caja ($${cajaSaldoActual.toLocaleString('es-CO')}).\n\n¿Aún así deseas registrarlo? (Ej: si tienes crédito o fondos por llegar)`);
        if (!confirmar) {
          return; // Cancelar el registro
        }
      }
    }
    
    const newTransaction = {
      id: generateUniqueId(),
      date: $('transaction-date').value || DateTime.now().toISODate(),
      type: type,
      amount: amount,
      company: company,
      time: DateTime.now().toFormat('HH:mm:ss')
    };
    
    transactions.push(newTransaction);
    saveToLocalStorage('nova_transactions', transactions);
    
    // =============================================
    // NUEVO: Actualizar caja con la nueva transacción
    // =============================================
    updateCajaSaldoFromTransaction(newTransaction);
    
    updateUI();
    
    transactionForm.reset();
    if ($('transaction-date')) $('transaction-date').value = DateTime.now().toISODate();
  });
  
  manualSalesForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const amount = parseInt($('manual-sales-amount').value, 10) || 0;
    if (amount > 0) {
      manualSalesTotal += amount;
      saveToLocalStorage('nova_manual_sales_total', manualSalesTotal);
      updateManualSalesTotal();
      manualSalesForm.reset();
      
      if (copySuccess) {
        copySuccess.textContent = `✓ ${amount} ventas manuales agregadas`;
        copySuccess.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'border-green-200');
        copySuccess.classList.add('bg-blue-100', 'text-blue-800', 'border-blue-200');
        setTimeout(() => copySuccess.classList.add('hidden'), 2500);
      }
    }
  });
  
  clearDataButton?.addEventListener('click', () => {
    if (!confirm('¿Eliminar todos los datos locales? Esta acción es irreversible.')) return;
    
    try {
      localStorage.removeItem('nova_transactions');
      localStorage.removeItem('nova_manual_sales_total');
      localStorage.removeItem('nova_created_advisors');
      // =============================================
      // NUEVO: Eliminar estado de caja
      // =============================================
      localStorage.removeItem('nova_caja_saldo_inicial');
      localStorage.removeItem('nova_caja_saldo_actual');
    } catch (e) { }
    transactions = [];
    manualSalesTotal = 0;
    createdAdvisors = [];
    // =============================================
    // NUEVO: Reiniciar estado de caja
    // =============================================
    cajaSaldoInicial = null;
    cajaSaldoActual = 0;
    
    selectedTransactions.clear();
    updateUI();
    
    if (copySuccess) {
      copySuccess.textContent = '✓ Todos los datos locales han sido eliminados';
      copySuccess.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'border-green-200');
      copySuccess.classList.add('bg-red-100', 'text-red-800', 'border-red-200');
      setTimeout(() => copySuccess.classList.add('hidden'), 2500);
    }
  });
  
  setupTransactionDeletion();
  
  const updateUI = () => {
    updateTotalBalance();
    updateMonthlyFinancials();
    updateCharts();
    renderTransactions();
    updateManualSalesTotal();
    // =============================================
    // NUEVO: Actualizar UI de caja en cada actualización
    // =============================================
    updateCajaUI();
    checkForAlerts();
    updateAutomaticNote();
    renderAdvisorsList();
    fetchAndProcessSheetsData();
  };
  
  if ($('transaction-date')) $('transaction-date').value = DateTime.now().toISODate();
  
  // =============================================
  // NUEVO: Cargar estado de caja al iniciar
  // =============================================
  loadCajaState();
  
  updateUI();
  setInterval(fetchAndProcessSheetsData, UPDATE_INTERVAL);
});
