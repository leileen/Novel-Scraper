<script lang="ts">
  import { appState } from '../stores/appState.svelte';
  import type { ActiveTab } from '../types';
  import {
    LayoutDashboard,
    Library,
    BookOpen,
    CodeXml,
    Settings,
    ShieldCheck,
    SlidersHorizontal,
    HelpCircle,
    Sparkles
  } from '@lucide/svelte';

  const menuItems: { id: ActiveTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'library', label: 'Thư viện', icon: Library },
    { id: 'reader', label: 'Trình đọc', icon: BookOpen },
    { id: 'rules', label: 'Bộ luật cào', icon: CodeXml },
    { id: 'settings', label: 'Cài đặt', icon: Settings }
  ];

  function selectTab(tab: ActiveTab) {
    if (tab === 'reader') {
      const targetNovel = appState.activeReaderNovel || appState.novels[0];
      if (targetNovel) {
        void appState.openReader(targetNovel);
        return;
      }
    }
    appState.activeTab = tab;
  }
</script>

<aside class="sidebar" class:collapsed={appState.isSidebarCollapsed}>
  <!-- macOS style Window Controls -->
  <div class="window-controls">
    <div class="circle red" title="Đóng"></div>
    <div class="circle yellow" title="Thu nhỏ"></div>
    <div class="circle green" title="Phóng to"></div>
  </div>

  <!-- Header Sidebar -->
  <div class="sidebar-header">
    <div class="brand">
      <div class="logo-box">
        <img src="/logo.svg" alt="LMT's Novel Manager Logo" class="brand-logo-img" />
      </div>
      {#if !appState.isSidebarCollapsed}
        <div class="brand-text">
          <span class="brand-title">LMT'S NOVEL</span>
          <span class="brand-sub">COMIC & BOOK MANAGER</span>
        </div>
      {/if}
    </div>
    {#if !appState.isSidebarCollapsed}
      <button
        class="quick-gear-btn"
        title="Xem hướng dẫn sử dụng"
        onclick={() => appState.openOnboarding()}
      >
        <HelpCircle size={16} />
      </button>
    {/if}
  </div>

  <!-- Navigation Menu -->
  <nav class="nav-menu">
    {#each menuItems as item}
      {@const Icon = item.icon}
      <button
        class="nav-item"
        class:active={appState.activeTab === item.id}
        onclick={() => selectTab(item.id)}
        title={item.label}
      >
        <div class="nav-icon-wrapper">
          <Icon size={19} />
        </div>
        {#if !appState.isSidebarCollapsed}
          <span class="nav-label">{item.label}</span>
        {/if}
      </button>
    {/each}

    <div class="nav-divider"></div>

    <button
      class="nav-item whats-new-btn"
      onclick={() => appState.openWhatsNew()}
      title="Xem các tính năng mới trong bản cập nhật v1.3"
    >
      <div class="nav-icon-wrapper cyan-glow">
        <Sparkles size={19} />
      </div>
      {#if !appState.isSidebarCollapsed}
        <span class="nav-label">Có gì mới v1.3</span>
      {/if}
    </button>

    <button
      class="nav-item guide-btn"
      onclick={() => appState.openOnboarding()}
      title="Mở trang giới thiệu & hướng dẫn cơ bản"
    >
      <div class="nav-icon-wrapper">
        <HelpCircle size={19} />
      </div>
      {#if !appState.isSidebarCollapsed}
        <span class="nav-label">Hướng dẫn cơ bản</span>
      {/if}
    </button>
  </nav>

  <!-- Footer Sidebar: Premium Active -->
  <div class="sidebar-footer">
    <div class="premium-badge">
      <div class="user-avatar">
        <ShieldCheck size={18} class="shield-icon" />
        <span class="status-indicator-dot" title="Kết nối bản quyền hợp lệ"></span>
      </div>
      {#if !appState.isSidebarCollapsed}
        <div class="license-info">
          <span class="license-status">Premium Active</span>
          <span class="license-sub">Đầy đủ tính năng</span>
        </div>
      {/if}
    </div>
  </div>
</aside>

<style>
  .sidebar {
    width: 240px;
    height: 100vh;
    background-color: var(--bg-sidebar);
    border-right: var(--border-subtle);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    user-select: none;
    z-index: 10;
  }

  .sidebar.collapsed {
    width: 72px;
  }

  .window-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 20px 12px;
    -webkit-app-region: drag;
  }

  .circle {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    transition: transform 0.15s ease, opacity 0.15s ease;
  }

  .circle:hover {
    transform: scale(1.15);
  }

  .circle.red {
    background-color: #ff5f56;
  }

  .circle.yellow {
    background-color: #ffbd2e;
  }

  .circle.green {
    background-color: #27c93f;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px 20px;
    border-bottom: var(--border-subtle);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo-box {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    filter: drop-shadow(0 0 10px rgba(0, 210, 255, 0.25));
  }

  .brand-logo-img {
    width: 38px;
    height: 38px;
    object-fit: contain;
  }

  .brand-text {
    display: flex;
    flex-direction: column;
  }

  .brand-title {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: var(--text-main);
  }

  .brand-sub {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.2px;
    color: var(--accent-cyan);
  }

  .quick-gear-btn {
    color: var(--text-muted);
    padding: 6px;
    border-radius: var(--radius-sm);
  }

  .quick-gear-btn:hover {
    color: var(--accent-cyan);
    background-color: rgba(255, 255, 255, 0.05);
  }

  .nav-menu {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px 10px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: var(--radius-md);
    color: var(--text-muted);
    position: relative;
    text-align: left;
  }

  .nav-item:hover {
    color: var(--text-main);
    background-color: rgba(255, 255, 255, 0.04);
  }

  .nav-item.active {
    color: var(--accent-cyan);
    background-color: rgba(0, 210, 255, 0.08);
    font-weight: 600;
  }

  .nav-item.active::before {
    content: '';
    position: absolute;
    left: -10px;
    top: 6px;
    bottom: 6px;
    width: 3.5px;
    background-color: var(--accent-cyan);
    border-top-right-radius: 4px;
    border-bottom-right-radius: 4px;
    box-shadow: 0 0 8px var(--accent-cyan);
  }

  .nav-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nav-label {
    font-size: 13.5px;
  }

  .nav-divider {
    height: 1px;
    background-color: rgba(255, 255, 255, 0.06);
    margin: 8px 12px;
  }

  .whats-new-btn {
    color: #facc15;
    background-color: rgba(250, 204, 21, 0.05);
    border: 1px solid rgba(250, 204, 21, 0.2);
    margin-bottom: 2px;
  }

  .whats-new-btn:hover {
    color: #fef08a;
    background-color: rgba(250, 204, 21, 0.12);
    border-color: rgba(250, 204, 21, 0.4);
  }

  .cyan-glow {
    color: #facc15;
  }

  .guide-btn {
    color: #38bdf8;
    background-color: rgba(0, 210, 255, 0.04);
    border: 1px dashed rgba(0, 210, 255, 0.2);
  }

  .guide-btn:hover {
    color: var(--accent-cyan);
    background-color: rgba(0, 210, 255, 0.1);
    border-color: rgba(0, 210, 255, 0.4);
  }

  .sidebar-footer {
    padding: 14px;
    border-top: var(--border-subtle);
  }

  .premium-badge {
    display: flex;
    align-items: center;
    gap: 12px;
    background-color: rgba(0, 210, 255, 0.05);
    border: 1px solid rgba(0, 210, 255, 0.15);
    border-radius: var(--radius-md);
    padding: 8px 12px;
  }

  .user-avatar {
    position: relative;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background-color: rgba(0, 210, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-cyan);
    flex-shrink: 0;
  }

  .status-indicator-dot {
    position: absolute;
    bottom: -1px;
    right: -1px;
    width: 8px;
    height: 8px;
    background-color: var(--status-success);
    border-radius: 50%;
    border: 1.5px solid var(--bg-sidebar);
    box-shadow: 0 0 6px var(--status-success);
  }

  .license-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .license-status {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-main);
  }

  .license-sub {
    font-size: 10px;
    color: var(--text-muted);
  }
</style>
