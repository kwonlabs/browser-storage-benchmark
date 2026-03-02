<script lang="ts">
    interface Props {
        percent: number;
        message: string;
        visible: boolean;
    }
    const { percent, message, visible }: Props = $props();
</script>

{#if visible}
    <div id="overall-progress" class="overall-progress">
        <div class="progress-info">
            <span id="progress-text">{message}</span>
            <span id="progress-percent">{percent}%</span>
        </div>
        <div class="progress-bar-bg">
            <div
                id="progress-bar-fill"
                class="progress-bar-fill"
                style="width: {percent}%"
            ></div>
        </div>
    </div>
{/if}
