(function () {
  // 1. Create a helper function that waits for the code to exist
  function waitForMonacoModel(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      // Interval set to set interval
      const interval = setInterval(() => {
        // If 10 seconds pass, give up so we don't loop forever
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(interval);
          return reject(new Error('Timeout: Monaco editor or code took too long to load.'));
        }

        // Check if monaco exists yet
        if (!window.monaco?.editor?.getModels) return;

        const models = window.monaco.editor.getModels();
        const mainModel = models
          .filter(m => m.getLanguageId() !== 'plaintext')
          .sort((a, b) => b.getValueLength() - a.getValueLength())[0];

        // Wait until we have a model AND it actually has characters in it
        if (mainModel && mainModel.getValueLength()>0) {    //getvaluelength>0 is important since even if the user hasnot written any code, there is prewritten boilerplate that must show up...so getvaluelength > 0 everytime we have a fully loaded code window.
          clearInterval(interval); // Stop polling!
          resolve(mainModel);      // Hand the model back
        }
      }, 500); // Check every 500 milliseconds
    });
  } 

  // 2. Make getSnapshot async so it can wait for the Promise
  async function getSnapshot() {
    try {
      // Wait right here until waitForMonacoModel resolves
      const mainModel = await waitForMonacoModel();
      
      const code = mainModel.getValue();
      const language = mainModel.getLanguageId();
      const [title] = document.title.split(' - ');

      const difficultyEl = document.querySelector('.text-difficulty-easy, .text-difficulty-medium, .text-difficulty-hard');
      let difficulty = 'Unknown';
      
      if (difficultyEl) {
          difficulty = difficultyEl.textContent.trim();
      } else {
          const headerSection = document.querySelector('.flex.items-start.justify-between') || document.body;
          difficulty = Array.from(headerSection.querySelectorAll('div, span'))
            .map(el => el.textContent.trim())
            .find(t => t === 'Easy' || t === 'Medium' || t === 'Hard') || 'Unknown';
      }

      return { code, language, title: (title || 'Unknown').trim(), difficulty };
    } catch (err) {
      return { error: err.message };
    }
  }

  // 3. Make the event listener async
  window.addEventListener('lcbuddy:get-snapshot', async () => {
    const snapshotData = await getSnapshot();
    window.dispatchEvent(new CustomEvent('lcbuddy:snapshot-result', { detail: snapshotData }));
  });
})();
