export default defineBackground(() => {
  console.log('[Novel Scraper] Background service worker initialized.');
  
  // Enable opening side panel when clicking the toolbar icon (Chrome/Edge only)
  if (import.meta.env.BROWSER !== 'firefox') {
    if (typeof chrome !== 'undefined' && chrome.sidePanel?.setPanelBehavior) {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err: unknown) => {
        console.warn('[Novel Scraper] Failed to set sidePanel behavior:', err);
      });
    }
  }
});
