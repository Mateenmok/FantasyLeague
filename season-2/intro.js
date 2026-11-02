(() => {
  // This preview only writes its own browser profile, never a Season 1 account.
  try { if (sessionStorage.getItem('pokeleague.season2Workspace') !== 'SEASON1') return; }
  catch { return; }
  const model = window.PokeLeagueSeasonTwoProfile;
  const root = document.querySelector('.intro');
  const query = selector => root.querySelector(selector);
  let storage;
  try { storage = window.localStorage; } catch { /* Private browsers can deny access. */ }
  const saved = model.read(storage);
  let trainerId = saved?.trainerId || '';
  let step = 'welcome';
  let typingTimer;
  let savedToBrowser = Boolean(saved);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const nameInput = query('#trainerName');
  const next = query('[data-next]');
  const back = query('[data-back]');
  const confirm = query('[data-confirm]');
  const edit = query('[data-edit]');
  const order = ['welcome', 'trainer', 'name', 'complete'];
  const trainer = () => model.TRAINERS.find(item => item.id === trainerId);
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
    root.querySelectorAll('[data-chosen-sprite], [data-card-sprite]').forEach(image => {
      image.src = `images/trainers/${selected.id}.png`;
      image.alt = `${selected.name} trainer icon`;
    });
    query('[data-chosen-label]').textContent = `${selected.name.toUpperCase()} / YOUR TRAINER`;
    query('[data-card-trainer]').textContent = selected.name;
  }
  function show(nextStep, focus = true) {
    step = nextStep;
    root.dataset.step = step;
    root.querySelectorAll('[data-pane]').forEach(pane => { pane.hidden = pane.dataset.pane !== step; });
    root.querySelectorAll('[data-progress]').forEach(item => {
      const index = order.indexOf(item.dataset.progress);
      item.classList.toggle('is-done', index < order.indexOf(step));
      if (item.dataset.progress === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    back.hidden = !['trainer', 'name'].includes(step);
    next.hidden = !['welcome', 'trainer'].includes(step);
    next.disabled = step === 'trainer' && !trainerId;
    confirm.hidden = step !== 'name';
    edit.hidden = step !== 'complete';
    query('[data-replay]').hidden = step !== 'complete';
    query('[data-save-note]').textContent = step === 'complete'
      ? (savedToBrowser ? 'Draft profile saved in this browser.' : 'Preview only · Browser storage is unavailable.')
      : 'Your story starts here.';
    next.innerHTML = step === 'trainer' ? 'That’s me <span aria-hidden="true">▶</span>' : 'Let’s begin <span aria-hidden="true">▶</span>';
    updatePortraits();
    if (step === 'welcome') speak('Hello there! Welcome to PokeLeague. I’m Professor Juniper. Before your adventure begins, let’s get to know you.');
    if (step === 'trainer') speak(trainerId ? `${trainer().name} — a great choice! Ready to make this your trainer?` : 'First, choose your trainer icon. Go with the one that feels right to you!');
    if (step === 'name') speak('Now, what should I call you? Tell me your name, and we’ll get your trainer card ready.');
    if (step === 'complete') speak(`Nice to meet you, ${model.normalizeName(nameInput.value)}! Your trainer card is ready. This is the beginning of your PokeLeague story.`);
    if (focus) query(`[data-pane="${step}"] h1`).focus({ preventScroll: true });
  }
  function updateName() {
    query('#nameCount').textContent = `${nameInput.value.length} / 20`;
    query('#nameError').textContent = '';
    nameInput.removeAttribute('aria-invalid');
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
      speak(`${trainer().name} — a great choice! Ready to make this your trainer?`);
    });
  });
  next.addEventListener('click', () => {
    if (step === 'welcome') show('trainer');
    else if (step === 'trainer' && trainerId) show('name');
  });
  back.addEventListener('click', () => show(step === 'name' ? 'trainer' : 'welcome'));
  edit.addEventListener('click', () => show('trainer'));
  query('[data-replay]').addEventListener('click', () => show('welcome'));
  nameInput.addEventListener('input', updateName);
  query('#nameForm').addEventListener('submit', event => {
    event.preventDefault();
    if (step !== 'name') return;
    const profile = model.validate({ trainerId, name: nameInput.value });
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
