<script lang="ts">
  interface Props {
    label: string;
    value: string | number;
    subtitle: string;
  }
  const { label, value, subtitle }: Props = $props();
</script>

<div class="summary-card">
  <span class="card-label">{label}</span>
  <span class="card-value">{value}</span>
  <span class="card-subtitle">{subtitle}</span>
</div>
