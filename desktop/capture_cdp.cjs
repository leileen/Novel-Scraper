const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ARTIFACTS_DIR = 'C:\\Users\\lmt pc\\.gemini\\antigravity\\brain\\482892ca-ad1e-4fca-936f-13bedaa181d1';
const EXE_PATH = 'D:\\Project\\Novel Scraper\\LMT Novel Manager v1.3.exe';

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('Starting app with debugging port 9222...');
  const appProc = spawn(EXE_PATH, [], {
    env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9222' },
    detached: true,
    stdio: 'ignore'
  });

  await delay(4000);

  let targets;
  for (let i = 0; i < 10; i++) {
    try {
      targets = await getTargets();
      if (targets && targets.length > 0) break;
    } catch (_) {
      await delay(1000);
    }
  }

  const pageTarget = targets?.find(t => t.type === 'page');
  if (!pageTarget) {
    console.error('Failed to find page target');
    process.kill(appProc.pid);
    process.exit(1);
  }

  console.log('Connecting to WebSocket:', pageTarget.webSocketDebuggerUrl);
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let idCounter = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  const send = (method, params = {}) => {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  await new Promise(resolve => ws.onopen = resolve);
  console.log('WebSocket connected!');

  await send('Page.enable');
  await send('Runtime.enable');

  // Dismiss modals and click "Trình đọc" on the sidebar
  const navToReader = `
    (async function() {
      // Dismiss onboarding
      const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Bắt đầu'));
      if (startBtn) startBtn.click();
      
      const closeBtns = document.querySelectorAll('.welcome-close-btn, .whatsnew-close-btn');
      closeBtns.forEach(b => b.click());

      // If __appState is attached:
      if (window.__appState) {
        window.__appState.completeOnboarding();
        window.__appState.closeWhatsNew();
        window.__appState.readerSettings.columnsCount = 'auto';
        window.__appState.readerSettings.readingMode = 'auto_responsive';
        window.__appState.readerSettings.theme = 'pure_white';
        window.__appState.readerSettings.pinToolbar = false;
        window.__appState.activeTab = 'reader';
      } else {
        // Find sidebar Trình đọc button
        const navItems = Array.from(document.querySelectorAll('.nav-item'));
        const readerBtn = navItems.find(el => el.textContent && el.textContent.includes('Trình đọc'));
        if (readerBtn) readerBtn.click();
        
        // Also trigger F2
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', code: 'F2', bubbles: true }));
      }

      await new Promise(r => setTimeout(r, 600));
      return {
        hasReaderStage: !!document.querySelector('.calibre-reader-stage'),
        activeTab: window.__appState ? window.__appState.activeTab : 'unknown'
      };
    })()
  `;

  let navResult = await send('Runtime.evaluate', { expression: navToReader, awaitPromise: true, returnByValue: true });
  console.log('Nav result:', navResult.result.value);

  await delay(1000);

  // If still not in reader, dispatch F2 directly
  await send('Runtime.evaluate', {
    expression: `
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', code: 'F2', bubbles: true }));
      if (window.__appState) {
        window.__appState.activeTab = 'reader';
      }
    `
  });
  await delay(1000);

  // ==========================================
  // 1. CAPTURE 3 COLUMNS (1500 x 920)
  // ==========================================
  console.log('Capturing 3-column layout (1500x920)...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1500,
    height: 920,
    deviceScaleFactor: 1,
    mobile: false
  });
  await send('Runtime.evaluate', {
    expression: `
      if (window.__appState) {
        window.__appState.readerSettings.columnsCount = 3;
        window.__appState.readerSettings.readingMode = 'three_column';
      }
      window.dispatchEvent(new Event('resize'));
    `
  });
  await delay(800);

  let snap3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'v1_3_calibre_clone_3col.png'), Buffer.from(snap3.data, 'base64'));
  console.log('Saved v1_3_calibre_clone_3col.png');

  // ==========================================
  // 2. CAPTURE 2 COLUMNS (1100 x 820)
  // ==========================================
  console.log('Capturing 2-column layout (1100x820)...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1100,
    height: 820,
    deviceScaleFactor: 1,
    mobile: false
  });
  await send('Runtime.evaluate', {
    expression: `
      if (window.__appState) {
        window.__appState.readerSettings.columnsCount = 2;
        window.__appState.readerSettings.readingMode = 'two_column';
      }
      window.dispatchEvent(new Event('resize'));
    `
  });
  await delay(800);

  let snap2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'v1_3_calibre_clone_2col.png'), Buffer.from(snap2.data, 'base64'));
  console.log('Saved v1_3_calibre_clone_2col.png');

  // ==========================================
  // 3. CAPTURE 1 COLUMN (720 x 860)
  // ==========================================
  console.log('Capturing 1-column layout (720x860)...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 720,
    height: 860,
    deviceScaleFactor: 1,
    mobile: false
  });
  await send('Runtime.evaluate', {
    expression: `
      if (window.__appState) {
        window.__appState.readerSettings.columnsCount = 1;
        window.__appState.readerSettings.readingMode = 'single';
      }
      window.dispatchEvent(new Event('resize'));
    `
  });
  await delay(800);

  let snap1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'v1_3_calibre_clone_1col.png'), Buffer.from(snap1.data, 'base64'));
  console.log('Saved v1_3_calibre_clone_1col.png');

  // ==========================================
  // 4. CAPTURE PREFERENCES MODAL ("Cài đặt")
  // ==========================================
  console.log('Opening Preferences modal...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1200,
    height: 840,
    deviceScaleFactor: 1,
    mobile: false
  });
  await send('Runtime.evaluate', {
    expression: `
      // Show floating bar & trigger Cài đặt button
      const floatingBar = document.querySelector('.reader-top-toolbar');
      if (floatingBar) floatingBar.classList.remove('hidden-toolbar');
      
      const btns = Array.from(document.querySelectorAll('button'));
      const settingsBtn = btns.find(b => b.textContent && b.textContent.includes('Cài đặt'));
      if (settingsBtn) {
        settingsBtn.click();
      }
    `
  });
  await delay(800);

  let snapPref = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'v1_3_calibre_clone_preferences.png'), Buffer.from(snapPref.data, 'base64'));
  console.log('Saved v1_3_calibre_clone_preferences.png');

  ws.close();
  try {
    process.kill(appProc.pid);
  } catch (_) {}
  console.log('All captures updated!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
