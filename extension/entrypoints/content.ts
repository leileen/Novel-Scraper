import { startVisualPicker, stopVisualPicker } from '../lib/picker/overlay';
import { extractChapterWithRule, extractTocFromDocument } from '../lib/extractor';
import { findNovelTitle, findChapterTitle, findNovelUrl, findNovelCover, findNovelAuthor } from '../lib/extractor/heuristic';
import type { SiteRule } from '../lib/types';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    // Listen for messages from Side Panel
    chrome.runtime.onMessage.addListener((message: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
      if (message.action === 'START_PICKER') {
        const { targetType } = message;
        startVisualPicker(
          targetType,
          (result) => {
            chrome.runtime.sendMessage({
              action: 'PICKER_RESULT',
              ...result
            });
          },
          () => {
            chrome.runtime.sendMessage({
              action: 'PICKER_CANCELLED'
            });
          }
        );
        sendResponse({ status: 'picker_started' });
        return true;
      }

      if (message.action === 'CANCEL_PICKER') {
        stopVisualPicker();
        sendResponse({ status: 'picker_stopped' });
        return true;
      }

      if (message.action === 'GET_PAGE_INFO') {
        try {
          const novelTitle = findNovelTitle(document, document.title);
          const novelUrl = findNovelUrl(document, window.location.href);
          const chapterTitle = findChapterTitle(document);
          const coverUrl = findNovelCover(document, window.location.href);
          const author = findNovelAuthor(document);
          sendResponse({
            success: true,
            novelTitle,
            novelUrl,
            chapterTitle,
            coverUrl,
            author,
            url: window.location.href
          });
        } catch (err) {
          sendResponse({ success: false, error: (err as Error).message });
        }
        return true;
      }

      if (message.action === 'EXTRACT_CURRENT_PAGE') {
        const { rule, adKeywords } = message as { rule?: SiteRule; adKeywords?: string[] };
        try {
          const result = extractChapterWithRule(document, window.location.href, rule, adKeywords, { deobfuscate: true });
          sendResponse({ success: true, data: result, url: window.location.href });
        } catch (err) {
          sendResponse({ success: false, error: (err as Error).message });
        }
        return true;
      }

      if (message.action === 'SCAN_TOC') {
        const { rule } = message as { rule?: SiteRule };
        try {
          // If on a chapter reading page, ONLY return TOC if there is a real <select> dropdown TOC with options
          const isReadingPage = /(?:chuong|chapter|c)[-_]\d+/i.test(window.location.pathname);
          const hasSelect = document.querySelector('select option:nth-child(2)') !== null;
          if (isReadingPage && !hasSelect) {
            sendResponse({ success: false, error: 'Reading page does not contain select TOC' });
            return true;
          }
          const result = extractTocFromDocument(document, rule, window.location.href);
          sendResponse({ success: true, data: result, url: window.location.href });
        } catch (err) {
          sendResponse({ success: false, error: (err as Error).message });
        }
        return true;
      }

      if (message.action === 'FETCH_URL') {
        const { url } = message as { url: string };
        if (!url || typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://'))) {
          sendResponse({ success: false, error: 'Only http and https URLs are allowed' });
          return true;
        }
        (async () => {
          try {
            const res = await window.fetch(url, {
              headers: {
                Accept: 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8'
              }
            });
            const text = await res.text();
            sendResponse({ success: true, text, status: res.status });
          } catch (err) {
            sendResponse({ success: false, error: (err as Error).message });
          }
        })();
        return true;
      }

      return false;
    });
  }
});
