<script lang="ts">
  import { appState } from '../stores/appState.svelte';
  import { CheckCircle2, AlertCircle, Info, X } from '@lucide/svelte';
</script>

<div class="toast-container">
  {#each appState.toasts as toast (toast.id)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="toast-item {toast.type}"
      onclick={() => appState.removeToast(toast.id)}
    >
      {#if toast.type === 'success'}
        <CheckCircle2 size={16} class="toast-icon success" />
      {:else if toast.type === 'error'}
        <AlertCircle size={16} class="toast-icon error" />
      {:else}
        <Info size={16} class="toast-icon info" />
      {/if}

      <span class="toast-message">{toast.message}</span>

      <button class="toast-close-btn" onclick={() => appState.removeToast(toast.id)}>
        <X size={13} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 9999;
    pointer-events: none;
  }

  .toast-item {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border-radius: var(--radius-md);
    background-color: rgba(10, 14, 23, 0.92);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    min-width: 260px;
    max-width: 420px;
    animation: toast-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    cursor: pointer;
  }

  .toast-item.success {
    border-color: rgba(16, 185, 129, 0.4);
  }

  .toast-item.error {
    border-color: rgba(239, 68, 68, 0.5);
  }

  .toast-item.info {
    border-color: rgba(0, 210, 255, 0.4);
  }

  :global(.toast-icon.success) {
    color: var(--status-success);
    flex-shrink: 0;
  }

  :global(.toast-icon.error) {
    color: var(--status-error);
    flex-shrink: 0;
  }

  :global(.toast-icon.info) {
    color: var(--accent-cyan);
    flex-shrink: 0;
  }

  .toast-message {
    font-size: 13px;
    color: var(--text-main);
    flex: 1;
    line-height: 1.4;
  }

  .toast-close-btn {
    color: var(--text-muted);
    padding: 2px;
    border-radius: 4px;
  }

  .toast-close-btn:hover {
    color: var(--text-main);
    background-color: rgba(255, 255, 255, 0.1);
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(16px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
