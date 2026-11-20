<script lang="ts">
  import { appState } from '../stores/appState.svelte';
  import type { ScraperRule } from '../types';
  import VisualPickerModal from './VisualPickerModal.svelte';
  import {
    CodeXml,
    Plus,
    Crosshair,
    Globe,
    Check,
    Trash2,
    Save,
    RotateCcw
  } from '@lucide/svelte';

  let selectedRuleId = $state<string | number>(appState.rules[0]?.id ?? '');
  let activeRule = $derived(appState.rules.find(r => String(r.id) === String(selectedRuleId)) || appState.rules[0]);
  let isPickerOpen = $state(false);

  function openVisualPicker() {
    isPickerOpen = true;
  }

  function handleAppliedSelector(selector: string) {
    if (activeRule) {
      activeRule.chapterContentSelector = selector;
      appState.showToast(`Đã tự động cập nhật CSS Selector cho: ${activeRule.name}`, 'success');
    }
  }

  function saveRule() {
    appState.showToast(`Đã lưu cấu hình bộ luật: ${activeRule?.name}`, 'success');
  }

  function addNewRule() {
    const newId = `rule-custom-${Date.now()}`;
    const newRule: ScraperRule = {
      id: newId,
      name: 'Quy tắc mới',
      domain: 'example.com',
      version: '1.0.0',
      titleSelector: 'h1',
      authorSelector: '.author',
      descriptionSelector: '.description',
      coverSelector: '.cover img',
      chapterListSelector: '.chapter-list',
      chapterItemSelector: '.chapter-list a',
      chapterContentSelector: '#content',
      excludeSelectors: ['.ads'],
      isCustom: true
    };
    appState.rules.push(newRule);
    selectedRuleId = newId;
    appState.showToast('Đã tạo bản mẫu quy tắc cào mới', 'success');
  }
</script>

<div class="rules-view">
  <div class="rules-header">
    <div class="title-group">
      <CodeXml size={20} class="cyan-icon" />
      <div>
        <h2 class="page-title">BỘ QUY TẮC CÀO DỮ LIỆU (PARSER RULES)</h2>
        <p class="page-desc">Quản lý và tinh chỉnh bộ chọn CSS Selectors để bóc tách DOM trang web nguồn</p>
      </div>
    </div>

    <div class="header-actions">
      <button class="action-btn picker-btn" onclick={openVisualPicker}>
        <Crosshair size={16} /> Mở Visual Picker
      </button>
      <button class="action-btn add-btn" onclick={addNewRule}>
        <Plus size={16} /> Thêm Rule mới
      </button>
    </div>
  </div>

  <div class="rules-layout">
    <!-- Left list of rules -->
    <div class="rules-sidebar">
      <span class="sidebar-heading">Danh sách Rules ({appState.rules.length})</span>
      <div class="rule-items">
        {#each appState.rules as rule (rule.id)}
          <button
            class="rule-tab"
            class:active={rule.id !== undefined && String(rule.id) === String(selectedRuleId)}
            onclick={() => { if (rule.id !== undefined) selectedRuleId = rule.id; }}
          >
            <div class="rule-tab-header">
              <span class="rule-name">{rule.name}</span>
              <span class="rule-ver">v{rule.version}</span>
            </div>
            <span class="rule-domain">{rule.domain}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Right rule details and editor -->
    {#if activeRule}
      <div class="rule-editor">
        <div class="editor-header">
          <div class="editor-title-row">
            <h3 class="editor-rule-name">{activeRule.name}</h3>
            <span class="domain-tag">
              <Globe size={12} /> {activeRule.domain}
            </span>
          </div>
          <button class="save-btn" onclick={saveRule}>
            <Save size={15} /> Lưu quy tắc
          </button>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label for="name-input">Tên quy tắc</label>
            <input id="name-input" type="text" bind:value={activeRule.name} />
          </div>

          <div class="form-group">
            <label for="domain-input">Tên miền (Domain)</label>
            <input id="domain-input" type="text" bind:value={activeRule.domain} />
          </div>

          <div class="form-group">
            <label for="title-input">CSS Selector: Tiêu đề truyện</label>
            <input id="title-input" type="text" bind:value={activeRule.titleSelector} />
          </div>

          <div class="form-group">
            <label for="author-input">CSS Selector: Tác giả</label>
            <input id="author-input" type="text" bind:value={activeRule.authorSelector} />
          </div>

          <div class="form-group">
            <label for="cover-input">CSS Selector: Ảnh bìa (Cover)</label>
            <input id="cover-input" type="text" bind:value={activeRule.coverSelector} />
          </div>

          <div class="form-group">
            <label for="desc-input">CSS Selector: Tóm tắt truyện</label>
            <input id="desc-input" type="text" bind:value={activeRule.descriptionSelector} />
          </div>

          <div class="form-group">
            <label for="chaplist-input">CSS Selector: Danh sách chương (Container)</label>
            <input id="chaplist-input" type="text" bind:value={activeRule.chapterListSelector} />
          </div>

          <div class="form-group">
            <label for="chapitem-input">CSS Selector: Thẻ từng chương (Link)</label>
            <input id="chapitem-input" type="text" bind:value={activeRule.chapterItemSelector} />
          </div>

          <div class="form-group full-width">
            <label for="chapcontent-input">CSS Selector: Nội dung văn bản chương (Chapter Content)</label>
            <input id="chapcontent-input" type="text" bind:value={activeRule.chapterContentSelector} />
          </div>

          <div class="form-group full-width">
            <label for="exclude-input">Phần tử loại bỏ (Quảng cáo, Honeypot - cách nhau bằng dấu phẩy)</label>
            <input
              id="exclude-input"
              type="text"
              value={activeRule.excludeSelectors?.join(', ') || ''}
              onchange={(e) => {
                activeRule.excludeSelectors = (e.currentTarget as HTMLInputElement).value
                  .split(',')
                  .map(s => s.trim())
                  .filter(Boolean);
              }}
            />
          </div>
        </div>
      </div>
    {/if}
  </div>

  <VisualPickerModal
    isOpen={isPickerOpen}
    onClose={() => (isPickerOpen = false)}
    onApplySelector={handleAppliedSelector}
  />
</div>

<style>
  .rules-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .rules-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 28px 16px;
    border-bottom: var(--border-subtle);
    background-color: var(--bg-main);
  }

  .title-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .page-title {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: var(--text-main);
  }

  .page-desc {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    font-size: 12.5px;
    font-weight: 600;
    border-radius: var(--radius-md);
  }

  .picker-btn {
    background-color: rgba(0, 210, 255, 0.1);
    color: var(--accent-cyan);
    border: 1px solid rgba(0, 210, 255, 0.25);
  }

  .picker-btn:hover {
    background-color: rgba(0, 210, 255, 0.2);
  }

  .add-btn {
    background-color: rgba(255, 255, 255, 0.08);
    color: var(--text-main);
  }

  .add-btn:hover {
    background-color: rgba(255, 255, 255, 0.14);
  }

  .rules-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .rules-sidebar {
    width: 260px;
    background-color: var(--bg-sidebar);
    border-right: var(--border-subtle);
    padding: 16px 14px;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .sidebar-heading {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: var(--text-dim);
    margin-bottom: 12px;
    text-transform: uppercase;
  }

  .rule-items {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .rule-tab {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    background-color: transparent;
    text-align: left;
    border: 1px solid transparent;
  }

  .rule-tab:hover {
    background-color: rgba(255, 255, 255, 0.04);
  }

  .rule-tab.active {
    background-color: rgba(0, 210, 255, 0.08);
    border-color: rgba(0, 210, 255, 0.25);
  }

  .rule-tab-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .rule-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-main);
  }

  .rule-ver {
    font-size: 10.5px;
    color: var(--accent-cyan);
  }

  .rule-domain {
    font-size: 11.5px;
    color: var(--text-muted);
  }

  .rule-editor {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px;
    background-color: var(--bg-main);
  }

  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    padding-bottom: 12px;
    border-bottom: var(--border-subtle);
  }

  .editor-title-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .editor-rule-name {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-main);
  }

  .domain-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-muted);
    background-color: var(--bg-card);
    padding: 3px 10px;
    border-radius: var(--radius-full);
  }

  .save-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    background: linear-gradient(135deg, #00d2ff, #00b4db);
    color: #0b1320;
    font-size: 12.5px;
    font-weight: 700;
    border-radius: var(--radius-md);
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group.full-width {
    grid-column: span 2;
  }

  .form-group label {
    font-size: 12.5px;
    font-weight: 600;
    color: #94a3b8;
  }

  .form-group input {
    height: 40px;
    padding: 0 12px;
    font-size: 13px;
    background-color: var(--bg-card);
  }
</style>
