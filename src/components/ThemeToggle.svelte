<script lang="ts">
    import { onMount } from "svelte";
    import Sun from "@lucide/svelte/icons/sun";
    import Moon from "@lucide/svelte/icons/moon";

    let theme = $state<"light" | "dark">("dark");

    onMount(() => {
        // astro 초기화 스크립트에 의해 이미 설정된 속성에서 현재 테마를 가져옵니다.
        const current =
            (document.documentElement.getAttribute("data-theme") as
                | "light"
                | "dark") || "dark";
        theme = current;
    });

    function toggleTheme() {
        theme = theme === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    }
</script>

<button
    class="btn-theme-toggle"
    onclick={toggleTheme}
    title="Toggle Theme"
    aria-label="Toggle Theme"
>
    {#if theme === "dark"}
        <Moon size={18} strokeWidth={2} />
    {:else}
        <Sun size={18} strokeWidth={2} />
    {/if}
</button>

<style>
    .btn-theme-toggle {
        background: var(--bg-card) !important;
        border: 1px solid var(--border-color) !important;
        border-radius: 12px;
        width: 44px;
        height: 44px;
        min-width: 44px;
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-main);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
        padding: 0;
        margin: 0;
    }
    .btn-theme-toggle:hover {
        background: var(--bg-hover) !important;
    }
</style>
