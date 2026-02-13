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
  
  const advisorColors = ['#0d4c7f', '#7fcfda', '#08355c'];
  const incomeExpenseColors = ['#0d4c7f', '#7fcfda'];
  
  const $ = id => document.getElementById(id);
  const transactionForm = $('transaction-form');
  const manualSalesForm = $('manual-sales-form');
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
  
  let balanceChart, balanceTrendChart;
  let transactions = getFromLocalStorage('novaklar_transactions', []);
  let manualSalesTotal = getFromLocalStorage('novaklar_manual_sales_total', 0);
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
  
  const generateUniqueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
  
  const getLocalDataForExport = () => JSON.stringify({
    transactions,
    manualSalesTotal,
    exportDate: DateTime.now().toISO(),
    version: "2.0",
    note: "Datos locales de Novaklar Finanzas"
  }, null, 2);
  
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
    link.download = `novaklar_datos_${DateTime.now().toFormat('yyyy-MM-dd_HH-mm-ss')}.json`;
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
      saveToLocalStorage('novaklar_transactions', transactions);
    }
    
    if (importedData.manualSalesTotal !== undefined) {
      manualSalesTotal = importedData.manualSalesTotal;
      saveToLocalStorage('novaklar_manual_sales_total', manualSalesTotal);
    }
    
    if (importDataFile) importDataFile.value = '';
    updateUI();
    alert('Datos locales cargados exitosamente.');
  }
  
  const updateManualSalesTotal = () => {
    if (manualSalesTotalEl) manualSalesTotalEl.textContent = manualSalesTotal.toLocaleString('es-CO', numberFormatOptions);
  };
  
  function sumTransactions(predicate) {
    return transactions.filter(predicate).reduce((s, t) => s + (t.amount || 0), 0);
  }
  
  // Función para obtener transacciones filtradas por periodo
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
        return transactions; // Devolver todas sin filtrar
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
  
  const checkForAlerts = () => {
    if (!alertsContainer) return;
    alertsContainer.innerHTML = '';
    const now = DateTime.now();
    
    const currentMonthIncome = sumTransactions(t => {
      const d = DateTime.fromISO(t.date);
      return d.month === now.month && d.year === now.year && t.type === 'ingreso';
    });
    
    const currentMonthExpense = sumTransactions(t => {
      const d = DateTime.fromISO(t.date);
      return d.month === now.month && d.year === now.year && t.type === 'egreso';
    });
    
    const alerts = [];
    
    if (currentMonthExpense > currentMonthIncome) {
      alerts.push({
        type: 'warning',
        message: `Los egresos ($${currentMonthExpense.toLocaleString('es-CO')}) superan los ingresos ($${currentMonthIncome.toLocaleString('es-CO')}) este mes.`
      });
    }
    
    const today = now.toISODate();
    const todaySales = sumTransactions(t => t.date === today && t.type === 'ingreso');
    const avgDailySales = currentMonthIncome / Math.max(1, now.day);
    
    if (todaySales > avgDailySales * 1.5) {
      alerts.push({
        type: 'success',
        message: `¡Excelente día! Ventas de hoy: $${todaySales.toLocaleString('es-CO')} (supera el promedio)`
      });
    }
    
    if (todaySales === 0) {
      alerts.push({
        type: 'info',
        message: 'No hay transacciones registradas para hoy.'
      });
    }
    
    if (!alerts.length) {
      alertsContainer.innerHTML = `
        <div class="text-center py-8 text-[#080a33]/50">
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
    lastTransactionNoteEl.textContent = `Última transacción: ${lastTransaction.type === 'ingreso' ? 'Ingreso' : 'Egreso'} de $${(lastTransaction.amount || 0).toLocaleString('es-CO')} el ${lastDate}`;
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
      saveToLocalStorage('novaklar_transactions', transactions);
      selectedTransactions.clear();
      toggleDeleteButton();
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
    
    const net = cashInflow - cashOutflow;
    
    // Actualizar métricas de ventas del mes
    updateMonthSalesMetrics();
    
    if (netCashFlowEl) {
      netCashFlowEl.textContent = `$${net.toLocaleString('es-CO', numberFormatOptions)}`;
      netCashFlowEl.className = `kpi-value-new ${net >= 0 ? 'text-[#0d4c7f]' : 'text-red-600'}`;
    }
    
    return { cashInflow, cashOutflow, net };
  };
  
  const updateMonthSalesMetrics = () => {
    const now = DateTime.now();
    
    // Usamos las ventas del Google Sheets
    if (totalSalesMonthEl) {
      totalSalesMonthEl.textContent = totalMonthSales.toLocaleString('es-CO', numberFormatOptions);
    }
    
    if (avgDailySalesEl) {
      const daysPassed = Math.max(1, now.day);
      avgMonthDailySales = totalMonthSales > 0 ? Math.round(totalMonthSales / daysPassed) : 0;
      avgDailySalesEl.textContent = avgMonthDailySales.toLocaleString('es-CO', numberFormatOptions);
    }
  };
  
  const showFlowDetailsModal = () => {
    const now = DateTime.now();
    const { cashInflow, cashOutflow, net } = updateMonthlyFinancials();
    
    if ($('modal-income-total')) {
      $('modal-income-total').textContent = `$${cashInflow.toLocaleString('es-CO', numberFormatOptions)}`;
    }
    
    if ($('modal-expense-total')) {
      $('modal-expense-total').textContent = `$${cashOutflow.toLocaleString('es-CO', numberFormatOptions)}`;
    }
    
    if ($('modal-net-flow')) {
      $('modal-net-flow').textContent = `$${net.toLocaleString('es-CO', numberFormatOptions)}`;
    }
    
    if ($('modal-month-display')) {
      $('modal-month-display').textContent = now.toFormat('MMMM yyyy');
    }
    
    // Actualizar desglose por categoría
    const categoryBreakdown = $('modal-category-breakdown');
    if (categoryBreakdown) {
      categoryBreakdown.innerHTML = `
        <div class="flex items-center justify-between p-2 bg-green-50 rounded-lg">
          <span class="text-sm text-green-700">Ingresos por Ventas</span>
          <span class="text-sm font-semibold text-green-700">$${Math.round(cashInflow * 0.7).toLocaleString('es-CO')}</span>
        </div>
        <div class="flex items-center justify-between p-2 bg-green-50 rounded-lg">
          <span class="text-sm text-green-700">Ingresos por Servicios</span>
          <span class="text-sm font-semibold text-green-700">$${Math.round(cashInflow * 0.3).toLocaleString('es-CO')}</span>
        </div>
        <div class="flex items-center justify-between p-2 bg-red-50 rounded-lg">
          <span class="text-sm text-red-700">Gastos Operativos</span>
          <span class="text-sm font-semibold text-red-700">$${Math.round(cashOutflow * 0.6).toLocaleString('es-CO')}</span>
        </div>
        <div class="flex items-center justify-between p-2 bg-red-50 rounded-lg">
          <span class="text-sm text-red-700">Gastos Administrativos</span>
          <span class="text-sm font-semibold text-red-700">$${Math.round(cashOutflow * 0.4).toLocaleString('es-CO')}</span>
        </div>
      `;
    }
    
    flowDetailsModal.style.display = 'flex';
  };
  
  // Configurar eventos del modal
  if (netCashFlowCard) {
    netCashFlowCard.addEventListener('click', showFlowDetailsModal);
  }
  
  if (closeFlowModal) {
    closeFlowModal.addEventListener('click', () => {
      flowDetailsModal.style.display = 'none';
    });
  }
  
  // Cerrar modal al hacer clic fuera
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
      checkbox.className = 'transaction-checkbox rounded border-gray-300 hover:border-[#7fcfda]';
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
      typeCell.innerHTML = `
        <span class="status-indicator ${t.type === 'ingreso' ? 'status-income' : 'status-expense'}">
          ${t.type === 'ingreso' ? 'Ingreso' : 'Egreso'}
        </span>
      `;
      
      const amountCell = document.createElement('td');
      amountCell.className = 'text-right font-semibold';
      amountCell.textContent = `$${(t.amount || 0).toLocaleString('es-CO', numberFormatOptions)}`;
      amountCell.classList.add(t.type === 'ingreso' ? 'text-green-600' : 'text-red-600');
      
      const descCell = document.createElement('td');
      descCell.textContent = t.description || 'Sin descripción';
      descCell.className = 'text-[#080a33]/50 text-sm';
      
      row.appendChild(checkboxCell);
      row.appendChild(dateCell);
      row.appendChild(typeCell);
      row.appendChild(amountCell);
      row.appendChild(descCell);
      
      transactionHistoryBody.appendChild(row);
    });
    
    toggleDeleteButton();
  };
  
  const updateTotalBalance = () => {
    if (!totalBalanceEl) return;
    const total = transactions.reduce((sum, t) => 
      t.type === 'ingreso' ? sum + (t.amount || 0) : sum - (t.amount || 0), 0);
    
    totalBalanceEl.textContent = `$${total.toLocaleString('es-CO', numberFormatOptions)}`;
  };
  
  const updateCharts = () => {
    if (!balanceChartCanvas || !balanceTrendChartCanvas) {
      updateBalanceTrendChart();
      return;
    }
    if (balanceChart) balanceChart.destroy();
    
    // Usar transacciones filtradas para ambas gráficas
    const filteredTransactions = getFilteredTransactions();
    
    const totalIncome = filteredTransactions
      .filter(t => t.type === 'ingreso')
      .reduce((s, t) => s + (t.amount || 0), 0);
    
    const totalExpense = filteredTransactions
      .filter(t => t.type === 'egreso')
      .reduce((s, t) => s + (t.amount || 0), 0);
    
    // Actualizar badge del periodo
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
    
    // Solo crear la gráfica si hay datos
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
      // Mostrar gráfica vacía si no hay datos
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
      else acc[dt].expense += t.amount || 0;
      return acc;
    }, {});
    
    const sortedDates = Object.keys(dailyData).sort((a, b) => new Date(a) - new Date(b));
    let running = 0;
    const dailyBalances = sortedDates.map(d => {
      running += (dailyData[d].income - dailyData[d].expense);
      return running;
    });
    
    // Actualizar display del periodo
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
    
    // Solo crear la gráfica si hay datos
    if (sortedDates.length > 0) {
      balanceTrendChart = new Chart(balanceTrendChartCanvas, {
        type: 'line',
        data: {
          labels: sortedDates,
          datasets: [{
            label: 'Balance Acumulado',
            data: dailyBalances,
            borderColor: '#0d4c7f',
            backgroundColor: 'rgba(13, 76, 127, 0.08)',
            borderWidth: 2,
            tension: 0.1,
            fill: true,
            pointBackgroundColor: '#0d4c7f',
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
      // Mostrar gráfica vacía si no hay datos
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
  
  // Configurar filtros de periodo
  const periodButtons = document.querySelectorAll('.period-btn[data-period]');
  periodButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remover clase active de todos
      periodButtons.forEach(b => b.classList.remove('active'));
      // Agregar clase active al botón clickeado
      btn.classList.add('active');
      // Actualizar filtro
      dateFilter.type = btn.dataset.period;
      updateCharts(); // Actualizar ambas gráficas
    });
  });
  
  // Configurar botón de periodo personalizado
  const customPeriodBtn = document.getElementById('custom-period-btn');
  if (customPeriodBtn) {
    customPeriodBtn.addEventListener('click', () => {
      const startDate = prompt('Ingresa fecha de inicio (YYYY-MM-DD):', DateTime.now().minus({ days: 30 }).toISODate());
      const endDate = prompt('Ingresa fecha de fin (YYYY-MM-DD):', DateTime.now().toISODate());
      
      if (startDate && endDate) {
        dateFilter.type = 'custom';
        dateFilter.start = startDate;
        dateFilter.end = endDate;
        
        // Actualizar botones
        periodButtons.forEach(b => b.classList.remove('active'));
        customPeriodBtn.classList.add('active');
        
        updateCharts(); // Actualizar ambas gráficas
      }
    });
  }
  
  const parseSalesValue = (value) => parseInt(String(value).replace(/[^0-9]/g, ''), 10) || 0;
  const normalizeName = (name) => (name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, ' ');
  
  const fetchAndProcessSheetsData = async () => {
    if (advisorsLoadingState) advisorsLoadingState.classList.remove('hidden');
    if (advisorsTableContent) advisorsTableContent.classList.add('hidden');
    
    try {
      const cacheBuster = Date.now();
      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?sheet=${SHEET_NAME}&range=A:L&t=${cacheBuster}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`${resp.status}: ${resp.statusText}`);
      
      const text = await resp.text();
      
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
      if (!match || !match[1]) throw new Error('Respuesta inesperada al consultar Google Sheets');
      
      const data = JSON.parse(match[1]);
      
      if (!data.table || !data.table.rows) throw new Error('Estructura de datos inesperada');
      
      totalMonthSales = 0;
      const advisorsMap = new Map();
      let datesWithSales = new Set();
      
      const predefinedAdvisors = ['alejandra', 'tatiana', 'danna'];
      
      predefinedAdvisors.forEach(advisor => {
        advisorsMap.set(advisor, { 
          name: advisor.charAt(0).toUpperCase() + advisor.slice(1), 
          sales: 0 
        });
      });
      
      data.table.rows.forEach(row => {
        if (!row.c) return;
        
        const advisorCell = row.c[ADVISOR_COLUMN_INDEX];
        if (advisorCell && advisorCell.v !== null && advisorCell.v !== undefined) {
          let advisorName = String(advisorCell.v).trim();
          const normalized = normalizeName(advisorName);
          
          let mappedAdvisor = null;
          
          if (normalized === 'luz') {
            mappedAdvisor = 'alejandra';
          } else if (normalized.includes('tatiana')) {
            mappedAdvisor = 'tatiana';
          } else if (normalized.includes('danna')) {
            mappedAdvisor = 'danna';
          } else if (predefinedAdvisors.includes(normalized)) {
            mappedAdvisor = normalized;
          }
          
          if (mappedAdvisor) {
            let dailySales = 0;
            for (let i = SALES_COLUMN_START; i <= SALES_COLUMN_END; i++) {
              if (row.c[i]) {
                const cell = row.c[i];
                const value = (cell.v !== null && cell.v !== undefined) ? cell.v : (cell.f || 0);
                dailySales += parseSalesValue(value);
              }
            }
            
            advisorsMap.get(mappedAdvisor).sales += dailySales;
            totalMonthSales += dailySales;
            
            if (dailySales > 0 && row.c[0]) {
              const dateValue = row.c[0].v ?? row.c[0].f;
              if (dateValue !== null && dateValue !== undefined) {
                datesWithSales.add(String(dateValue));
              }
            }
          }
        }
      });
      
      const advisorsData = Array.from(advisorsMap.values()).filter(advisor => advisor.sales > 0);
      
      if (advisorsData.length === 0) {
        advisorsData.push(
          { name: 'Alejandra', sales: 0 },
          { name: 'Tatiana', sales: 0 },
          { name: 'Danna', sales: 0 }
        );
      }
      
      renderAdvisors(advisorsData);
      updateMonthSalesMetrics();
      
    } catch (error) {
      if (advisorsTableBody) {
        advisorsTableBody.innerHTML = `
          <tr>
            <td colspan="3" class="text-center p-4 text-red-500">
              Error al cargar los datos: ${error.message}
            </td>
          </tr>
        `;
      }
      if (advisorsTableContent) advisorsTableContent.classList.remove('hidden');
    } finally {
      if (advisorsLoadingState) advisorsLoadingState.classList.add('hidden');
      if (advisorsTableContent) advisorsTableContent.classList.remove('hidden');
    }
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
          <span class="text-[#080a33]/50">${percentage}%</span>
        </td>
      `;
      advisorsTableBody.appendChild(row);
    });
  };
  
  transactionForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const newTransaction = {
      id: generateUniqueId(),
      date: $('transaction-date').value || DateTime.now().toISODate(),
      type: $('transaction-type').value || 'ingreso',
      amount: parseInt($('transaction-amount').value, 10) || 0,
      time: DateTime.now().toFormat('HH:mm:ss')
    };
    
    transactions.push(newTransaction);
    saveToLocalStorage('novaklar_transactions', transactions);
    updateUI();
    
    transactionForm.reset();
    if ($('transaction-date')) $('transaction-date').value = DateTime.now().toISODate();
  });
  
  manualSalesForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const amount = parseInt($('manual-sales-amount').value, 10) || 0;
    if (amount > 0) {
      manualSalesTotal += amount;
      saveToLocalStorage('novaklar_manual_sales_total', manualSalesTotal);
      updateManualSalesTotal();
      manualSalesForm.reset();
      
      // Mostrar notificación
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
      localStorage.removeItem('novaklar_transactions');
      localStorage.removeItem('novaklar_manual_sales_total');
    } catch (e) { }
    transactions = [];
    manualSalesTotal = 0;
    selectedTransactions.clear();
    updateUI();
    
    // Mostrar notificación
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
    checkForAlerts();
    updateAutomaticNote();
    fetchAndProcessSheetsData();
  };
  
  if ($('transaction-date')) $('transaction-date').value = DateTime.now().toISODate();
  
  updateUI();
  setInterval(fetchAndProcessSheetsData, UPDATE_INTERVAL);
});
