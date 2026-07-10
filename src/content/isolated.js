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
    :host { all: initial; }
    /* Update the .panel class to use a monospace font */
    .panel {
      position: fixed; bottom: 20px; right: 20px; z-index: 999999;
      font-family: 'Consolas', 'Fira Code', 'Courier New', monospace; /* Hacker font */
      font-size: 13px;
      width: 280px; background: #1e1e1e; color: #eee;
      border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      overflow: hidden;
    }
    code {
      background: #333333;
      color: #9cdcfe; /* Classic VS Code light blue */
      padding: 2px 4px;
      border-radius: 4px;
      font-family: inherit;
    }
    .header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 12px; background: #2b2b2b; cursor: pointer;
    }
    .header span { font-weight: 600; }
    .body { padding: 12px; max-height: 260px; overflow-y: auto; display: none; }
    .body.open { display: block; }
    .hint-text { line-height: 1.4; white-space: pre-wrap; }
    .level-tag {
      display: inline-block; font-size: 11px; padding: 2px 6px;
      border-radius: 6px; margin-bottom: 6px; background: #3a3a3a;
    }
    button.trigger {
      width: 100%; margin-top: 10px; padding: 7px; border: none;
      border-radius: 6px; background: #4c8bf5; color: white;
      cursor: pointer; font-size: 13px;
    }
    button.trigger:disabled { background: #555; cursor: default; }
    .error { color: #ff8080; }
    .empty { color: #999; }
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