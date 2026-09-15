(() => {
  const panel=document.querySelector('[data-opening-night]');
  if(!panel)return;
  // Eastern local time: September is daylight time (UTC−04:00).
  const deadline=Date.parse(panel.dataset.deadline);
  let interval;
  const update=()=>{
    const remaining=deadline-Date.now();
    if(!Number.isFinite(remaining)||remaining<=0){
      panel.hidden=true;clearInterval(interval);return;
    }
    const totalMinutes=Math.ceil(remaining/60000);
    const days=Math.floor(totalMinutes/1440),hours=Math.floor(totalMinutes%1440/60),minutes=totalMinutes%60;
    for(const [unit,value] of Object.entries({days,hours,minutes}))panel.querySelector(`[data-opening-${unit}]`).textContent=String(value).padStart(2,'0');
    panel.querySelector('[data-opening-clock]').setAttribute('aria-label',`${days} days, ${hours} hours, ${minutes} minutes until opening night`);
    panel.hidden=false;
  };
  update();
  if(!panel.hidden)interval=setInterval(update,1000);
  document.addEventListener('visibilitychange',update);
  window.addEventListener('pageshow',update);
})();
