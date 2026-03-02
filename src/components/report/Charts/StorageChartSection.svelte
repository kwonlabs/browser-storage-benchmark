<script lang="ts">
    import ChartItem from "./ChartItem.svelte";

    interface Props {
        category: string;
        title: string;
    }
    const { category, title }: Props = $props();
    const ops = ["write", "read", "update", "delete"];
</script>

<div class="report-section">
    <h3 class="section-title">{title}</h3>
    <div class="trend-layout-storage">
        {#each ops as op}
            <ChartItem id="{category}-{op}" />
        {/each}
    </div>
</div>
