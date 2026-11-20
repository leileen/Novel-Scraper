<script lang="ts">
  import { appState } from '../stores/appState.svelte';
  import TopBar from './TopBar.svelte';
  import DownloadCard from './DownloadCard.svelte';
  import {
    Pause,
    Trash2,
    Layers,
    Inbox
  } from '@lucide/svelte';

  const queueCount = $derived(appState.downloadQueue.length);
</script>

<div class="dashboard-view">
  <!-- Top URL Input -->
  <TopBar />

  <!-- Queue Section -->
  <div class="queue-container">
    <div class="queue-header">
      <div class="title-with-badge">
        <Layers size={18} class="section-icon" />
        <h2 class="section-title">HÀNG ĐỢI TẢI XUỐNG</h2>
        <span class="count-badge">{queueCount}</span>
      </div>

      {#if queueCount > 0}
        <div class="bulk-actions">
          <button
            class="bulk-btn"
            title="Tạm dừng tất cả tác vụ"
            onclick={() => appState.pauseAll()}
          >
            <Pause size={14} />
            <span>Tạm dừng tất cả</span>
          </button>
          <button
            class="bulk-btn danger"
            title="Làm sạch danh sách hoàn thành"
            onclick={() => appState.clearCompleted()}
          >
            <Trash2 size={14} />
            <span>Làm sạch</span>
          </button>
        </div>
      {/if}
    </div>

    <!-- Active Tasks List -->
    <div class="queue-list">
      {#if queueCount === 0}
        <div class="empty-state">
          <div class="empty-logo-box">
            <img src="/logo.svg" alt="Novel Scraper Logo" class="empty-logo-img" />
          </div>
          <h3 class="empty-title">Sẵn sàng tải bộ truyện đầu tiên của bạn</h3>
          <p class="empty-subtitle">
            Dán đường dẫn (URL) bộ truyện từ <code>metruyenchu.com.vn</code>, <code>truyenfull.vn</code>, <code>tangthuvien.net</code>... vào khung nhập phía trên rồi nhấn <strong>Bắt đầu tải</strong>.
          </p>
          <div class="empty-actions-row">
            <button class="open-guide-btn" onclick={() => appState.openOnboarding()}>
              Xem hướng dẫn sử dụng cơ bản
            </button>
            <button class="open-whats-new-btn" onclick={() => appState.openWhatsNew()}>
              Có gì mới trong v1.2
            </button>
          </div>
        </div>
      {:else}
        {#each appState.downloadQueue as task (task.id)}
          <DownloadCard {task} />
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .dashboard-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .queue-container {
    flex: 1;
    overflow-y: auto;
    padding: 10px 28px 28px;
    display: flex;
    flex-direction: column;
  }

  .queue-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: var(--border-subtle);
  }

  .title-with-badge {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  :global(.section-icon) {
    color: var(--accent-cyan);
  }

  .section-title {
    font-size: 13.5px;
    font-weight: 700;
    letter-spacing: 0.6px;
    color: var(--text-main);
  }

  .count-badge {
    background-color: rgba(0, 210, 255, 0.15);
    color: var(--accent-cyan);
    font-size: 11px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: var(--radius-full);
  }

  .bulk-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .bulk-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    padding: 6px 12px;
    border-radius: var(--radius-md);
    background-color: var(--bg-card);
    border: var(--border-subtle);
    color: var(--text-muted);
  }

  .bulk-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-card-hover);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .bulk-btn.danger:hover {
    color: var(--status-error);
    border-color: rgba(239, 68, 68, 0.3);
  }

  .queue-list {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  /* Empty State */
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 60px 20px;
  }

  .empty-logo-box {
    width: 88px;
    height: 88px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 18px;
    filter: drop-shadow(0 0 20px rgba(0, 210, 255, 0.3));
  }

  .empty-logo-img {
    width: 88px;
    height: 88px;
    object-fit: contain;
  }

  .empty-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--text-main);
    margin-bottom: 8px;
  }

  .empty-subtitle {
    font-size: 13.5px;
    color: var(--text-muted);
    max-width: 480px;
    line-height: 1.6;
    margin-bottom: 18px;
  }

  .empty-subtitle code {
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 1px 6px;
    border-radius: 4px;
    background-color: rgba(0, 210, 255, 0.1);
    color: var(--accent-cyan);
  }

  .empty-actions-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .open-guide-btn {
    padding: 9px 18px;
    border-radius: var(--radius-md);
    background-color: rgba(0, 210, 255, 0.12);
    border: 1px solid rgba(0, 210, 255, 0.3);
    color: var(--accent-cyan);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s ease, transform 0.15s ease;
  }

  .open-guide-btn:hover {
    background-color: rgba(0, 210, 255, 0.22);
    transform: translateY(-1px);
  }

  .open-whats-new-btn {
    padding: 9px 18px;
    border-radius: var(--radius-md);
    background-color: rgba(250, 204, 21, 0.12);
    border: 1px solid rgba(250, 204, 21, 0.3);
    color: #facc15;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s ease, transform 0.15s ease;
  }

  .open-whats-new-btn:hover {
    background-color: rgba(250, 204, 21, 0.22);
    transform: translateY(-1px);
  }

  .open-guide-btn:hover {
    background-color: rgba(0, 210, 255, 0.22);
    transform: translateY(-1px);
  }
</style>
