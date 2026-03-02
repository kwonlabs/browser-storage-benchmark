<script lang="ts">
  import SummaryCard from "./SummaryCard.svelte";
  import type {
    BenchmarkData,
    PayloadType,
  } from "../../../lib/benchmarks/types.ts";
  import { SIZES } from "../../../lib/benchmarks/constants.ts";

  interface Props {
    store: any;
  }
  let { store }: Props = $props();

  let summary = $derived(computeSummary(store.data, store.type));

  function computeSummary(
    data: BenchmarkData,
    type: "storage" | "compression"
  ) {
    let bestWrite = Infinity,
      bestWriteTech = "--";
    let bestRead = Infinity,
      bestReadTech = "--";
    let bestUpdate = Infinity,
      bestUpdateTech = "--";
    let bestDelete = Infinity,
      bestDeleteTech = "--";

    let bestCompress = 0,
      bestCompressTech = "--";
    let bestDecompress = 0,
      bestDecompressTech = "--";
    let bestRatio = Infinity,
      bestRatioTech = "--";

    let totalTime = 0;

    const skipList = ["Cookie", "SessionStorage", "LocalStorage", "store2"];
    const payloadTypes: PayloadType[] = [
      "text",
      "json",
      "random",
      "binary",
      "image",
      "pdf",
    ];

    if (type === "storage") {
      ["low", "high"].forEach((cat) => {
        const catData = data[cat as "low" | "high"];
        if (!catData) return;
        Object.keys(catData).forEach((size) => {
          payloadTypes.forEach((pt) => {
            const sizeData = (catData as any)[size]?.[pt];
            if (!sizeData) return;
            Object.keys(sizeData).forEach((tech) => {
              const entry = sizeData[tech];
              if (!entry) return;

              if (entry.insert > 0) {
                totalTime += entry.insert;
                if (!skipList.includes(tech) && entry.insert < bestWrite) {
                  bestWrite = entry.insert;
                  bestWriteTech = tech;
                }
              }
              if (entry.read > 0) {
                totalTime += entry.read;
                if (!skipList.includes(tech) && entry.read < bestRead) {
                  bestRead = entry.read;
                  bestReadTech = tech;
                }
              }
              if (entry.update > 0) {
                totalTime += entry.update;
                if (!skipList.includes(tech) && entry.update < bestUpdate) {
                  bestUpdate = entry.update;
                  bestUpdateTech = tech;
                }
              }
              if (entry.delete > 0) {
                totalTime += entry.delete;
                if (!skipList.includes(tech) && entry.delete < bestDelete) {
                  bestDelete = entry.delete;
                  bestDeleteTech = tech;
                }
              }
            });
          });
        });
      });
    } else {
      if (data.compression) {
        Object.keys(data.compression).forEach((size) => {
          payloadTypes.forEach((pt) => {
            const sizeData = data.compression?.[size]?.[pt];
            if (!sizeData) return;
            Object.keys(sizeData).forEach((tech) => {
              if (tech === "MessagePack") return;
              const entry = sizeData[tech];
              if (!entry) return;

              if (entry.compressTime > 0) {
                totalTime += entry.compressTime;
                // Convert to MB/s for "Speed"
                const sizeNum = SIZES[size] || 1024;
                const speed =
                  sizeNum / 1024 / 1024 / (entry.compressTime / 1000);
                if (speed > bestCompress) {
                  bestCompress = speed;
                  bestCompressTech = tech;
                }
              }
              if (entry.decompressTime > 0) {
                totalTime += entry.decompressTime;
                const sizeNum = SIZES[size] || 1024;
                const speed =
                  sizeNum / 1024 / 1024 / (entry.decompressTime / 1000);
                if (speed > bestDecompress) {
                  bestDecompress = speed;
                  bestDecompressTech = tech;
                }
              }
              if (entry.valid && entry.ratio < bestRatio) {
                bestRatio = entry.ratio;
                bestRatioTech = tech;
              }
            });
          });
        });
      }
    }

    return {
      type,
      bestWrite: bestWriteTech !== "--" ? `${bestWrite.toFixed(2)}ms` : "--",
      bestWriteTech,
      bestRead: bestReadTech !== "--" ? `${bestRead.toFixed(2)}ms` : "--",
      bestReadTech,
      bestUpdate: bestUpdateTech !== "--" ? `${bestUpdate.toFixed(2)}ms` : "--",
      bestUpdateTech,
      bestDelete: bestDeleteTech !== "--" ? `${bestDelete.toFixed(2)}ms` : "--",
      bestDeleteTech,
      bestCompress:
        bestCompressTech !== "--" ? `${bestCompress.toFixed(1)}MB/s` : "--",
      bestCompressTech,
      bestDecompress:
        bestDecompressTech !== "--" ? `${bestDecompress.toFixed(1)}MB/s` : "--",
      bestDecompressTech,
      bestRatio: bestRatioTech !== "--" ? `${bestRatio.toFixed(1)}%` : "--",
      bestRatioTech,
      totalTime: `${(totalTime / 1000).toFixed(2)}s`,
    };
  }
</script>

<div class="summary-dashboard">
  {#if summary.type === "storage"}
    <SummaryCard
      label="Best Write"
      value={summary.bestWrite}
      subtitle={summary.bestWriteTech}
    />
    <SummaryCard
      label="Best Read"
      value={summary.bestRead}
      subtitle={summary.bestReadTech}
    />
    <SummaryCard
      label="Best Update"
      value={summary.bestUpdate}
      subtitle={summary.bestUpdateTech}
    />
  {:else}
    <SummaryCard
      label="Compress Speed"
      value={summary.bestCompress}
      subtitle={summary.bestCompressTech}
    />
    <SummaryCard
      label="Decompress Speed"
      value={summary.bestDecompress}
      subtitle={summary.bestDecompressTech}
    />
    <SummaryCard
      label="Best Ratio"
      value={summary.bestRatio}
      subtitle={summary.bestRatioTech}
    />
  {/if}
  <SummaryCard
    label="Total Time"
    value={summary.totalTime}
    subtitle="Current Session"
  />
</div>
