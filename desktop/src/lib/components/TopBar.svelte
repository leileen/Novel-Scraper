<script lang="ts">
  import { appState } from '../stores/appState.svelte';
  import { Link, Download, Sparkles } from '@lucide/svelte';

  let inputUrl = $state('');

  function handleSubmit(e?: Event) {
    if (e) e.preventDefault();
    if (!inputUrl.trim()) {
      appState.showToast('Vui lòng nhập hoặc dán link truyện cần cào', 'error');
      return;
    }
    appState.addDownload(inputUrl);
    inputUrl = '';
  }
</script>

<div class="top-input-container">
  <form class="input-form" onsubmit={handleSubmit}>
    <div class="input-wrapper">
      <Link size={18} class="input-icon" />
      <input
        type="text"
        class="url-input"
        placeholder="Dán URL bộ truyện cần tải... (ví dụ: metruyenchu, truyenfull, tangthuvien)"
        bind:value={inputUrl}
      />
      {#if inputUrl.trim()}
        <span class="url-hint">
          <Sparkles size={13} /> Sẵn sàng bóc tách
        </span>
      {/if}
    </div>
    <button type="submit" class="start-btn">
      <Download size={17} />
      <span>BẮT ĐẦU TẢI</span>
    </button>
  </form>
</div>

<style>
  .top-input-container {
    padding: 20px 28px 12px;
    background-color: var(--bg-main);
  }

  .input-form {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .input-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    background-color: var(--bg-card);
    border: var(--border-card);
    border-radius: var(--radius-lg);
    padding: 0 16px;
    transition: all 0.2s ease;
  }

  .input-wrapper:focus-within {
    border-color: var(--accent-cyan);
    box-shadow: 0 0 16px rgba(0, 210, 255, 0.15);
    background-color: #1e2535;
  }

  :global(.input-icon) {
    color: var(--text-muted);
    margin-right: 12px;
    flex-shrink: 0;
  }

  .url-input {
    flex: 1;
    height: 48px;
    background: transparent;
    border: none;
    outline: none;
    font-size: 14px;
    color: var(--text-main);
  }

  .url-input::placeholder {
    color: var(--text-muted);
    font-size: 13.5px;
  }

  .url-hint {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--accent-cyan);
    background-color: rgba(0, 210, 255, 0.1);
    padding: 3px 10px;
    border-radius: var(--radius-full);
  }

  .start-btn {
    height: 48px;
    padding: 0 24px;
    background: linear-gradient(135deg, #00d2ff, #00b4db);
    color: #0b1320;
    font-size: 13.5px;
    font-weight: 700;
    letter-spacing: 0.5px;
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    box-shadow: 0 4px 14px rgba(0, 210, 255, 0.3);
    transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
  }

  .start-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(0, 210, 255, 0.45);
    filter: brightness(1.05);
  }

  .start-btn:active {
    transform: translateY(0);
  }
</style>
