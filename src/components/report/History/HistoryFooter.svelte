<script lang="ts">
    import { benchmarkStore } from "../../../stores/benchmark.svelte.ts";

    const store = benchmarkStore;
    interface Props {
        onCompare: () => void;
        onClearAll: () => void;
    }
    const { onCompare, onClearAll }: Props = $props();

    function exitComparison() {
        store.compareMode = false;
        store.compareSelection = [];
        store.compareData = null;
    }
</script>

<div
    class="history-footer"
    style="display: flex; gap: 0.5rem; flex-direction: column;"
>
    {#if store.compareMode}
        <button
            class="btn-primary-large-s"
            style="width: 100%;"
            disabled={store.compareSelection.length !== 2}
            onclick={onCompare}
        >
            Compare Selected ({store.compareSelection.length}/2)
        </button>
        <button
            class="btn-outline"
            style="width: 100%;"
            onclick={exitComparison}
        >
            Exit Comparison
        </button>
    {/if}
    <button class="btn-danger-text" onclick={onClearAll}>
        Clear All History
    </button>
</div>
