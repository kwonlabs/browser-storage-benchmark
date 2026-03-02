<script lang="ts">
  import Play from "@lucide/svelte/icons/play";
  import Clock from "@lucide/svelte/icons/clock";

  interface Props {
    store: any;
    icon?: string;
    title: string;
    description: string;
    onRunCustom: () => void;
    onLoadHistory: () => Promise<void>;
    buttonColor?: string;
  }
  let {
    store,
    icon,
    title,
    description,
    onRunCustom,
    onLoadHistory,
    buttonColor,
  }: Props = $props();
</script>

<div class="report-header">
  <div class="header-top">
    <h2>
      {#if icon}<span class="header-icon">{icon}</span>{/if}
      {title}
    </h2>
    <div class="report-actions">
      {#if !store.isRunning}
        <button
          id="btn-report-run"
          class="btn-primary-large-s"
          onclick={onRunCustom}
          style={buttonColor ? `background: ${buttonColor};` : ""}
        >
          <Play size={18} strokeWidth={3} fill="currentColor" />
          Run
        </button>
      {:else}
        <button class="btn-cancel btn-outline" onclick={() => store.cancelRun()}
          >Cancel</button
        >
      {/if}
      <button
        class="btn-outline"
        onclick={() => (store.advancedOpen = !store.advancedOpen)}
      >
        Advanced <span class="toggle-arrow"
          >{store.advancedOpen ? "▲" : "▼"}</span
        >
      </button>
      <button
        class="btn-outline"
        onclick={async () => {
          store.historyOpen = !store.historyOpen;
          if (store.historyOpen) await onLoadHistory();
        }}
      >
        <Clock size={18} strokeWidth={2} />
        History
      </button>
    </div>
  </div>
  <div class="header-bottom">
    <p>{description}</p>
    <button
      class="console-toggle-small"
      onclick={() => (store.consoleVisible = !store.consoleVisible)}
    >
      {store.consoleVisible ? "Hide Console" : "Show Console"}
    </button>
  </div>
</div>

<style>
  .header-icon {
    margin-right: 0.5rem;
    opacity: 0.8;
  }

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    gap: 1rem;
  }

  .header-bottom {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
  }

  .header-bottom p {
    margin: 0;
    flex: 1;
  }

  .console-toggle-small {
    background: transparent;
    border: none;
    color: #555;
    font-size: 12px;
    text-decoration: none;
    cursor: pointer;
    padding: 4px 0;
    opacity: 0.85;
    transition: all 0.2s ease;
    font-family: inherit;
    white-space: nowrap;
  }

  .console-toggle-small:hover {
    opacity: 1;
    color: #777;
  }

  .console-toggle-small:active {
    transform: scale(0.98);
  }
</style>
