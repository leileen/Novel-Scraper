# Reviewer Notes & Verification Instructions: Novel Scraper

> **Target Stores**: Chrome Web Store, Microsoft Edge Add-ons, Mozilla Firefox AMO  
> **Extension Version**: 1.0.0  
> **Source Bundle**: `novel-scraper-1.0.0-sources.zip`  
> **Build Framework**: WXT + TypeScript + Svelte 5

---

## 1. Summary of Extension Functionality
**Novel Scraper** is an open-source productivity side panel extension designed to help readers save web novels for offline reading. It provides:
1. **Universal Heuristic Extraction**: Automatically identifies the main reading content and chapter title based on paragraph density and DOM structure.
2. **Visual Element Picker**: Allows users to click on custom website containers to generate precise CSS selectors.
3. **Pure Text Sanitization**: Normalizes Vietnamese Unicode (NFC), strips zero-width hidden characters, and removes web banner ads/watermarks.
4. **Offline Export**: Merges downloaded chapters into UTF-8 BOM plain text (`.txt`), standard Microsoft Word (`.docx`), and print-ready PDF (`.pdf`).

All operations are performed strictly **client-side** in the user's browser; no external server communication or remote code execution is used.

---

## 2. Permission Justifications
* `sidePanel` (Chrome/Edge): Opens the reader interface in the browser side panel.
* `sidebar_action` (Firefox): Opens the reader interface in Firefox's native sidebar.
* `storage`: Stores user preferences (theme, language, polite delay, custom ad keywords) and domain selectors.
* `activeTab` & `scripting`: Required to inject the visual element picker and read DOM content only when the user explicitly triggers scraping on an active novel page.
* `downloads`: Allows the user to save the generated `.txt`, `.docx`, or `.pdf` file to their local machine.
* `host_permissions: ["<all_urls>"]`: Enables users to scrape chapters from any web novel platform they visit.

---

## 3. How to Reproduce & Build from Source (`sources.zip`)

Reviewers can verify and build the identical binaries from the provided `sources.zip`:

### Prerequisites
* Node.js v20+ (Tested on Node.js v22 and v26)
* npm v10+

### Step-by-step Build Commands
```bash
# 1. Unzip sources.zip and navigate into directory
cd novel-scraper

# 2. Install dependencies (deterministic lockfile)
npm ci

# 3. Run automated tests (Vitest)
npm test

# 4. Build for Chrome
npm run build:chrome
# Output in .output/chrome-mv3/

# 5. Build for Firefox MV3
npm run build:firefox
# Output in .output/firefox-mv3/

# 6. Build for Edge
npm run build:edge
# Output in .output/edge-mv3/
```

---

## 4. How to Test the Extension in Browser

1. Open `chrome://extensions` (or `edge://extensions` / `about:debugging` in Firefox).
2. Enable **Developer mode**.
3. Click **Load unpacked** (or **Load Temporary Add-on**) and select `.output/chrome-mv3` (or `.output/firefox-mv3`).
4. Click the **Novel Scraper** toolbar icon to open the Side Panel.
5. Visit any novel chapter page (e.g. `https://comong.info` or any web novel site).
6. In the Side Panel:
   - Click **"Tự nhận diện" / "Auto Detect"**: Confirms the chapter title and text content are extracted.
   - Click **"Chọn vùng bằng chuột" / "Pick with Mouse"**: Hover over text elements on the page (neon highlight box appears) and click to select a container. Press `ESC` to cancel.
   - Select export format: `TXT`, `DOCX`, or `PDF`.
   - Click **"Gộp & Tải về" / "Merge & Download"**: The formatted book file is saved to your downloads folder.
