//has chrome.* access, bridges to the page world via events
//this file asks for the code+language via a custom event and logs what comes back — this is a 
//stand-in for the real trigger, just to prove the bridge works before background.js exists to consume it.

function requestSnapshot() {
  return new Promise((resolve) => {
    function handler(e) {
      window.removeEventListener('lcbuddy:snapshot-result', handler);
      resolve(e.detail);
    }
    window.addEventListener('lcbuddy:snapshot-result', handler);
    window.dispatchEvent(new Event('lcbuddy:get-snapshot'));
  });
}


//to handle the SPA issue: moving to a new problem doesnot reload the page:
function getSlugFromUrl() {
  const match = window.location.pathname.match(/\/problems\/([^/]+)/);
  return match ? match[1] : null;
}

let currentSlug = getSlugFromUrl();


// ---------- overlay UI (shadow DOM so LeetCode's CSS can't clash with ours) ----------
const host = document.createElement('div');
host.id = 'lcbuddy-host';
document.body.appendChild(host);
const shadow = host.attachShadow({ mode: 'open' });

shadow.innerHTML = `
  <style>
    :host {
      all: initial;
      --panel-bg: #262626;
      --header-bg: #303030;
      --text: #eff1f6;
      --muted: #a3a3a3;
      --border: #4a4a4a;
      --code-bg: #3a3a3a;
      --code-text: #8dd8ff;
      --tag-bg: #424242;
      --button-bg: #ffa116;
      --button-text: #1f1f1f;
      --disabled: #555;
      --error: #ff8d8d;
      --shadow: 0 8px 24px rgba(0, 0, 0, .35);
    }
    :host([data-theme="light"]) {
      --panel-bg: #ffffff;
      --header-bg: #f7f7f7;
      --text: #262626;
      --muted: #6b7280;
      --border: #e5e7eb;
      --code-bg: #f3f4f6;
      --code-text: #2563eb;
      --tag-bg: #f3f4f6;
      --button-bg: #ffa116;
      --button-text: #1f1f1f;
      --disabled: #d1d5db;
      --error: #dc2626;
      --shadow: 0 8px 24px rgba(0, 0, 0, .14);
    }
    .panel {
      position: fixed; bottom: 20px; right: 20px; z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      width: 280px; background: var(--panel-bg); color: var(--text);
      border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow);
      overflow: hidden;
    }
    code {
      background: var(--code-bg); color: var(--code-text);
      padding: 2px 4px;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 12px; background: var(--header-bg); cursor: pointer;
      border-bottom: 1px solid var(--border);
    }
    .header span { font-weight: 600; }
    .body { padding: 12px; max-height: 260px; overflow-y: auto; display: none; }
    .body.open { display: block; }
    .hint-text { line-height: 1.4; white-space: pre-wrap; }
    .level-tag {
      display: inline-block; font-size: 11px; padding: 2px 6px;
      border-radius: 6px; margin-bottom: 6px; background: var(--tag-bg);
    }
    button.trigger {
      width: 100%; margin-top: 10px; padding: 7px; border: none;
      border-radius: 6px; background: var(--button-bg); color: var(--button-text);
      cursor: pointer; font-size: 13px;
    }
    button.trigger:disabled { background: var(--disabled); cursor: default; }
    .error { color: var(--error); }
    .empty { color: var(--muted); }
  </style>
  <div class="panel">
    <div class="header" id="lcbuddy-toggle">
      <span>LeetCode Buddy</span>
      <span id="lcbuddy-caret">▲</span>
    </div>
    <div class="body open" id="lcbuddy-body">
      <div class="empty" id="lcbuddy-content">No hint yet — one will appear when the timer fires, or click below.</div>
      <button class="trigger" id="lcbuddy-btn">Help me now</button>
    </div>
  </div>
`;

const els = {
  toggle: shadow.getElementById('lcbuddy-toggle'),
  caret: shadow.getElementById('lcbuddy-caret'),
  body: shadow.getElementById('lcbuddy-body'),
  content: shadow.getElementById('lcbuddy-content'),
  btn: shadow.getElementById('lcbuddy-btn'),
};

function isDarkColor(color) {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match || (match[4] !== undefined && Number(match[4]) === 0)) return null;

  const [, red, green, blue] = match.map(Number);
  // Relative luminance: values below the midpoint read as a dark surface.
  return (red * 0.2126 + green * 0.7152 + blue * 0.0722) < 140;
}

function syncTheme() {
  const colors = [
    getComputedStyle(document.body).backgroundColor,
    getComputedStyle(document.documentElement).backgroundColor,
  ];
  const dark = colors.map(isDarkColor).find((value) => value !== null)
    ?? window.matchMedia('(prefers-color-scheme: dark)').matches;
  host.dataset.theme = dark ? 'dark' : 'light';
}

syncTheme();
const themeObserver = new MutationObserver(syncTheme);
const themeAttributes = {
  attributes: true,
  attributeFilter: ['class', 'style', 'data-theme'],
};
themeObserver.observe(document.documentElement, themeAttributes);
themeObserver.observe(document.body, themeAttributes);

els.toggle.addEventListener('click', () => {
  els.body.classList.toggle('open');
  els.caret.textContent = els.body.classList.contains('open') ? '▲' : '▼';
});

els.btn.addEventListener('click', () => {
  if (!currentSlug) return;
  els.btn.disabled = true;
  els.btn.textContent = 'Thinking...';
  chrome.runtime.sendMessage({ type: 'REQUEST_HINT', slug: currentSlug });
});


function formatHintText(text) {
  // 1. Escape HTML characters to prevent XSS attacks
  const escaped = text.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag])
  );

  // 2. Replace markdown backticks `like this` with HTML <code>like this</code>
  return escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
}

function renderHint(hint, level) {
  els.content.className = '';
  els.content.innerHTML = `<div class="level-tag">Level ${level}</div><div class="hint-text"></div>`;
  // els.content.querySelector('.hint-text').textContent = hint; // textContent — never inject model output as HTML
  // Use our new formatter and innerHTML instead of textContent
  els.content.querySelector('.hint-text').innerHTML = formatHintText(hint);
  els.btn.disabled = false;
  els.btn.textContent = 'Help me now';
}

function renderError(message) {
  els.content.className = 'error';
  els.content.textContent = message;
  els.btn.disabled = false;
  els.btn.textContent = 'Help me now';
}
// ---------- end overlay UI ----------



if (currentSlug) {
  chrome.runtime.sendMessage({ type: 'PROBLEM_CHANGED', slug: currentSlug });
}
//SPA navigation doesn't reload the page, so this is the reliable way
//to notice the user moved to a different problem.
setInterval(() => {
  const slug = getSlugFromUrl();
  if (slug && slug !== currentSlug) {
    currentSlug = slug;
    chrome.runtime.sendMessage({ type: 'PROBLEM_CHANGED', slug });
  }
}, 1000);

//from background.js 
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REQUEST_SNAPSHOT') {
    requestSnapshot().then(sendResponse);
    return true; // keeps the message channel open for the async response
  }
  if (message.type === 'HINT_READY') {
    console.log('[LCBuddy] hint (level', message.level + '):', message.hint);
    renderHint(message.hint, message.level);
  }
  if (message.type === 'HINT_ERROR') {
    //FIX: Catch errors, display them, and reset the button
    console.error('[LCBuddy] hint error:', message.message);
    renderError(message.message);
  }
});


// // temporary self-test — will be replaced by real message handling once background.js exists
// setTimeout(async () => {
//   const snapshot = await requestSnapshot();
//   console.log('[LCBuddy] snapshot:', snapshot);
// }, 1500);
