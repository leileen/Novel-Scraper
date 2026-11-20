<script lang="ts">
  import { t } from '../lib/i18n';
  import { Zap, BookOpen, Sliders, Settings } from '@lucide/svelte';

  let { activeTab = 'scraper', onTabChange } = $props<{
    activeTab: 'scraper' | 'library' | 'rules' | 'settings';
    onTabChange: (tab: 'scraper' | 'library' | 'rules' | 'settings') => void;
  }>();

  const tabs = [
    { id: 'scraper', labelKey: 'tabScraper', icon: Zap },
    { id: 'library', labelKey: 'tabLibrary', icon: BookOpen },
    { id: 'rules', labelKey: 'tabRules', icon: Sliders },
    { id: 'settings', labelKey: 'tabSettings', icon: Settings }
  ] as const;
</script>

<nav class="tabs-nav">
  <div class="tabs-track">
    {#each tabs as tab}
      {@const Icon = tab.icon}
      <button
        class="tab-btn"
        class:active={activeTab === tab.id}
        onclick={() => onTabChange(tab.id)}
      >
        <Icon size={12} class="tab-icon" />
        <span class="tab-label">{t(tab.labelKey)}</span>
      </button>
    {/each}
  </div>
</nav>

<style>
  .tabs-nav {
    padding: 4px 14px 6px 14px;
  }

  .tabs-track {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    padding: 3.5px;
    background: var(--surface-pill-well);
    border: 1px solid var(--border-glass);
    box-shadow:
      inset 0 1.5px 3px rgba(0, 0, 0, 0.22),
      0 1px 0 rgba(255, 255, 255, 0.12);
    border-radius: var(--radius-full);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  .tab-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 6px;
    border-radius: var(--radius-full);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .tab-btn:hover:not(.active) {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.06);
  }

  .tab-btn.active {
    background: var(--gradient-03-vivid);
    color: #FFFFFF;
    font-weight: 700;
    border-color: rgba(255, 255, 255, 0.38);
    box-shadow: var(--liquid-pill-shadow);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .tab-icon {
    flex-shrink: 0;
  }

  .tab-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
