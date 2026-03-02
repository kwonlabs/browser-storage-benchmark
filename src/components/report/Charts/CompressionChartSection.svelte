<script lang="ts">
  import ChartItem from "./ChartItem.svelte";

  interface Props {
    title: string;
  }
  const { title }: Props = $props();
</script>

<div class="report-section">
  <h3 class="section-title">{title}</h3>
  <div id="compression-charts-container" class="trend-layout-vertical">
    <ChartItem id="compression-writeTime" />
    <ChartItem id="compression-readTime" />
    <ChartItem id="compression-ratio" />
  </div>
</div>
