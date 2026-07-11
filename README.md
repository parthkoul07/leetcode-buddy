# LeetCode Buddy

An adaptive AI pair-programmer for LeetCode — it watches your code and nudges you forward, but never hands you the solution.

## Setup

1. Clone this repo.
2. Get a free Groq API key at [console.groq.com](https://console.groq.com) — no credit card required. Groq runs inference on their own custom LPU (Language Processing Unit) chips rather than GPUs, which is why responses come back fast.
3. Go to `chrome://extensions`, enable Developer mode, **Load unpacked**, select this folder.
4. Click the extension icon → paste your API key → model defaults to `qwen/qwen3-32b`, but any Groq-hosted chat model works — the request layer speaks Groq's OpenAI-compatible chat-completions format, so switching models is just swapping the string.
5. Open a LeetCode problem and start coding.


## How it works

A per-problem timer (default 10 min, configurable) tracks how long you've been on a problem. When it fires — or when you hit "Help me now" — the extension pulls your current code straight out of LeetCode's Monaco editor and sends it to Groq for a hint.

The hint isn't static. Each problem carries its own escalation state:
- **Code changed since the last hint** → treated as active progress, hint resets to a light conceptual nudge.
- **Code unchanged** → you're likely stuck, so the hint escalates: a sharper nudge naming the technique, and eventually (capped at level 3) a short pseudocode outline. Never full code.

## Under the hood

A few design decisions worth knowing about if you're reading the code:

- **Two content scripts, two JS execution worlds.** `injected.js` runs in the page's own MAIN world so it can see `window.monaco` directly; `isolated.js` runs in the standard isolated world so it has `chrome.*` API access. Neither can see what the other sees, so they talk over `CustomEvent`s on `window` instead of sharing state directly.
- **`chrome.alarms`, not `setTimeout`.** MV3 background scripts are event-driven service workers that Chrome kills when idle — a plain JS timer would just vanish. Alarms persist and wake the worker back up.
- **Shadow DOM overlay.** The hint panel renders inside a `attachShadow`'d host so LeetCode's own CSS can't bleed into it (or vice versa).
- **SPA-aware navigation.** LeetCode routes client-side, so switching problems doesn't trigger a real page load or a fresh content-script injection. Handled with a lightweight URL poll rather than patching `history.pushState` — a deliberate simplicity-over-elegance tradeoff.
- **Exponential backoff on 429/503.** Groq's free tier is rate-limited per-minute, not just per-day, and active manual testing bumps into that faster than you'd expect. Failed requests back off and retry instead of failing immediately.

## Architecture

| File | Role |
|---|---|
| `manifest.json` | Manifest V3 config |
| `src/content/injected.js` | MAIN world — reads Monaco's live code model |
| `src/content/isolated.js` | Bridges to the page world, renders the Shadow DOM hint panel |
| `src/background.js` | Owns the timer, calls Groq, tracks per-problem escalation state |
| `src/popup/` | Settings UI — API key, model, timer duration |


## Tech

Manifest V3 · `chrome.alarms` · `chrome.storage` · cross-context messaging across isolated/MAIN JS worlds · Shadow DOM UI encapsulation · Groq LPU inference · exponential backoff

## Known limitations

- Difficulty scraping depends on LeetCode's current CSS classes — may break on a redesign
- Single-provider (Groq) — no fallback or multi-provider abstraction
- No hint history view
- Free-tier rate limits are real; heavy manual "Help me now" testing can outpace them faster than the timer alone would
- SPA navigation detection polls every 1s, so there's a small lag recognizing a newly opened problem

## License

MIT — see [LICENSE](LICENSE)
