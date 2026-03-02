<script lang="ts">
  interface Props {
    id: string;
    emptyMessage?: string;
  }
  const { id, emptyMessage = "No data available." }: Props = $props();
  let showTable = $state(false);
</script>

<div class="report-chart-item" id="item-{id}">
  <div class="empty-state" id="empty-{id}">
    {emptyMessage}<br /><small>Run Benchmark to see results.</small>
  </div>
  <div class="chart-wrapper" id="wrap-{id}" style="display:none;">
    <canvas id="chart-trend-{id}"></canvas>
  </div>
  <div class="data-table-toggle" id="toggle-{id}" style="display:none;">
    <button
      class="btn-text-mini btn-toggle-table"
      class:active={showTable}
      onclick={() => (showTable = !showTable)}
      >Data Table ({id.split("-").pop()}) {showTable ? "▲" : "▼"}</button
    >
  </div>
  <div
    class="data-table-container"
    id="table-{id}"
    style="display: {showTable ? 'block' : 'none'};"
  ></div>
</div>
