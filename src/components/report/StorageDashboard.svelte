<script lang="ts">
  import { onMount } from "svelte";
  import Chart from "chart.js/auto";
  import { storageStore as store } from "../../stores/benchmark.svelte.ts";
  import {
    categoryMetadata,
    benchmarkMetadata,
  } from "../../lib/benchmarks/metadata.ts";
  import { getBenchmarksByCategory } from "../../lib/benchmarks/index.ts";
  import { SIZES, SIZE_METADATA } from "../../lib/benchmarks/constants.ts";

  // Components
  import ReportHeader from "./ReportHeader.svelte";
  import BenchmarkForm from "./BenchmarkForm.svelte";
  import ProgressBar from "./ProgressBar.svelte";
  import HistoryPanel from "./History/HistoryPanel.svelte";
  import SummaryDashboard from "./Dashboard/SummaryDashboard.svelte";
  import ConsoleLog from "./ConsoleLog.svelte";
  import StorageChartSection from "./Charts/StorageChartSection.svelte";

  // Local State for BenchmarkForm
  let categoryChecks = $state<Record<string, boolean>>({
    low: true,
    "high-native": true,
    "high-wrapper": true,
  });
  let sizeChecks = $state<Record<string, boolean>>({});
  let payloadChecks = $state<Record<string, boolean>>({});

  async function loadHistory() {
    console.log(`[Dashboard:${store.type}] History load requested`);
  }

  // Chart Registry
  const chartRegistry = new Map<string, Chart>();

  onMount(() => {
    SIZE_METADATA.forEach((meta) => {
      sizeChecks[meta.id] = meta.storageDefault;
    });
    ["text", "json", "random", "binary", "image", "pdf"].forEach(
      (p) => (payloadChecks[p] = p === "json")
    );

    const observer = new MutationObserver(() => updateChartThemes());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    setTimeout(initAllCharts, 100);

    // Auto-run if requested via query param
    const params = new URLSearchParams(window.location.search);
    if (params.get("run") === "default") {
      setTimeout(() => handleRun("all"), 500);
    } else {
      // Load latest history if not running a new test
      setTimeout(() => store.loadLatestHistory?.(), 200);
    }

    return () => observer.disconnect();
  });

  function initAllCharts() {
    ["low", "high-native", "high-wrapper"].forEach((catId) => {
      const catMeta = categoryMetadata.find((c) =>
        c.categories?.includes(catId as any)
      );
      const categoryTitle = catMeta?.title || "Storage";
      ["write", "read", "update", "delete"].forEach((op) => {
        const opTitle =
          op === "write" ? "Write" : op.charAt(0).toUpperCase() + op.slice(1);
        createChart(`${catId}-${op}`, `${categoryTitle} - ${opTitle} (ms)`);
      });
    });
  }

  function createChart(id: string, label: string) {
    const ctx = (
      document.getElementById(`chart-trend-${id}`) as HTMLCanvasElement
    )?.getContext("2d");
    if (!ctx) return;

    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    const gridColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)";
    const textColor = isDark ? "#a0a0a0" : "#666";

    const chart = new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: label,
            color: textColor,
            font: { size: 14, family: "'Inter', sans-serif" },
            padding: { bottom: 15 },
          },
          legend: {
            labels: {
              usePointStyle: true,
              boxWidth: 4,
              boxHeight: 4,
              font: { size: 10 },
              color: textColor,
            },
          },
          tooltip: {
            callbacks: {
              label: function (context: any) {
                let label = context.dataset.label || "";
                if (label) label += ": ";
                if (context.parsed.y !== null) {
                  label += context.parsed.y.toFixed(3) + " ms";
                }
                return label;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 9 } },
          },
          y: {
            type: "logarithmic",
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { size: 9 },
              callback: function (value: any) {
                // Filter to show mostly power-of-10 or simple numbers for cleaner log axis
                const remain =
                  value / Math.pow(10, Math.floor(Math.log10(value)));
                if (remain === 1 || remain === 2 || remain === 5) {
                  return value.toLocaleString() + " ms";
                }
                return null;
              },
            },
          },
        },
        animation: false,
      },
    });
    chartRegistry.set(id, chart);
  }

  function updateChartThemes() {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    const gridColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)";
    const textColor = isDark ? "#a0a0a0" : "#666";

    chartRegistry.forEach((chart) => {
      if (chart.options.scales?.x?.grid)
        (chart.options.scales.x.grid as any).color = gridColor;
      if (chart.options.scales?.y?.grid)
        (chart.options.scales.y.grid as any).color = gridColor;
      if (chart.options.scales?.x?.ticks)
        chart.options.scales.x.ticks.color = textColor;
      if (chart.options.scales?.y?.ticks)
        chart.options.scales.y.ticks.color = textColor;
      if (chart.options.plugins?.title)
        chart.options.plugins.title.color = textColor;
      if (chart.options.plugins?.legend?.labels)
        chart.options.plugins.legend.labels.color = textColor;
      chart.update("none");
    });
  }

  function updateStorageTrends() {
    const colorMap: Record<string, string> = {
      Cookie: "#FF6384",
      LocalStorage: "#36A2EB",
      SessionStorage: "#FFCE56",
      IndexedDB: "#4BC0C0",
      "OPFS (Async)": "#9966FF",
      "OPFS (Sync)": "#FF9F40",
      "SQLite (Async)": "#C9CBCF",
      "SQLite (Sync)": "#7B1FA2",
      localForage: "#2E7D32",
      "Dexie.js": "#D84315",
      PouchDB: "#00838F",
      store2: "#F9A825",
    };

    ["low", "high-native", "high-wrapper"].forEach((cat) => {
      const suiteType = cat === "low" ? "low" : "high";
      const targetData = store.data[suiteType];
      const compareData = store.compareData?.[suiteType];

      // Filter valid techs for this specific category
      const validTechs = getBenchmarksByCategory(cat).map((b) => b.name);

      ["write", "read", "update", "delete"].forEach((op) => {
        const chart = chartRegistry.get(`${cat}-${op}`);
        if (!chart) return;

        // X-axis: only sizes with actual data
        const actualSizes = Object.keys(targetData || {}).filter((s) => {
          const sizeData = (targetData as any)[s] || {};
          return Object.keys(sizeData).some((pt) => {
            const ptData = sizeData[pt] || {};
            return Object.keys(ptData).some((t) => {
              if (!validTechs.includes(t)) return false;
              const val = ptData[t]?.[op === "write" ? "insert" : op];
              return typeof val === "number" && val >= 0;
            });
          });
        });

        chart.data.labels = actualSizes;
        chart.data.datasets = [];

        const techs = new Set<string>();
        actualSizes.forEach((s) => {
          const sizeData = (targetData as any)[s] || {};
          Object.keys(sizeData).forEach((pt) => {
            Object.keys(sizeData[pt] || {}).forEach((t) => {
              if (validTechs.includes(t)) techs.add(t);
            });
          });
        });

        techs.forEach((tech) => {
          const points = actualSizes.map((s) => {
            let sum = 0,
              count = 0;
            const sizeData = (targetData as any)[s] || {};
            Object.keys(sizeData).forEach((pt) => {
              const val =
                sizeData[pt]?.[tech]?.[op === "write" ? "insert" : op];
              if (typeof val === "number" && val >= 0) {
                sum += val;
                count++;
              }
            });
            if (count === 0) return null;
            const avg = sum / count;
            // Logarithmic scale cannot handle 0, use a small epsilon for visibility
            return avg === 0 ? 0.0001 : avg;
          });

          if (points.some((p) => p !== null)) {
            chart.data.datasets.push({
              label: tech,
              data: points as any,
              borderColor: colorMap[tech] || "#888",
              backgroundColor: (colorMap[tech] || "#888") + "33",
              tension: 0.3,
              borderWidth: 2,
              pointRadius: 2,
            });
          }

          if (compareData) {
            const compPoints = actualSizes.map((s) => {
              let sum = 0,
                count = 0;
              const sizeData = (compareData as any)[s] || {};
              Object.keys(sizeData).forEach((pt) => {
                const val =
                  sizeData[pt]?.[tech]?.[op === "write" ? "insert" : op];
                if (typeof val === "number" && val >= 0) {
                  sum += val;
                  count++;
                }
              });
              return count > 0 ? sum / count : null;
            });
            if (compPoints.some((p) => p !== null)) {
              chart.data.datasets.push({
                label: `${tech} (Collate)`,
                data: compPoints as any,
                borderColor: colorMap[tech] || "#888",
                borderDash: [5, 5],
                tension: 0.3,
                borderWidth: 1.5,
                pointRadius: 1,
              });
            }
          }
        });

        const emptyEl = document.getElementById(`empty-${cat}-${op}`);
        const wrapEl = document.getElementById(`wrap-${cat}-${op}`);
        const tableEl = document.getElementById(`table-${cat}-${op}`);
        const toggleEl = document.getElementById(`toggle-${cat}-${op}`);

        if (emptyEl && wrapEl && tableEl && toggleEl) {
          const hasPoints = chart.data.datasets.length > 0;
          emptyEl.style.display = hasPoints ? "none" : "block";
          wrapEl.style.display = hasPoints ? "block" : "none";
          toggleEl.style.display = hasPoints ? "block" : "none";

          if (hasPoints) {
            let html = `<table class="data-table"><thead><tr><th>Size (Payload)</th>`;
            chart.data.datasets.forEach((d) => (html += `<th>${d.label}</th>`));
            html += `</tr></thead><tbody>`;
            actualSizes.forEach((sz, i) => {
              html += `<tr><td>${sz}</td>`;
              chart.data.datasets.forEach((d: any) => {
                const val = d.data[i];
                html += `<td>${val !== null ? Number(val).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "-"}</td>`;
              });
              html += `</tr>`;
            });
            html += `</tbody></table>`;
            tableEl.innerHTML = html;
          }
        }
        chart.update("none");
      });
    });
  }

  async function handleRun(type: "all" | "custom") {
    const payloadTypes = Object.keys(payloadChecks).filter(
      (k) => payloadChecks[k]
    ) as any[];
    const selectedSizes = Object.keys(sizeChecks).filter((k) => sizeChecks[k]);
    let selectedUnits: string[] = [];

    const storageCategories = ["low", "high-native", "high-wrapper"];
    if (type === "all") {
      selectedUnits = benchmarkMetadata
        .filter((m) => storageCategories.includes(m.category))
        .map((m) => m.id);
    } else {
      const selectedCategories = Object.keys(categoryChecks).filter(
        (k) => categoryChecks[k]
      );
      selectedUnits = benchmarkMetadata
        .filter((m) => selectedCategories.includes(m.category))
        .map((m) => m.id);
    }

    if (
      selectedUnits.length === 0 ||
      payloadTypes.length === 0 ||
      selectedSizes.length === 0
    ) {
      store.addLog(
        "Selection error: At least one target, size, and payload type required.",
        "error"
      );
      return;
    }

    let tasks: any[] = [];
    const activeCats = new Set(
      selectedUnits.map(
        (uid) => benchmarkMetadata.find((m) => m.id === uid)?.category
      )
    );
    activeCats.forEach((cat) => {
      if (!cat) return;
      selectedSizes.forEach((sz) => {
        tasks.push({
          category: cat,
          sizeName: sz,
          sizeValue: SIZES[sz],
        });
      });
    });

    store.startRun(tasks, payloadTypes, selectedUnits);
  }

  $effect(() => {
    if (store.data || store.compareData) setTimeout(updateStorageTrends, 0);
  });
</script>

<div class="report-content">
  <ReportHeader
    {store}
    icon="📊"
    title="Storage Performance"
    description="Analyze read, write, update and delete performance scalability across various storage engines."
    onRunCustom={() => handleRun("custom")}
    onLoadHistory={loadHistory}
    buttonColor="linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))"
  />

  {#if store.advancedOpen}
    <BenchmarkForm
      bind:categoryChecks
      bind:sizeChecks
      bind:payloadChecks
      hideTargets={true}
      hidePayloads={true}
      {store}
    />
  {/if}

  <ProgressBar
    percent={store.progress.percent}
    message={store.progress.message}
    visible={store.isRunning || store.progress.percent > 0}
  />

  <ConsoleLog {store} />
  <SummaryDashboard {store} />
  {#if store.historyOpen}
    <HistoryPanel {store} />
  {/if}

  <div class="report-grid">
    {#if !store.isRunning && !store.hasData}
      <div
        class="empty-state"
        style="margin: 2rem 0; font-size: 1.1rem; grid-column: 1 / -1; text-align:center;"
      >
        <p style="margin-bottom: 1.5rem;">No storage benchmark data yet.</p>
        <button
          class="btn-primary-large"
          onclick={() => handleRun("all")}
          style="background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));"
          >▶ Run Storage Benchmark</button
        >
      </div>
    {/if}
    <div style="display: {store.hasData ? 'contents' : 'none'};">
      {#each categoryMetadata as any[] as sec}
        {#if sec.categories && sec.categories.some( (c: any) => ["low", "high-native", "high-wrapper"].includes(c) )}
          <StorageChartSection
            category={sec.categories[0] as string}
            title={sec.title || "Storage"}
          />
        {/if}
      {/each}
    </div>
  </div>
</div>

<style>
  .report-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 3rem;
    margin-top: 1rem;
  }
</style>
