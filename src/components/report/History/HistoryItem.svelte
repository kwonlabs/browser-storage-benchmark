<script lang="ts">
    import Trash2 from "@lucide/svelte/icons/trash-2";
    import type { BenchmarkSession } from "../../../lib/benchmarks/history.ts";
    import { formatDate } from "../../../lib/utils/ua.ts";

    interface Props {
        session: BenchmarkSession;
        selected: boolean;
        onClick: (session: BenchmarkSession) => void;
        onDelete: (id: number) => void;
    }
    const { session, selected, onClick, onDelete }: Props = $props();

    const idStr = $derived(
        session.sessionId || `#${String(session.id).slice(-4)}`,
    );
    const dateStr = $derived(formatDate(session.date || session.id));
</script>

<div
    class="history-item {selected ? 'selected' : ''}"
    onclick={() => onClick(session)}
    onkeydown={(e) => e.key === "Enter" && onClick(session)}
    tabindex="0"
    role="button"
>
    <div class="history-content">
        <div class="row-top">
            <span class="session-id">#{idStr}</span>
            <div class="ua-info">
                <span class="os">{session.os || ""}</span>
                <span class="separator">·</span>
                <span class="browser">{session.browser || ""}</span>
            </div>
        </div>
        <div class="row-bottom">
            <span class="date">{dateStr}</span>
            <button
                class="btn-delete"
                title="Delete Session"
                onclick={(e) => {
                    e.stopPropagation();
                    onDelete(session.id);
                }}
            >
                <Trash2 size={16} strokeWidth={2.5} />
            </button>
        </div>
    </div>
</div>

<style>
    .history-item {
        display: flex;
        flex-direction: column;
        width: 100%;
        padding: 0.85rem 1.25rem;
        cursor: pointer;
        border-bottom: 1px solid var(--border-color);
        transition: background-color 0.2s ease;
        box-sizing: border-box;
        position: relative;
        outline: none;
    }

    .history-item:hover {
        background-color: var(--bg-card-hover);
    }

    /* Use inset box-shadow instead of border-left to prevent layout shift/jitter */
    .history-item.selected {
        background-color: var(--bg-card);
        box-shadow: inset 4px 0 0 var(--accent-primary);
    }

    .history-content {
        display: flex;
        flex-direction: column;
        gap: 0.35rem; /* Tighter gap */
        width: 100%;
        text-align: left;
    }

    .row-top {
        display: flex;
        align-items: center;
        gap: 0.6rem;
    }

    .session-id {
        font-family: var(--font-mono);
        font-weight: 700;
        font-size: 0.95rem;
        color: var(--accent-primary);
    }

    .ua-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
        font-weight: 500;
    }

    .os {
        color: var(--text-muted);
    }

    .separator {
        color: var(--border-color);
        opacity: 0.5;
    }

    .browser {
        color: var(--accent-secondary);
    }

    .row-bottom {
        display: flex;
        justify-content: space-between;
        align-items: center;
        min-height: 24px; /* Ensure consistent height for the second row */
    }

    .date {
        font-size: 0.82rem;
        color: var(--text-muted);
        font-family: var(--font-mono);
    }

    .btn-delete {
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: all 0.2s;
        margin-right: -4px; /* Align with right edge nicely */
    }

    .btn-delete:hover {
        background: rgba(239, 68, 68, 0.1);
        color: var(--status-error);
    }
</style>
