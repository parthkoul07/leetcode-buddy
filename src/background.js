const ALARM_PREFIX = 'hint:';

function alarmName(tabId, slug) {
  return `${ALARM_PREFIX}${tabId}:${slug}`;
}

async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return settings || { timerMinutes: 10, model: 'qwen/qwen3-32b', apiKey: '' };
}

async function getProblemState(slug) {
  const key = `problemState:${slug}`;
  const result = await chrome.storage.local.get(key);
  return result[key] || { lastCode: '', currentLevel: 0, hintCount: 0 };
}

async function setProblemState(slug, state) {
  await chrome.storage.local.set({ [`problemState:${slug}`]: state });
}

function computeLevel(prevState, newCode) {
  if (prevState.lastCode !== newCode) return 1;
  return Math.min(prevState.currentLevel + 1, 3);
}

function buildPrompt({ title, difficulty, code, language, level }) {
  const levelInstructions = {
    1: 'Give a short conceptual nudge only — point toward the right idea, pattern or data structure to use. No code, no pseudocode.',
    2: 'The user seems stuck (code unchanged since last hint). Give a sharper nudge — name the technique or data structure that fits. Still no code.',
    3: 'The user has been stuck a while. You may give a brief pseudocode outline (a few lines max), but never full working code or the complete solution.',
  };

  return `Problem: ${title} (${difficulty})
  Language: ${language}
  Current code:
  \`\`\`
  ${code}
  \`\`\`

  ${levelInstructions[level]}  
  `;
}

async function callAI({ apiKey, model, prompt }, retries = 3, delay = 2000) {
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const selectedModel = model || 'qwen/qwen3-32b';
  const payload = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      // Groq uses an OpenAI-compatible Chat Completions endpoint. The model
      // comes from the popup setting, so a custom Groq model ID also works.
      model: selectedModel,
      // Qwen3-32B is a reasoning model. "hidden" suppresses its <think>
      // output and returns only message.content (the student-facing hint).
      // Other custom models do not receive this Qwen-specific option.
      reasoning_format: selectedModel.startsWith('qwen/') ? 'hidden' : undefined,
      // Reasoning consumes tokens before Qwen emits the final answer. Keep
      // enough headroom here; the system prompt still limits the visible hint.
      max_completion_tokens: 1024,
      messages: [
        {
          role: 'system',
          content: `Your are LeetCode Buddy, an AI expert coding mentor helping someone solve a LeetCode problem. NEVER give the direct answer or write the final code. Analyze their current code. If they are on the right track, tell them what the next logical step is. If you notice that the current code's time complexity is not optimal, do not interfere by telling what the most optimal solution must be. Rather, notice the pattern of the code already written - if the student is trying to write a brute force, let him/her write it and suggest hints in that direction only.  Always give your hint in under 50 words. The hint should be to the point and in context to the already written code - always hint at how the currently written code can be improved/completed and not what the optimal code is. If the current code is nearly similar to the previous code, give a more detailed hint...but again, never give full code as answer.`
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    }),
  };

  //loop to allow for retries:
  for (let i = 1; i <= retries; i++) {
    const res = await fetch(url, payload);

    if (res.ok) {
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) {
        const finishReason = data.choices?.[0]?.finish_reason || 'unknown';
        throw new Error(`Groq returned no final hint (finish reason: ${finishReason}). Please try again.`);
      }
      return text;
    }

    // if its a 503 or 429, wait and try again
    if (res.status === 503 || res.status === 429) {   //429 is the 20 requests/min quota exceeded error - so we need to wait.
      console.warn(`Server Busy, retrying in ${delay / 1000}s...(attempt ${i} of ${retries})`);
      //pause execution for the 'delay' amount of time:
      await new Promise(resolve => setTimeout(resolve, delay));
      //double the delay for the next try (exponential backoff: 2s -> 4s -> 8s -> 16s):
      delay *= 2;
    }

    else {
      //if its a 400 or 401 (bad request or unauthorized), dont retry:
      const errText = await res.text();
      throw new Error(`Groq API error ${res.status} : ${errText}`);
    }
  }

  //If none of above works:
  throw new Error('API not responding after 3 tries. Try again later.')

}

async function clearTabAlarms(tabId) {
  const alarms = await chrome.alarms.getAll();
  const prefix = `${ALARM_PREFIX}${tabId}:`;
  await Promise.all(alarms.filter((a) => a.name.startsWith(prefix)).map((a) => chrome.alarms.clear(a.name)));
}

async function scheduleAlarm(tabId, slug) {
  await clearTabAlarms(tabId);
  const { timerMinutes } = await getSettings();
  chrome.alarms.create(alarmName(tabId, slug), { delayInMinutes: Math.max(1, timerMinutes) });
}

async function generateHint(tabId, slug) {
  const settings = await getSettings();
  if (!settings.apiKey) {
    chrome.tabs.sendMessage(tabId, { type: 'HINT_ERROR', message: 'No API key set — add one in the extension popup.' });
    return;
  }

  const snapshot = await chrome.tabs.sendMessage(tabId, { type: 'REQUEST_SNAPSHOT' });
  if (snapshot.error) {
    chrome.tabs.sendMessage(tabId, { type: 'HINT_ERROR', message: snapshot.error });
    return;
  }

  const prevState = await getProblemState(slug);
  const level = computeLevel(prevState, snapshot.code);
  const prompt = buildPrompt({ ...snapshot, level });

  const hint = await callAI({ apiKey: settings.apiKey, model: settings.model, prompt });

  await setProblemState(slug, {
    lastCode: snapshot.code,
    currentLevel: level,
    hintCount: (prevState.hintCount || 0) + 1,
  });

  console.log('[LCBuddy][background] hint generated for', slug, '- level', level);
  chrome.tabs.sendMessage(tabId, { type: 'HINT_READY', hint, level });
}


async function handleHintRequest(tabId, slug) {
  try {
    await generateHint(tabId, slug);
  } catch (err) {
    console.log('[LCBuddy][background] hint generation failed for', slug, '-', err.message);
    chrome.tabs.sendMessage(tabId, { type: 'HINT_ERROR', message: err.message }).catch(() => { });
  } finally {
    scheduleAlarm(tabId, slug).catch(() => { });
  }
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'PROBLEM_CHANGED' && sender.tab?.id) {
    scheduleAlarm(sender.tab.id, message.slug);
  }
  if (message.type === 'REQUEST_HINT' && sender.tab?.id) {
    handleHintRequest(sender.tab.id, message.slug);
  }
});

// An extension cannot open its toolbar popup without a user gesture. Open a
// dedicated onboarding tab instead, but only on the very first installation.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/popup/onboarding.html') });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;
  const [, tabIdStr, slug] = alarm.name.split(':');
  handleHintRequest(parseInt(tabIdStr, 10), slug);
});
