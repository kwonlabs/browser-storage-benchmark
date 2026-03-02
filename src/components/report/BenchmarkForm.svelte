<script lang="ts">
    import { SIZE_METADATA } from "../../lib/benchmarks/constants.ts";

    interface Props {
        categoryChecks: Record<string, boolean>;
        sizeChecks: Record<string, boolean>;
        payloadChecks: Record<string, boolean>;
        hideTargets?: boolean;
        hidePayloads?: boolean;
        store?: any; // To differentiate 'storage' vs 'compression' in defaults
    }
    let {
        categoryChecks = $bindable(),
        sizeChecks = $bindable(),
        payloadChecks = $bindable(),
        hideTargets = false,
        hidePayloads = false,
        store = { type: "storage" }, // fallback
    }: Props = $props();
</script>

<div id="advanced-controller" class="advanced-panel-compact">
    <div class="matrix-controller">
        <div class="matrix-grid">
            {#if !hideTargets}
                <!-- Targets -->
                <div class="matrix-row">
                    <div class="row-label"><span>TARGETS</span></div>
                    <div class="row-content">
                        <div class="checkbox-list">
                            {#each Object.keys(categoryChecks) as cat}
                                <label>
                                    <input
                                        type="checkbox"
                                        class="category-check"
                                        bind:checked={categoryChecks[cat]}
                                        value={cat}
                                    />
                                    {cat === "low"
                                        ? "Volatile Storage"
                                        : cat === "high-native"
                                          ? "Persistent Native"
                                          : cat === "high-wrapper"
                                            ? "Persistent Library"
                                            : "Compression"}
                                </label>
                            {/each}
                        </div>
                    </div>
                    <div class="row-ops-inline">
                        <button
                            class="btn-text-mini"
                            onclick={() =>
                                Object.keys(categoryChecks).forEach(
                                    (k) => (categoryChecks[k] = true),
                                )}>All</button
                        >
                        <button
                            class="btn-text-mini"
                            onclick={() =>
                                Object.keys(categoryChecks).forEach(
                                    (k) => (categoryChecks[k] = false),
                                )}>None</button
                        >
                    </div>
                </div>
            {/if}

            <!-- Sizes -->
            <div class="matrix-row">
                <div class="row-label"><span>SIZES</span></div>
                <div class="row-content">
                    <div class="checkbox-list" id="size-checks-container">
                        {#each SIZE_METADATA as meta}
                            <label class={meta.warning ? "warning-label" : ""}>
                                <input
                                    type="checkbox"
                                    class="size-check"
                                    bind:checked={sizeChecks[meta.id]}
                                    value={meta.id}
                                />
                                {meta.label}{meta.warning ? "*" : ""}
                            </label>
                        {/each}
                    </div>
                </div>
                <div class="row-ops-inline">
                    <button
                        class="btn-text-mini"
                        onclick={() => {
                            SIZE_METADATA.forEach(
                                (meta) =>
                                    (sizeChecks[meta.id] =
                                        store.type === "storage"
                                            ? meta.storageDefault
                                            : meta.compressionDefault),
                            );
                        }}>Default</button
                    >
                    <button
                        class="btn-text-mini"
                        onclick={() =>
                            SIZE_METADATA.forEach(
                                (meta) => (sizeChecks[meta.id] = true),
                            )}>All</button
                    >
                    <button
                        class="btn-text-mini"
                        onclick={() =>
                            SIZE_METADATA.forEach(
                                (meta) => (sizeChecks[meta.id] = false),
                            )}>None</button
                    >
                </div>
            </div>

            {#if !hidePayloads}
                <!-- Data Type -->
                <div class="matrix-row">
                    <div class="row-label"><span>DATA TYPE</span></div>
                    <div class="row-content">
                        <div class="checkbox-list">
                            {#each [["text", "Text"], ["json", "JSON"], ["random", "Text Random"], ["binary", "Binary"], ["image", "Image"], ["pdf", "PDF"]] as [val, label]}
                                <label>
                                    <input
                                        type="checkbox"
                                        class="payload-check"
                                        bind:checked={
                                            payloadChecks[val as string]
                                        }
                                        value={val}
                                    />
                                    {label}
                                </label>
                            {/each}
                        </div>
                    </div>
                    <div class="row-ops-inline">
                        <button
                            class="btn-text-mini"
                            onclick={() => {
                                Object.keys(payloadChecks).forEach((k) => {
                                    if (store.type === "storage") {
                                        payloadChecks[k] = k === "json";
                                    } else {
                                        payloadChecks[k] = [
                                            "text",
                                            "json",
                                            "image",
                                        ].includes(k);
                                    }
                                });
                            }}>Default</button
                        >
                        <button
                            class="btn-text-mini"
                            onclick={() =>
                                Object.keys(payloadChecks).forEach(
                                    (k) => (payloadChecks[k] = true),
                                )}>All</button
                        >
                        <button
                            class="btn-text-mini"
                            onclick={() =>
                                Object.keys(payloadChecks).forEach(
                                    (k) => (payloadChecks[k] = false),
                                )}>None</button
                        >
                    </div>
                </div>
            {/if}
        </div>
    </div>
</div>
