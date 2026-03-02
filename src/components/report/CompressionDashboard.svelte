<script lang="ts">
  import { onMount } from "svelte";
  import Chart from "chart.js/auto";
  import { compressionStore as store } from "../../stores/benchmark.svelte.ts";
  import { benchmarkMetadata } from "../../lib/benchmarks/metadata.ts";
  import { SIZES, SIZE_METADATA } from "../../lib/benchmarks/constants.ts";

  // Components
  import ReportHeader from "./ReportHeader.svelte";
  import BenchmarkForm from "./BenchmarkForm.svelte";
  import ProgressBar from "./ProgressBar.svelte";
  import HistoryPanel from "./History/HistoryPanel.svelte";
  import SummaryDashboard from "./Dashboard/SummaryDashboard.svelte";
  import ConsoleLog from "./ConsoleLog.svelte";
  import CompressionChartSection from "./Charts/CompressionChartSection.svelte";

  // Local State (Compression focus)
  let categoryChecks = $state<Record<string, boolean>>({ compression: true });
  let sizeChecks = $state<Record<string, boolean>>({});
  let payloadChecks = $state<Record<string, boolean>>({});
  let payloadFilter = $state<string>("all");
  let showFloatingFilter = $state(false);
  let filterBarElement = $state<HTMLElement | null>(null);

  async function loadHistory() {
    console.log(`[Dashboard:${store.type}] History load requested`);
  }

  const chartRegistry = new Map<string, Chart>();

  onMount(() => {
    SIZE_METADATA.forEach((meta) => {
      sizeChecks[meta.id] = meta.compressionDefault;
    });
    ["text", "json", "random", "binary", "image", "pdf"].forEach(
      (p) => (payloadChecks[p] = ["text", "json", "image"].includes(p))
    );

    const observer = new MutationObserver(() => updateChartThemes());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    setTimeout(initAllCharts, 100);

    // Intersection Observer for floating filter
    const filterObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]) {
          showFloatingFilter = !entries[0].isIntersecting;
        }
      },
      { threshold: 0, rootMargin: "-80px 0px 0px 0px" }
    );

    if (filterBarElement) {
      filterObserver.observe(filterBarElement);
    }

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
    createChart(
      "compression-writeTime",
      "Compression Engines - Compress Speed (MB/s)"
    );
    createChart(
      "compression-readTime",
      "Compression Engines - Decompress Speed (MB/s)"
    );
    createChart(
      "compression-ratio",
      "Compression Engines - Compression Ratio (%)"
    );
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

    const isRatio = id.includes("ratio");
    const unit = isRatio ? "%" : "MB/s";

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
                  label += context.parsed.y.toFixed(2) + " " + unit;

                  if (isRatio) {
                    const sizeLabel =
                      context.chart.data.labels[context.dataIndex];
                    const originalSize = SIZES[sizeLabel] || 0;
                    const compressedSize =
                      originalSize * (context.parsed.y / 100);

                    let sizeStr = "";
                    if (compressedSize > 1024 * 1024) {
                      sizeStr =
                        (compressedSize / 1024 / 1024).toFixed(2) + " MB";
                    } else if (compressedSize > 1024) {
                      sizeStr = (compressedSize / 1024).toFixed(2) + " KB";
                    } else {
                      sizeStr = compressedSize.toFixed(0) + " B";
                    }
                    label += ` (${sizeStr})`;
                  }
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
                const remain =
                  value / Math.pow(10, Math.floor(Math.log10(value)));
                if (remain === 1 || remain === 2 || remain === 5) {
                  return value.toLocaleString() + " " + unit;
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

  function updateCompressionTrends() {
    try {
      const data = store.data.compression;
      const compareData = store.compareData?.compression;
      console.log(
        `[CompressionDashboard] Updating trends. Filter: ${payloadFilter}, HasData: ${!!data}`
      );
      if (!data) return;

      // X-axis: only sizes with data
      const actualSizes = Object.keys(data || {}).filter((s) => {
        const sizeData = (data as any)[s] || {};
        return Object.keys(sizeData).some(
          (pt) => Object.keys(sizeData[pt] || {}).length > 0
        );
      });

      const colorMap: Record<string, string> = {
        "ZLIB (Deflate)": "#FF6384",
        "DEFLATE (Raw)": "#36A2EB",
        GZIP: "#4BC0C0",
        ZIP: "#9966FF",
        Bzip2: "#FF9F40",
        LZMA: "#FFCE56",
        Snappy: "#C9CBCF",
        LZ4: "#4BC0C0",
        Brotli: "#8BC34A",
        Zstandard: "#E91E63",
        MessagePack: "#F472B6",
      };

      const metrics = [
        {
          id: "writeTime",
          key: "compressTime",
          scale: (v: number, s: string) =>
            (SIZES[s] || 0) / 1024 / 1024 / (v / 1000),
        },
        {
          id: "readTime",
          key: "decompressTime",
          scale: (v: number, s: string) =>
            (SIZES[s] || 0) / 1024 / 1024 / (v / 1000),
        },
        { id: "ratio", key: "ratio", scale: (v: any) => v },
      ];

      metrics.forEach((m) => {
        const chart = chartRegistry.get(`compression-${m.id}`);
        if (!chart) return;

        chart.data.labels = actualSizes;
        chart.data.datasets = [];

        const techs = new Set<string>();
        actualSizes.forEach((s) => {
          const sizeData = (data as any)[s] || {};
          Object.keys(sizeData).forEach((pt) =>
            Object.keys(sizeData[pt] || {}).forEach((t) => techs.add(t))
          );
        });

        techs.forEach((tech) => {
          const points = actualSizes.map((s) => {
            let sum = 0,
              count = 0;
            const sizeData = (data as any)[s] || {};
            Object.keys(sizeData).forEach((pt) => {
              if (payloadFilter !== "all" && pt !== payloadFilter) return;
              const val = sizeData[pt]?.[tech]?.[m.key];
              if (typeof val === "number" && val >= 0) {
                sum += (m.scale as any)(val, s);
                count++;
              }
            });
            if (count === 0) return null;
            const avg = sum / count;
            // Logarithmic scale cannot handle 0, use a small epsilon for visibility
            // Only apply this to time metrics, not ratio (though ratio is linear)
            return m.id !== "ratio" && avg === 0 ? 0.0001 : avg;
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
                if (payloadFilter !== "all" && pt !== payloadFilter) return;
                const val = sizeData[pt]?.[tech]?.[m.key];
                if (typeof val === "number" && val >= 0) {
                  sum += (m.scale as any)(val, s);
                  count++;
                }
              });
              if (count === 0) return null;
              const avg = sum / count;
              return m.id !== "ratio" && avg === 0 ? 0.0001 : avg;
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

        const emptyEl = document.getElementById(`empty-compression-${m.id}`);
        const wrapEl = document.getElementById(`wrap-compression-${m.id}`);
        const tableEl = document.getElementById(`table-compression-${m.id}`);
        const toggleEl = document.getElementById(`toggle-compression-${m.id}`);

        if (emptyEl && wrapEl && tableEl && toggleEl) {
          const hasPoints = chart.data.datasets.length > 0;
          emptyEl.style.display = hasPoints ? "none" : "block";
          wrapEl.style.display = hasPoints ? "block" : "none";
          toggleEl.style.display = hasPoints ? "block" : "none";
          if (hasPoints) {
            let html = `<table class="data-table"><thead><tr><th>Size${payloadFilter !== "all" ? ` (${payloadFilter.toUpperCase()})` : " (Average)"}</th>`;
            chart.data.datasets.forEach((d) => {
              const techName = (d.label || "").replace(" (Collate)", "");
              const meta = benchmarkMetadata.find(
                (m) => m.name === techName || m.id === techName
              );
              const specClass = meta?.specialization || "generic";
              const specLabel =
                specClass === "structured"
                  ? "Object"
                  : specClass === "binary"
                    ? "Binary"
                    : "Generic";

              html += `<th>
                            <div class="th-content">
                                <span>${d.label}</span>
                                <span class="spec-badge ${specClass}">${specLabel}</span>
                            </div>
                        </th>`;
            });
            html += `</tr></thead><tbody>`;
            actualSizes.forEach((sz, i) => {
              html += `<tr><td>${sz}</td>`;
              chart.data.datasets.forEach((d: any) => {
                const val = d.data[i];
                if (val === null) {
                  html += `<td>-</td>`;
                } else if (m.id === "ratio") {
                  // Calculate compressed size for table display
                  const originalSize = SIZES[sz] || 0;
                  const compSize = originalSize * (val / 100);
                  let sizeStr = "";
                  if (compSize > 1024 * 1024) {
                    sizeStr = (compSize / 1024 / 1024).toFixed(2) + " MB";
                  } else if (compSize > 1024) {
                    sizeStr = (compSize / 1024).toFixed(2) + " KB";
                  } else {
                    sizeStr = compSize.toFixed(0) + " B";
                  }
                  html += `<td><span class="ratio-val">${Number(val).toFixed(2)}%</span> <small class="size-val">(${sizeStr})</small></td>`;
                } else {
                  html += `<td>${Number(val).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>`;
                }
              });
              html += `</tr>`;
            });
            html += `</tbody></table>`;
            tableEl.innerHTML = html;
          }
        }
        chart.update("none");
      });
    } catch (err) {
      console.error("[CompressionDashboard] Error updating trends:", err);
    }
  }

  async function handleRun(_type: "all" | "custom") {
    const payloadTypes = Object.keys(payloadChecks).filter(
      (k) => payloadChecks[k]
    ) as any[];
    const selectedSizes = Object.keys(sizeChecks).filter((k) => sizeChecks[k]);
    const selectedUnits = benchmarkMetadata
      .filter((m) => m.category === "compression")
      .map((m) => m.id);

    if (payloadTypes.length === 0 || selectedSizes.length === 0) {
      store.addLog(
        "Selection error: At least one size and payload type required.",
        "error"
      );
      return;
    }

    let tasks: any[] = [];
    selectedSizes.forEach((sz) => {
      tasks.push({
        category: "compression",
        sizeName: sz,
        sizeValue: SIZES[sz],
      });
    });

    store.startRun(tasks, payloadTypes, selectedUnits);
  }

  $effect(() => {
    if (store.data || store.compareData || payloadFilter) {
      updateCompressionTrends();
    }
  });
</script>

<div class="report-content">
  <ReportHeader
    {store}
    icon="🗜️"
    title="Compression Performance"
    description="Compare compression ratios and speeds across different algorithms and data types."
    onRunCustom={() => handleRun("custom")}
    onLoadHistory={loadHistory}
    buttonColor="linear-gradient(135deg, #a78bfa, #f472b6)"
  />

  {#if store.advancedOpen}
    <BenchmarkForm
      bind:categoryChecks
      bind:sizeChecks
      bind:payloadChecks
      hideTargets={true}
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
        <p style="margin-bottom: 1.5rem;">No compression benchmark data yet.</p>
        <button
          class="btn-primary-large"
          onclick={() => handleRun("all")}
          style="background: linear-gradient(135deg, #a78bfa, #f472b6); border: none; box-shadow: 0 10px 25px -5px rgba(167, 139, 250, 0.4);"
          >▶ Run Compression Benchmark</button
        >
      </div>
    {/if}
    <div style="display: {store.hasData ? 'block' : 'none'}; width: 100%;">
      <div class="filter-bar" bind:this={filterBarElement}>
        <span class="filter-label">Payload Type:</span>
        <div class="filter-chips">
          <button
            class="filter-chip {payloadFilter === 'all' ? 'active' : ''}"
            onclick={() => (payloadFilter = "all")}
          >
            Overall (Average)
          </button>
          {#each ["text", "json", "random", "binary", "image", "pdf"] as p}
            {@const hasDataForType = Object.values(
              store.data.compression || {}
            ).some((s) => Object.keys(s[p] || {}).length > 0)}
            {#if hasDataForType}
              <button
                class="filter-chip {payloadFilter === p ? 'active' : ''}"
                onclick={() => (payloadFilter = p)}
              >
                {p.toUpperCase()}
              </button>
            {/if}
          {/each}
        </div>
      </div>
      <div class="report-grid">
        <CompressionChartSection title="Compression Performance Details" />
      </div>
    </div>
  </div>
</div>

{#if showFloatingFilter && store.hasData}
  <div class="floating-filter-container">
    <div class="floating-filter-glass">
      <div class="floating-label">Data Type</div>
      <div class="floating-chips">
        <button
          class="floating-chip {payloadFilter === 'all' ? 'active' : ''}"
          onclick={() => (payloadFilter = "all")}
        >
          AVG
        </button>
        {#each ["text", "json", "random", "binary", "image", "pdf"] as p}
          {@const hasDataForType = Object.values(
            store.data.compression || {}
          ).some((s) => Object.keys(s[p] || {}).length > 0)}
          {#if hasDataForType}
            <button
              class="floating-chip {payloadFilter === p ? 'active' : ''}"
              onclick={() => (payloadFilter = p)}
            >
              {p.toUpperCase()}
            </button>
          {/if}
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .report-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
    margin-top: 1rem;
  }

  .filter-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
  }

  .filter-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .filter-chips {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .filter-chip {
    padding: 0.35rem 0.85rem;
    font-size: 0.8rem;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .filter-chip:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .filter-chip.active {
    background: var(
      --accent-gradient,
      linear-gradient(135deg, #a78bfa, #f472b6)
    );
    border-color: transparent;
    color: white;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(167, 139, 250, 0.3);
  }

  .th-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .spec-badge {
    font-size: 0.65rem;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .spec-badge.generic {
    background: rgba(167, 139, 250, 0.15);
    color: #a78bfa;
    border: 1px solid rgba(167, 139, 250, 0.3);
  }

  .spec-badge.structured {
    background: rgba(52, 211, 153, 0.15);
    color: #34d399;
    border: 1px solid rgba(52, 211, 153, 0.3);
  }

  .spec-badge.binary {
    background: rgba(248, 113, 113, 0.15);
    color: #f87171;
    border: 1px solid rgba(248, 113, 113, 0.3);
  }

  :global([data-theme="light"]) .filter-bar {
    background: rgba(0, 0, 0, 0.02);
    border-color: rgba(0, 0, 0, 0.05);
  }
  :global([data-theme="light"]) .filter-chip {
    border-color: rgba(0, 0, 0, 0.1);
    color: #666;
  }
  :global([data-theme="light"]) .filter-chip:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  /* Floating Filter Styles */
  .floating-filter-container {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    z-index: 1000;
    animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes slideIn {
    from {
      transform: translateY(20px) scale(0.9);
      opacity: 0;
    }
    to {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }

  .floating-filter-glass {
    padding: 1rem 0.75rem;
    background: rgba(23, 23, 23, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 100px;
    align-items: center;
  }

  :global([data-theme="light"]) .floating-filter-glass {
    background: rgba(255, 255, 255, 0.85);
    border-color: rgba(0, 0, 0, 0.1);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  }

  .floating-label {
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--text-muted);
    letter-spacing: 0.08em;
    text-align: center;
    opacity: 0.8;
  }

  .floating-chips {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    align-items: stretch;
  }

  .floating-chip {
    padding: 0.4rem 0.6rem;
    font-size: 0.7rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
  }

  :global([data-theme="light"]) .floating-chip {
    border-color: rgba(0, 0, 0, 0.08);
    background: rgba(0, 0, 0, 0.04);
    color: #555;
  }

  .floating-chip:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }

  :global([data-theme="light"]) .floating-chip:hover {
    background: rgba(0, 0, 0, 0.08);
    border-color: rgba(0, 0, 0, 0.2);
  }

  .floating-chip.active {
    background: var(
      --accent-gradient,
      linear-gradient(135deg, #a78bfa, #f472b6)
    );
    border-color: transparent;
    color: white;
    box-shadow: 0 6px 15px rgba(167, 139, 250, 0.4);
    transform: translateY(-1px);
  }
</style>
