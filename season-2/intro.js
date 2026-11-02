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
  let compareOriginal = false;
  let zoom = window.matchMedia('(max-width: 760px)').matches ? 2 : 4;
  let inputGesture = null;
  let thumbnailVersion = 0;
  let thumbnailKey = '';
  let renderedSprite = '';
  const undoStack = [], redoStack = [];
  const clone = value => JSON.parse(JSON.stringify(value));
  const groups = { cap:['cap','capTrim'], top:['top','sleeves'], shoes:['shoes','soles'] };
  const groupFor = part => Object.keys(groups).find(group => groups[group].includes(part)) || part;
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
  const partLabels = { hair:'Hair', skin:'Skin', cap:'Headwear', capTrim:'Headwear trim', top:'Top', sleeves:'Sleeves', bottoms:'Bottoms', shoes:'Shoes', soles:'Soles', bag:'Bag & straps' };
  const help = { hair:'A familiar trainer, with your own finishing touch.', skin:'Choose the tone that feels like you.', cap:'Color the main fabric and the trim separately.', top:'Style the body and sleeves independently.', bottoms:'A little color. A completely different outfit.', shoes:'Finish your look with shoes and contrasting soles.', bag:'Bring your accessories into the palette.' };
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
    query('[data-export]').setAttribute('aria-disabled', 'true');
    query('[data-export]').removeAttribute('href');
    images.forEach(image => { image.alt = `${name} — customized trainer icon`; });
    colors.render(selected.id, appearance).then(url => {
      if (version !== renderVersion) return;
      renderedSprite = url;
      images.forEach(image => { image.src = compareOriginal && image.hasAttribute('data-editor-sprite') ? 'images/trainers/'+selected.id+'.png' : url; });
      const exportLink = query('[data-export]');
      exportLink.href = url;
      exportLink.download = (model.normalizeName(nameInput.value).replace(/[^a-z0-9_-]/gi, '-') || 'pokeleague-trainer') + '.png';
      exportLink.setAttribute('aria-disabled', 'false');
      previewReady = true;
      query('[data-editor-status]').textContent = '';
      if (step === 'customize') next.disabled = false;
    }).catch(() => {
      if (version !== renderVersion) return;
      query('[data-editor-status]').textContent = 'The preview couldn’t load. Please reload to try again.';
    });
  }
  function updateHistory() {
    query('[data-undo]').disabled = !undoStack.length;
    query('[data-redo]').disabled = !redoStack.length;
  }
  function applyAppearance(value, label, gesture = null) {
    const normalized = model.normalizeAppearance(value);
    if (JSON.stringify(normalized) === JSON.stringify(appearance)) return;
    if (!gesture || inputGesture !== gesture) {
      undoStack.push(clone(appearance));
      if (undoStack.length > 60) undoStack.shift();
    }
    inputGesture = gesture;
    redoStack.length = 0;
    appearance = normalized;
    query('[data-edit-feedback]').textContent = label || 'Look updated';
    updateEditor(); updatePortraits();
  }
  function travelHistory(from, to) {
    if (!from.length) return;
    inputGesture = null;
    to.push(clone(appearance)); appearance = from.pop();
    query('[data-edit-feedback]').textContent = from === undoStack ? 'Change undone' : 'Change restored';
    updateEditor(); updatePortraits();
  }
  function updateThumbnails() {
    const key = trainerId + JSON.stringify(appearance);
    if (key === thumbnailKey) return;
    thumbnailKey = key;
    const version = ++thumbnailVersion;
    root.querySelectorAll('[data-style-preview]').forEach(image => {
      const look = { ...appearance, hairstyle: image.dataset.stylePreview };
      colors.render(trainerId, look).then(url => {
        if (version === thumbnailVersion) image.src = url;
      }).catch(() => { if (version === thumbnailVersion) { thumbnailKey=''; image.src='images/trainers/'+trainerId+'.png'; } });
    });
  }
  function updateEditor() {
    if (!trainerId) return;
    const defaults=colors.bases(trainerId), selectedColor=appearance[activePart] || defaults[activePart];
    const group=groupFor(activePart), label=partLabels[activePart];
    root.querySelectorAll('[data-part]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.part===group)));
    root.querySelectorAll('[data-part-chip]').forEach(chip => { chip.style.backgroundColor=appearance[chip.dataset.partChip] || defaults[chip.dataset.partChip]; });
    query('[data-detail-heading]').textContent = partLabels[group];
    query('[data-detail-help]').textContent = help[group];
    const details=query('[data-detail-parts]');
    details.hidden=!groups[group];
    if (details.dataset.group!==group) {
      details.dataset.group=group; details.replaceChildren();
      for (const part of groups[group] || []) {
        const button=document.createElement('button'); button.type='button'; button.textContent=part===group ? 'Main color' : partLabels[part];
        button.dataset.detail=part;
        button.addEventListener('click',()=>{ activePart=part; inputGesture=null; updateEditor(); });
        details.append(button);
      }
    }
    details.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.detail===activePart)));
    query('[data-hair-options]').hidden=group!=='hair';
    root.querySelectorAll('[data-hairstyle]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.hairstyle===(appearance.hairstyle || 'original'))));
    if(group==='hair') updateThumbnails();
    query('[data-color-heading]').textContent=label+' color';
    query('[data-reset-part]').textContent='Reset '+label.toLowerCase();
    query('[data-reset-part]').disabled=!appearance[activePart] && !appearance.patterns?.[activePart] && !(activePart==='hair' && appearance.hairstyle);
    query('[data-reset-colors]').disabled=!Object.keys(appearance).length;
    query('#customColor').value=selectedColor;
    query('#customColor').setAttribute('aria-label','Custom '+label.toLowerCase()+' color');
    query('[data-color-value]').textContent=selectedColor.toUpperCase();
    query('[data-color-state]').textContent=Object.keys(appearance).length ? 'Custom look' : 'Original look';
    const swatches=query('[data-swatches]'); swatches.setAttribute('aria-label',label+' colors');
    if(swatches.dataset.part!==activePart) {
      swatches.replaceChildren(); swatches.dataset.part=activePart;
      for(const [name,hex] of palettes[activePart] || palettes.clothing) {
        const button=document.createElement('button'); button.type='button'; button.className='color-swatch'; button.style.setProperty('--swatch',hex); button.dataset.color=hex;
        button.setAttribute('aria-label',name); button.title=name;
        button.addEventListener('click',()=>setColor(hex)); swatches.append(button);
      }
    }
    swatches.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.color===selectedColor)));
    const pattern=appearance.patterns?.[activePart];
    query('[data-pattern-options]').hidden=!model.FABRICS.includes(activePart);
    root.querySelectorAll('[data-pattern]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.pattern===(pattern?.kind || 'plain'))));
    query('[data-pattern-settings]').hidden=!pattern;
    query('[data-pattern-color]').value=pattern?.color || '#f3e9d2';
    query('[data-pattern-scale]').value=String(pattern?.scale || 3);
    query('[data-pattern-options]').style.setProperty('--fabric-color',selectedColor);
    query('[data-pattern-options]').style.setProperty('--pattern-color',pattern?.color || '#f3e9d2');
    updateHistory();
  }
  function setColor(hex,gesture=null) {
    applyAppearance({ ...appearance, [activePart]:hex }, partLabels[activePart]+' color updated',gesture);
  }
  function setPattern(changes,gesture=null) {
    const patterns=clone(appearance.patterns || {});
    if(changes.kind==='plain') delete patterns[activePart];
    else patterns[activePart]={kind:'stripes',color:'#f3e9d2',scale:3,...patterns[activePart],...changes};
    applyAppearance({...appearance,patterns},partLabels[activePart]+' pattern updated',gesture);
  }
  function updatePreviewControls() {
    query('[data-preview-stage]').dataset.zoom=String(zoom);
    query('[data-zoom-label]').textContent=zoom+'×';
    query('[data-zoom-out]').disabled=zoom===2; query('[data-zoom-in]').disabled=zoom===5;
    query('[data-compare]').setAttribute('aria-pressed',String(compareOriginal));
    query('[data-preview-caption]').textContent=compareOriginal ? 'Original · comparison' : 'Your look';
    if(trainerId) query('[data-editor-sprite]').src=compareOriginal ? 'images/trainers/'+trainerId+'.png' : renderedSprite || 'images/trainers/'+trainerId+'.png';
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
      ? (savedToBrowser ? 'Trainer saved in this browser.' : 'Preview only · Browser storage is unavailable.')
      : step === 'customize' ? 'Use this look, then confirm your name to save.' : 'Your story starts here.';
    next.innerHTML = `${step === 'trainer' ? 'Customize' : step === 'customize' ? 'Use this look' : 'Let’s begin'} <span aria-hidden="true">▶</span>`;
    updatePortraits();
    if (step === 'customize') { updateEditor(); updatePreviewControls(); }
    if (step === 'welcome') speak('Hello there! Welcome to PokeLeague. I’m Professor Juniper. Before your adventure begins, let’s get to know you.');
    if (step === 'trainer') speak(trainerId ? 'Great choice! Let’s give your trainer a little of your own style.' : 'First, choose your trainer icon. Go with the one that feels right to you!');
    if (step === 'customize') speak('Make every detail your own. Choose a part to style, and try a new color, a pattern, or a finishing touch.');
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
      undoStack.length=0; redoStack.length=0; inputGesture=null; compareOriginal=false; thumbnailKey='';
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
  root.querySelectorAll('[data-part]').forEach(button=>button.addEventListener('click',()=>{ activePart=button.dataset.part; inputGesture=null; updateEditor(); }));
  query('#customColor').addEventListener('input',event=>setColor(event.target.value,'color:'+activePart));
  query('#customColor').addEventListener('change',()=>{ inputGesture=null; });
  root.querySelectorAll('[data-hairstyle]').forEach(button=>button.addEventListener('click',()=>applyAppearance({...appearance,hairstyle:button.dataset.hairstyle},'Hairstyle updated')));
  root.querySelectorAll('[data-pattern]').forEach(button=>button.addEventListener('click',()=>setPattern({kind:button.dataset.pattern})));
  query('[data-pattern-color]').addEventListener('input',event=>setPattern({color:event.target.value},'pattern:'+activePart));
  query('[data-pattern-color]').addEventListener('change',()=>{ inputGesture=null; });
  query('[data-pattern-scale]').addEventListener('change',event=>setPattern({scale:Number(event.target.value)}));
  query('[data-reset-part]').addEventListener('click',()=>{
    const value=clone(appearance); delete value[activePart];
    if(value.patterns) delete value.patterns[activePart];
    if(activePart==='hair') delete value.hairstyle;
    applyAppearance(value,partLabels[activePart]+' reset');
  });
  query('[data-reset-colors]').addEventListener('click',()=>applyAppearance({},'Original look restored'));
  query('[data-undo]').addEventListener('click',()=>travelHistory(undoStack,redoStack));
  query('[data-redo]').addEventListener('click',()=>travelHistory(redoStack,undoStack));
  root.addEventListener('keydown',event=>{
    if(step!=='customize' || !(event.ctrlKey || event.metaKey) || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    if(event.key.toLowerCase()==='z') { event.preventDefault(); event.shiftKey ? travelHistory(redoStack,undoStack) : travelHistory(undoStack,redoStack); }
  });
  query('[data-compare]').addEventListener('click',()=>{ compareOriginal=!compareOriginal; updatePreviewControls(); });
  query('[data-grid]').addEventListener('click',event=>{ const on=event.currentTarget.getAttribute('aria-pressed')!=='true'; event.currentTarget.setAttribute('aria-pressed',String(on)); query('[data-preview-stage]').classList.toggle('show-grid',on); });
  query('[data-zoom-in]').addEventListener('click',()=>{ zoom=Math.min(5,zoom+1); updatePreviewControls(); });
  query('[data-zoom-out]').addEventListener('click',()=>{ zoom=Math.max(2,zoom-1); updatePreviewControls(); });
  query('[data-export]').addEventListener('click',event=>{
    if(!trainerId || !previewReady) event.preventDefault();
  });
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
