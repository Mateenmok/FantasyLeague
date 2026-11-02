(() => {
  // This preview only writes its own browser profile, never a Season 1 account.
  try { if (sessionStorage.getItem('pokeleague.season2Workspace') !== 'SEASON1') return; }
  catch { return; }
  const model = window.PokeLeagueSeasonTwoProfile;
  const colors = window.PokeLeagueTrainerColors;
  const root = document.querySelector('.intro');
  const query = selector => root.querySelector(selector);
  let storage;
  try { storage = window.localStorage; } catch { /* Private browsers can deny access. */ }
  const saved = model.read(storage);
  let trainerId = saved?.trainerId || '';
  let appearance = model.normalizeAppearance(saved?.appearance);
  let activePart = 'hair';
  let renderVersion = 0;
  let previewReady = false;
  let step = 'welcome';
  let typingTimer;
  let savedToBrowser = Boolean(saved);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const nameInput = query('#trainerName');
  const next = query('[data-next]');
  const back = query('[data-back]');
  const confirm = query('[data-confirm]');
  const edit = query('[data-edit]');
  const order = ['welcome', 'trainer', 'customize', 'name', 'complete'];
  const trainer = () => model.TRAINERS.find(item => item.id === trainerId);
  const partLabels = { hair: 'Hair', skin: 'Skin', cap: 'Cap / headband', top: 'Top', bottoms: 'Bottoms' };
  const palettes = {
    hair: [['Soft black','#25232d'],['Deep brown','#604333'],['Chestnut','#965b3b'],['Copper','#ce7842'],['Golden blond','#e5c475'],['Silver','#d3d6de'],['Ocean blue','#4e93ce'],['Violet','#aa76ce']],
    skin: [['Porcelain','#ffe2cf'],['Peach','#f5c7a5'],['Golden tan','#dbad83'],['Warm tan','#bd8a63'],['Caramel','#a36c4d'],['Umber','#845339'],['Deep brown','#603e30'],['Ebony','#422e28']],
    clothing: [['Coral','#ef737b'],['Amber','#e9b75d'],['Leaf green','#72bb87'],['Teal','#4fbebc'],['Ocean blue','#5b9cdc'],['Violet','#a981d8'],['Cream','#f3e9d2'],['Ink','#394154']],
  };
  function speak(text) {
    clearTimeout(typingTimer);
    const visual = query('[data-dialogue-visual]');
    query('[data-dialogue-accessible]').textContent = text;
    visual.textContent = '';
    const characters = Array.from(text);
    let index = 0;
    function type() {
      if (reducedMotion.matches) index = characters.length;
      else index = Math.min(index + 2, characters.length);
      visual.textContent = characters.slice(0, index).join('');
      if (index < characters.length) typingTimer = setTimeout(type, 24);
    }
    type();
  }
  function updatePortraits() {
    const selected = trainer();
    if (!selected) return;
    root.style.setProperty('--selected-color', selected.color);
    const name = model.normalizeName(nameInput.value) || 'Your trainer';
    query('[data-chosen-label]').textContent = name;
    query('[data-editor-name]').textContent = name;
    const images = root.querySelectorAll('[data-editor-sprite], [data-chosen-sprite], [data-card-sprite]');
    const version = ++renderVersion;
    previewReady = false;
    if (step === 'customize') next.disabled = true;
    images.forEach(image => { image.alt = `${name} — customized trainer icon`; });
    colors.render(selected.id, appearance).then(url => {
      if (version !== renderVersion) return;
      images.forEach(image => { image.src = url; });
      previewReady = true;
      query('[data-editor-status]').textContent = '';
      if (step === 'customize') next.disabled = false;
    }).catch(() => {
      if (version !== renderVersion) return;
      query('[data-editor-status]').textContent = 'The preview couldn’t load. Please reload to try again.';
    });
  }
  function updateEditor() {
    if (!trainerId) return;
    const defaults = colors.bases(trainerId);
    const selectedColor = appearance[activePart] || defaults[activePart];
    root.querySelectorAll('[data-part]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.part === activePart));
    });
    root.querySelectorAll('[data-part-chip]').forEach(chip => {
      chip.style.backgroundColor = appearance[chip.dataset.partChip] || defaults[chip.dataset.partChip];
    });
    const label = partLabels[activePart];
    query('[data-color-heading]').textContent = `${label} color`;
    query('[data-reset-part]').textContent = `Reset ${activePart}`;
    query('[data-reset-part]').disabled = !appearance[activePart];
    query('[data-reset-colors]').disabled = !Object.keys(appearance).length;
    query('#customColor').value = selectedColor;
    query('#customColor').setAttribute('aria-label', `Custom ${activePart} color`);
    query('[data-color-value]').textContent = selectedColor.toUpperCase();
    query('[data-color-state]').textContent = Object.keys(appearance).length ? 'Your custom palette' : 'Original colors';
    const swatches = query('[data-swatches]');
    swatches.setAttribute('aria-label', `${label} colors`);
    const options = palettes[activePart] || palettes.clothing;
    // Keep buttons mounted while choosing colors so keyboard focus does not disappear.
    if (swatches.dataset.part !== activePart) {
      swatches.replaceChildren();
      swatches.dataset.part = activePart;
      for (const [name, hex] of options) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'color-swatch';
        button.style.setProperty('--swatch', hex);
        button.dataset.color = hex;
        button.setAttribute('aria-label', name);
        button.title = name;
        button.addEventListener('click', () => setColor(hex));
        swatches.append(button);
      }
    }
    swatches.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.color === appearance[activePart])));
  }
  function setColor(hex) {
    appearance = model.normalizeAppearance({ ...appearance, [activePart]: hex });
    updateEditor();
    updatePortraits();
  }
  function show(nextStep, focus = true) {
    step = nextStep;
    root.dataset.step = step;
    root.querySelectorAll('[data-pane]').forEach(pane => { pane.hidden = pane.dataset.pane !== step; });
    back.hidden = !['trainer', 'customize', 'name'].includes(step);
    next.hidden = !['welcome', 'trainer', 'customize'].includes(step);
    next.disabled = (step === 'trainer' && !trainerId) || (step === 'customize' && !previewReady);
    confirm.hidden = step !== 'name';
    edit.hidden = step !== 'complete';
    query('[data-replay]').hidden = step !== 'complete';
    query('[data-save-note]').textContent = step === 'complete'
      ? (savedToBrowser ? 'Draft profile saved in this browser.' : 'Preview only · Browser storage is unavailable.')
      : 'Your story starts here.';
    next.innerHTML = `${step === 'trainer' ? 'Customize' : step === 'customize' ? 'Use this look' : 'Let’s begin'} <span aria-hidden="true">▶</span>`;
    updatePortraits();
    if (step === 'customize') updateEditor();
    if (step === 'welcome') speak('Hello there! Welcome to PokeLeague. I’m Professor Juniper. Before your adventure begins, let’s get to know you.');
    if (step === 'trainer') speak(trainerId ? 'Great choice! Let’s give your trainer a little of your own style.' : 'First, choose your trainer icon. Go with the one that feels right to you!');
    if (step === 'customize') speak('A splash of color can make all the difference! Try a new look, or keep the colors you started with.');
    if (step === 'name') speak('Now, what should I call you? Tell me your name, and we’ll get your trainer card ready.');
    if (step === 'complete') speak(`Nice to meet you, ${model.normalizeName(nameInput.value)}! Your trainer card is ready. This is the beginning of your PokeLeague story.`);
    if (focus) query(`[data-pane="${step}"] h1`).focus({ preventScroll: true });
  }
  function updateName() {
    query('#nameCount').textContent = `${nameInput.value.length} / 20`;
    query('#nameError').textContent = '';
    nameInput.removeAttribute('aria-invalid');
    const name = model.normalizeName(nameInput.value) || 'Your trainer';
    query('[data-chosen-label]').textContent = name;
    query('[data-editor-name]').textContent = name;
  }
  function complete(profile, focus = true) {
    query('[data-card-name]').textContent = profile.name;
    query('[data-greeting]').textContent = `${profile.name}, your adventure is just getting started.`;
    show('complete', focus);
  }
  root.querySelectorAll('input[name="trainer"]').forEach(input => {
    input.checked = input.value === trainerId;
    input.addEventListener('change', () => {
      trainerId = input.value;
      next.disabled = false;
      updatePortraits();
      speak('Great choice! Let’s give your trainer a little of your own style.');
    });
  });
  next.addEventListener('click', () => {
    if (step === 'welcome') show('trainer');
    else if (step === 'trainer' && trainerId) show('customize');
    else if (step === 'customize' && previewReady) show('name');
  });
  back.addEventListener('click', () => show(order[order.indexOf(step) - 1]));
  edit.addEventListener('click', () => show('customize'));
  query('[data-change-icon]').addEventListener('click', () => show('trainer'));
  root.querySelectorAll('[data-part]').forEach(button => button.addEventListener('click', () => {
    activePart = button.dataset.part;
    updateEditor();
  }));
  query('#customColor').addEventListener('input', event => setColor(event.target.value));
  query('[data-reset-part]').addEventListener('click', () => { delete appearance[activePart]; updateEditor(); updatePortraits(); });
  query('[data-reset-colors]').addEventListener('click', () => { appearance = {}; updateEditor(); updatePortraits(); });
  query('[data-replay]').addEventListener('click', () => show('welcome'));
  nameInput.addEventListener('input', updateName);
  query('#nameForm').addEventListener('submit', event => {
    event.preventDefault();
    if (step !== 'name') return;
    const profile = model.validate({ trainerId, name: nameInput.value, appearance });
    if (!profile) {
      query('#nameError').textContent = 'Enter a name between 1 and 20 characters.';
      nameInput.setAttribute('aria-invalid', 'true');
      nameInput.focus();
      return;
    }
    nameInput.value = profile.name;
    updateName();
    savedToBrowser = model.save(storage, profile).ok;
    complete(profile);
  });
  if (saved) {
    nameInput.value = saved.name;
    updateName();
    complete(saved, false);
  } else show('welcome', false);
})();
