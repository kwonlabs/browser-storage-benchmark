import './style.css';
import { SIZES } from './constants';
import type { TaskDef } from './types';
import { initRouter, handleRouting } from './router';
import { addLog, initCharts, initUIListeners, updateTrendCharts } from './ui';
import { startBenchmark, latestData, setLatestData } from './runner';
import { getLatestSession } from './lib/db';

// DOM Elements
const btnRunAll = document.getElementById('btn-run-all') as HTMLButtonElement;
const btnReportRun = document.getElementById('btn-report-run') as HTMLButtonElement;
const btnToggleAdvanced = document.getElementById('btn-toggle-advanced') as HTMLAnchorElement;
const advancedPanel = document.getElementById('advanced-controller') as HTMLDivElement;
const btnExport = document.getElementById('btn-export-json') as HTMLButtonElement;
const btnImport = document.getElementById('btn-import-json') as HTMLButtonElement;
const inputImport = document.getElementById('input-import-json') as HTMLInputElement;

const logo = document.querySelector('.logo') as HTMLDivElement;
logo.addEventListener('click', () => {
  window.history.pushState({}, '', '/');
  handleRouting();
});

const categoryChecks = document.querySelectorAll('.category-check') as NodeListOf<HTMLInputElement>;
const sizeChecks = document.querySelectorAll('.size-check') as NodeListOf<HTMLInputElement>;
const btnCatAll = document.getElementById('cat-all') as HTMLButtonElement;
const btnCatNone = document.getElementById('cat-none') as HTMLButtonElement;
const btnSizeAll = document.getElementById('size-all') as HTMLButtonElement;
const btnSizeNone = document.getElementById('size-none') as HTMLButtonElement;
const btnSizeDefault = document.getElementById('size-default') as HTMLButtonElement;

// Initialization
async function initializeApp() {
  initCharts();
  initRouter();
  initUIListeners(latestData);

  // Load Latest Data
  const session = await getLatestSession();
  if (session) {
    setLatestData(session.data);
    updateTrendCharts(latestData);
    addLog('Auto-loaded latest session from storage.');
  }

  // Restore Tab (URL path)
  handleRouting();
}

// Event Listeners for UI
btnToggleAdvanced.addEventListener('click', (e) => {
  e.preventDefault();
  const isHidden = advancedPanel.style.display === 'none';
  advancedPanel.style.display = isHidden ? 'block' : 'none';
  btnToggleAdvanced.classList.toggle('toggle-active', isHidden);
});

btnCatAll.addEventListener('click', () => categoryChecks.forEach(c => c.checked = true));
btnCatNone.addEventListener('click', () => categoryChecks.forEach(c => c.checked = false));
btnSizeAll.addEventListener('click', () => sizeChecks.forEach(c => c.checked = true));
btnSizeNone.addEventListener('click', () => sizeChecks.forEach(c => c.checked = false));

btnSizeDefault.addEventListener('click', () => {
  const defaults = ['128b', '1kb', '10kb', '100kb', '1mb', '10mb'];
  sizeChecks.forEach(c => c.checked = defaults.includes(c.value));
});

// Benchmark Runners
function runBenchmarkFromUI(isAdvanced: boolean) {
  let selectedCats: string[];
  let selectedSizes: string[];

  if (isAdvanced) {
    selectedCats = Array.from(categoryChecks).filter(c => c.checked).map(c => c.value);
    selectedSizes = Array.from(sizeChecks).filter(c => c.checked).map(c => c.value);

    if (selectedCats.length === 0 || selectedSizes.length === 0) {
      alert('Select at least one category and size.');
      return;
    }

    const hasLarge = selectedSizes.some(s => s === '100mb' || s === '1gb');
    if (hasLarge) {
      if (!confirm('Benchmark with 100MB+ data may freeze the browser. Proceed?')) return;
    }

    advancedPanel.style.display = 'none';
    btnToggleAdvanced.classList.remove('toggle-active');
  } else {
    selectedCats = ['low', 'high'];
    selectedSizes = ['128b', '1kb', '10kb', '100kb', '1mb', '10mb'];
  }

  const tasks: TaskDef[] = [];
  selectedSizes.forEach(s => selectedCats.forEach(c => tasks.push({
    category: c,
    sizeName: s,
    sizeValue: SIZES[s as keyof typeof SIZES]
  })));

  startBenchmark(tasks);
}

btnReportRun.addEventListener('click', () => runBenchmarkFromUI(true));
btnRunAll.addEventListener('click', () => runBenchmarkFromUI(false));

// Import / Export
btnExport.addEventListener('click', () => {
  const dataStr = JSON.stringify(latestData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `benchmark_results_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  addLog('Results exported as JSON.');
});

btnImport.addEventListener('click', () => inputImport.click());
inputImport.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (re) => {
    try {
      const data = JSON.parse(re.target?.result as string);
      setLatestData(data);
      addLog('Data imported from JSON. Regenerating charts...');
      updateTrendCharts(latestData);
      addLog('Charts regenerated successfully.', 'success');
    } catch (err) {
      addLog('Failed to import JSON: Invalid format.', 'error');
    }
  };
  reader.readAsText(file);
});

// Boot
initializeApp();
