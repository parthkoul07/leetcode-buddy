const els = {
  apiKey: document.getElementById('apiKey'),
  model: document.getElementById('model'),
  customModel: document.getElementById('customModel'),
  timerMinutes: document.getElementById('timerMinutes'),
  save: document.getElementById('save'),
  status: document.getElementById('status'),
};

function toggleCustom() {
  els.customModel.style.display = els.model.value === 'custom' ? 'block' : 'none';
}
els.model.addEventListener('change', toggleCustom);

chrome.storage.local.get('settings', ({ settings }) => {
  if (!settings) return;
  els.apiKey.value = settings.apiKey || '';
  els.timerMinutes.value = settings.timerMinutes || 10;

  const known = ['qwen/qwen3-32b'];
  if (known.includes(settings.model)) {
    els.model.value = settings.model;
  } else if (settings.model) {
    els.model.value = 'custom';
    els.customModel.value = settings.model;
  }
  toggleCustom();
});

els.save.addEventListener('click', () => {
  const model = els.model.value === 'custom' ? els.customModel.value.trim() : els.model.value;
  const settings = {
    apiKey: els.apiKey.value.trim(),
    model: model || 'qwen/qwen3-32b',
    timerMinutes: Math.max(1, parseInt(els.timerMinutes.value, 10) || 10),
  };
  chrome.storage.local.set({ settings }, () => {
    els.status.textContent = 'Saved.';
    setTimeout(() => (els.status.textContent = ''), 1500);
  });
});



//for the eye symbol to hide/unhide api key:
const apiKey = document.getElementById("apiKey");
const toggle = document.getElementById("togglePassword");

toggle.addEventListener("click", () => {
  if (apiKey.type === "password") {
    apiKey.type = "text";
    toggle.classList.replace("fa-eye", "fa-eye-slash");
  } else {
    apiKey.type = "password";
    toggle.classList.replace("fa-eye-slash", "fa-eye");
  }
});