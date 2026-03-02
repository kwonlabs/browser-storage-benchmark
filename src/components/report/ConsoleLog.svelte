<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { LogLevel } from "../../stores/benchmark.svelte";
  import Terminal from "@lucide/svelte/icons/terminal";
  import Copy from "@lucide/svelte/icons/copy";
  import X from "@lucide/svelte/icons/x";

  let { store } = $props<{ store: any }>();
  let logContainer = $state<HTMLElement | undefined>();

  // Filters are now managed in the store to persist or we can keep them local
  let levels: LogLevel[] = $state(["info", "warn", "error"]);

  function scrollToBottom() {
    if (logContainer) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }

  // Filtered logs
  let filteredLogs = $derived(
    store.logs.filter((log: any) => levels.includes(log.level))
  );

  $effect(() => {
    if (filteredLogs.length > 0) {
      untrack(() => {
        setTimeout(scrollToBottom, 50);
      });
    }
  });

  onMount(scrollToBottom);

  function toggleLevel(level: LogLevel) {
    if (levels.includes(level)) {
      levels = levels.filter((l) => l !== level);
    } else {
      levels = [...levels, level];
    }
  }

  function copyToClipboard() {
    const text = store.logs
      .map(
        (l: any) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`
      )
      .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      store.addLog("Logs copied to clipboard.", "success", "info");
    });
  }
</script>

{#if store.consoleVisible}
  <div
    class="report-console {store.consoleOpen ? 'open' : 'closed'}"
    id="report-console"
  >
    <div
      class="console-header"
      onclick={() => (store.consoleOpen = !store.consoleOpen)}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          store.consoleOpen = !store.consoleOpen;
        }
      }}
      role="button"
      tabindex="0"
      aria-label="Toggle Console Details"
    >
      <div class="title">
        <Terminal size={18} color="#89b4fa" strokeWidth={2.5} />
        Console
      </div>
      <div
        class="console-actions-refined"
        onclick={(e) => e.stopPropagation()}
        role="presentation"
      >
        <div class="filters">
          {#each ["debug", "info", "warn", "error"] as level}
            <button
              class="filter-btn {level} {levels.includes(level as LogLevel)
                ? 'active'
                : ''}"
              onclick={() => toggleLevel(level as LogLevel)}
              title="Toggle {level} logs"
            >
              {level.toUpperCase()}
            </button>
          {/each}
        </div>
        <div class="divider"></div>
        <button
          class="console-action-btn-square"
          onclick={copyToClipboard}
          title="Copy all logs"
        >
          <Copy size={14} color="currentColor" strokeWidth={2} />
        </button>
        <button
          class="console-action-btn-square close-btn"
          onclick={() => (store.consoleVisible = false)}
          title="Close Console"
        >
          <X size={14} color="currentColor" strokeWidth={2} />
        </button>
      </div>
    </div>

    {#if store.consoleOpen}
      <div class="console-body" bind:this={logContainer}>
        {#if filteredLogs.length === 0}
          <div class="empty-state">
            No logs to display for selected filters.
          </div>
        {/if}
        {#each filteredLogs as log (log.id)}
          <div class="log-row {log.level} {log.type}">
            <span class="log-time">[{log.timestamp}]</span>
            <span class="log-level-badge">{log.level.toUpperCase()}</span>
            <span class="log-message">{log.message}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .report-console {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
    margin-top: 20px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .report-console.closed {
    max-height: 48px;
  }

  .console-header {
    background: #1e1e2e;
    color: #cdd6f4;
    padding: 8px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 13px;
    user-select: none;
    cursor: pointer;
    border-bottom: var(--border-color) solid 1px;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .console-actions-refined {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .filters {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .filter-btn {
    background: transparent;
    border: 1px solid #45475a;
    color: #6c7086;
    padding: 0 6px !important;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    box-sizing: border-box;
  }

  .filter-btn.active {
    color: #1e1e2e;
  }

  .filter-btn.debug.active {
    background: #94e2d5;
    border-color: #94e2d5;
  }
  .filter-btn.info.active {
    background: #89b4fa;
    border-color: #89b4fa;
  }
  .filter-btn.warn.active {
    background: #f9e2af;
    border-color: #f9e2af;
  }
  .filter-btn.error.active {
    background: #f38ba8;
    border-color: #f38ba8;
  }

  .divider {
    width: 1px;
    height: 12px;
    background: #45475a;
    margin: 0 2px;
  }

  /* Strong reset for square action buttons to avoid global selector collisions */
  button.console-action-btn-square {
    all: unset !important;
    box-sizing: border-box !important;
    cursor: pointer !important;
    width: 20px !important;
    height: 20px !important;
    min-width: 20px !important;
    min-height: 20px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    border-radius: 0 !important;
    transition: all 0.2s !important;
    flex-shrink: 0 !important;
    color: #cdd6f4 !important;
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    margin: 0 !important;
    line-height: 0 !important;
  }

  button.console-action-btn-square:hover {
    background: rgba(255, 255, 255, 0.1) !important;
    color: #89b4fa !important;
  }

  .console-body {
    height: 300px;
    background: #11111b;
    color: #cdd6f4;
    padding: 12px;
    overflow-y: auto;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 12px;
    line-height: 1.6;
  }

  .empty-state {
    color: #6c7086;
    text-align: center;
    padding-top: 100px;
    font-style: italic;
  }

  .log-row {
    display: flex;
    gap: 8px;
    padding: 2px 4px;
    border-radius: 2px;
    margin-bottom: 2px;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .log-row:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .log-time {
    color: #6c7086;
    flex-shrink: 0;
  }

  .log-level-badge {
    font-weight: bold;
    flex-shrink: 0;
    width: 50px;
  }

  .log-row.debug .log-level-badge {
    color: #94e2d5;
  }
  .log-row.info .log-level-badge {
    color: #89b4fa;
  }
  .log-row.warn .log-level-badge {
    color: #f9e2af;
  }
  .log-row.error .log-level-badge {
    color: #f38ba8;
  }

  .log-row.success .log-message {
    color: #a6e3a1;
  }
  .log-row.error .log-message {
    color: #f38ba8;
  }

  /* Custom Scrollbar */
  .console-body::-webkit-scrollbar {
    width: 8px;
  }
  .console-body::-webkit-scrollbar-track {
    background: #11111b;
  }
  .console-body::-webkit-scrollbar-thumb {
    background: #313244;
    border-radius: 4px;
  }
  .console-body::-webkit-scrollbar-thumb:hover {
    background: #45475a;
  }
</style>
