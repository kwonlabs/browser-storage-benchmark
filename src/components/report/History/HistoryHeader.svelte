<script lang="ts">
  import Upload from "@lucide/svelte/icons/upload";
  import Download from "@lucide/svelte/icons/download";
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import X from "@lucide/svelte/icons/x";

  interface Props {
    store: any;
    onExport: () => void;
    onImport: (e: Event) => void;
  }
  const { store, onExport, onImport }: Props = $props();
</script>

<div class="history-header">
  <div class="history-title">
    {store.type === "storage" ? "Storage" : "Compression"} History
  </div>
  <div class="history-actions-top">
    <button class="btn-icon-s" title="Export JSON" onclick={onExport}>
      <Upload size={16} strokeWidth={2.5} />
    </button>
    <label class="btn-icon-s" title="Import JSON" style="cursor:pointer;">
      <Download size={16} strokeWidth={2.5} />
      <input
        type="file"
        accept=".json"
        style="display:none;"
        onchange={onImport}
      />
    </label>
    <button
      class="btn-icon-s {store.compareMode ? 'active' : ''}"
      title="Compare Mode"
      onclick={() => {
        store.compareMode = !store.compareMode;
        if (!store.compareMode) {
          store.compareSelection = [];
          store.compareData = null;
        }
      }}
    >
      <PanelLeft size={16} strokeWidth={2.5} />
    </button>
    <button
      class="btn-icon-s btn-close-s"
      title="Close"
      onclick={() => (store.historyOpen = false)}
    >
      <X size={16} strokeWidth={2.5} />
    </button>
  </div>
</div>
