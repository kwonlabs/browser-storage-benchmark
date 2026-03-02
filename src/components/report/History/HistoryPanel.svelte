<script lang="ts">
    import { onMount } from "svelte";
    import {
        getAllSessions,
        deleteSession,
        clearAllSessions,
        type BenchmarkSession,
    } from "../../../lib/benchmarks/history.ts";
    import HistoryHeader from "./HistoryHeader.svelte";
    import HistoryItem from "./HistoryItem.svelte";
    import HistoryFooter from "./HistoryFooter.svelte";

    interface Props {
        store: any;
    }
    const { store }: Props = $props();

    let sessions = $state<BenchmarkSession[]>([]);

    onMount(async () => {
        sessions = await getAllSessions(store.type);
    });

    async function handleSessionClick(session: BenchmarkSession) {
        if (store.compareMode) {
            const idx = store.compareSelection.indexOf(session.id as number);
            if (idx >= 0) {
                store.compareSelection = store.compareSelection.filter(
                    (id: number) => id !== session.id,
                );
            } else if (store.compareSelection.length < 2) {
                store.compareSelection = [
                    ...store.compareSelection,
                    session.id,
                ];
            }
        } else {
            store.loadData(session.data);
            store.logs = session.logs || [];
            store.addLog(
                `Loaded ${session.type} history: ${session.sessionId || session.id}`,
                "success",
            );
            store.historyOpen = false;
        }
    }

    async function handleDelete(id: number) {
        if (confirm("Delete this session?")) {
            await deleteSession(store.type, id);
            sessions = sessions.filter((s) => s.id !== id);
            store.compareSelection = store.compareSelection.filter(
                (sid: number) => sid !== id,
            );
        }
    }

    async function handleCompare() {
        if (store.compareSelection.length !== 2) return;
        const s1 = sessions.find((x) => x.id === store.compareSelection[0]);
        const s2 = sessions.find((x) => x.id === store.compareSelection[1]);
        if (s1 && s2) {
            store.loadData(s1.data);
            store.compareData = s2.data;
            store.addLog(
                `Comparing ${store.type} sessions: ${s1.sessionId || s1.id} vs ${s2.sessionId || s2.id}`,
                "info",
            );
            store.historyOpen = false;
        }
    }

    async function handleClearAll() {
        if (confirm(`Clear all ${store.type} history?`)) {
            await clearAllSessions(store.type);
            sessions = [];
            store.compareSelection = [];
            store.compareData = null;
            store.addLog(`All ${store.type} history cleared.`, "success");
        }
    }

    function handleExport() {
        const dataStr = JSON.stringify(sessions, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `benchmark-${store.type}-history-${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async function handleImport(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const imported = JSON.parse(event.target?.result as string);
                if (Array.isArray(imported)) {
                    // In a real app we'd save these to IDB too, but for now just UI update
                    sessions = [...imported, ...sessions].sort(
                        (a, b) => b.id - a.id,
                    );
                    store.addLog(
                        `Imported ${imported.length} sessions (UI only).`,
                        "success",
                    );
                }
            } catch (err) {
                store.addLog("Import failed: Invalid JSON format", "error");
            }
        };
        reader.readAsText(file);
    }
</script>

{#if store.historyOpen}
    <div class="history-panel" id="history-panel">
        <HistoryHeader
            {store}
            onExport={handleExport}
            onImport={handleImport}
        />
        <div class="history-list" id="history-list">
            {#if sessions.length === 0}
                <div class="empty-state">No history found.</div>
            {:else}
                {#each sessions as session (session.id)}
                    <HistoryItem
                        {session}
                        selected={store.compareSelection.includes(session.id)}
                        onClick={handleSessionClick}
                        onDelete={handleDelete}
                    />
                {/each}
            {/if}
        </div>
        <HistoryFooter onCompare={handleCompare} onClearAll={handleClearAll} />
    </div>
{/if}
