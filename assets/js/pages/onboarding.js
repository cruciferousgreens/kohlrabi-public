/* ===== module: onboarding.js ===== */
/** #506 (v1.8): onboarding flow v2 — short branching first-run.
    Shown to first-time visitors (fresh profile: no persisted blob, no
    share boot, flow not already completed). Ordinary
    deep-link hashes no longer suppress the flow — the pending destination
    is remembered and routed to on finish.
    Local-only: there are no accounts and no sign-in — the flow goes
    straight from the welcome screen to setup choice, and all data stays
    on this device.
    Supersedes the parked 7-step gate's questions and program-info steps;
    experience/goal questions are dropped per the issue.
    Screens: welcome (vertically centered, Get started + white "Take me to
    the app") → setup choice (defaults vs custom branch,
    selectable cards + Next) → options (custom branch only) → import ("Skip
    to the app" is the primary green action, Import is the white secondary
    and opens the real file picker immediately, skippable) → how-it-works
    (three tappable detail cards) → done (logo, app name, summary of the
    branch taken). Every screen has a primary action and a skip affordance.
    The flow owns the boot: app-bootstrap skips the initial tab render while
    it is up; "Enter the app" lands on the dashboard ("Ready?" hero) or the
    remembered deep link.
    Module map — Key: shouldShowOnboarding(), maybeStartOnboardingV2(),
    ofApplyBranchSettings(),
    ofSummaryRows(), ofScreenHtml(). Depends on:
    state (progressionSetup, resetProgressionSetup, freshProgressionSetup),
    utilities (escapeHtml, REP_PRESETS), persistence (PERSIST_KEY,
    LS_BACKUP_KEY, Storage, schedulePersist — all guarded), csv-import
    (openCsvImport — guarded), programs (applyRepPreset — guarded),
    navigation (showDashboard, showLibrary, showWorkouts, showProgram,
    showStats, showSettings, openExercise — guarded). */
/* "of" = onboarding flow; the legacy "ob" prefix belongs to the csv-import
   overlay (extracted from the parked gate, #99 B1). */
const ONBOARDING_DONE_KEY='workout-app:onboarding-v2-done';
const ONBOARDING_GUIDE_URL='https://cruciferousgreens.com/getting-started';
/* Mutable flow state — reset every time the flow starts. ofState is a const
   object (never reassigned) so tests can mutate fields through the harness. */
/* Fresh onboarding flow state: the answers/questions start values. */
function ofFreshState(){return {screen:'welcome',setup:'defaults',units:'lb',rpe:'8',reps:'hypertrophy',days:'3',prog:'on',imp:'skipped',cameFromOptions:false,routeHash:''};}
const ofState=ofFreshState();
/* Resets the flow state (the const object is mutated, never reassigned). */
function ofResetState(){Object.assign(ofState,ofFreshState());}
/* Escapes a string for HTML when escapeHtml is present, else stringifies. */
function ofEsc(s){return (typeof escapeHtml==='function')?escapeHtml(s):String(s==null?'':s);}
/* ===== first-run gating (pure decision — unit-tested) ===== */
/* #506 follow-up (user 2026-09-16): onboarding fires on deep links too —
   only share links own the boot now. finishOnboarding routes back to the
   pending deep link (ofRouteDeepLink). */
function shouldShowOnboarding(o){
  if(!o||typeof o!=='object')return false;
  if(o.done)return false;            /* flow already completed on this profile */
  if(o.shareBoot)return false;       /* #296: share links own the boot */
  if(o.hasLocalData)return false;    /* returning profile */
  return true;
}
/* #537 (v1.811): wipe-plant detector for the first-run gate. wipeLocalUserData
   stamps its #520 empty-plants with wipedAt; those blobs are "no local data".
   Defensive: anything unparseable is NOT a plant (fail closed → don't show). */
function isWipePlantRaw(raw){
  if(raw==null)return false;
  let data=null;
  try{data=JSON.parse(raw);}catch(_){return false;}
  return !!(data&&typeof data==='object'&&Number(data.wipedAt)>0);
}
/* Gather the gating inputs. Every probe is defensive: wedged storage
   must fail closed toward "don't show". */
async function ofGateInputs(){
  let done=false;
  try{done=localStorage.getItem(ONBOARDING_DONE_KEY)==='1';}catch(_){/* private mode */}
  let shareBoot=false,routeHash='';
  try{
    const hash=location.hash||'';
    shareBoot=/^#share=/.test(hash);
    routeHash=decodeURIComponent(hash.replace(/^#/,'')).trim();
  }catch(_){}
  let hasLocalData=false;
  try{
    /* #537 (v1.811): a wipe-planted empty payload (wipedAt stamp) is not local
       data — otherwise the flow could never resurface after delete-all. */
    const lsRaw=localStorage.getItem(PERSIST_KEY);
    if(lsRaw!=null&&!isWipePlantRaw(lsRaw))hasLocalData=true;
    else{
      const bkpRaw=localStorage.getItem(LS_BACKUP_KEY);
      if(bkpRaw!=null&&!isWipePlantRaw(bkpRaw))hasLocalData=true;
      else if(typeof Storage!=='undefined'&&Storage&&typeof Storage.loadBlob==='function'){
        /* IDB backend: the LS keys are empty on a fresh profile, so ask IDB. */
        const raw=await Storage.loadBlob(PERSIST_KEY);
        if(raw!=null&&!isWipePlantRaw(raw))hasLocalData=true;
      }
    }
  }catch(_){}
  return {done,shareBoot,routeHash,hasLocalData};
}
/* Boot entry point (called from app-bootstrap after restore).
   Returns true when the flow started and owns the boot. */
async function maybeStartOnboardingV2(){
  let inputs=null;
  try{inputs=await ofGateInputs();}catch(_){return false;}
  if(!shouldShowOnboarding(inputs))return false;
  startOnboardingFlow();
  return true;
}
/* ===== settings application ===== */
/* Clamps a days-per-week answer to 1–7 (default 3). */
function ofClampDays(d){return Math.min(7,Math.max(1,Math.round(Number(d)||3)));}
/* Apply the branch's answers to the live progression defaults. The defaults
   branch resets to the canonical defaults (a fresh profile already has them;
   this also repairs a profile whose blob predates a default). The custom
   branch writes the five option answers; days/week is the new
   progressionSetup.trainingDays (#506). */
function ofApplyBranchSettings(){
  if(ofState.setup==='custom'){
    progressionSetup.units=(ofState.units==='kg')?'metric':'imperial';
    const rpe=Number(ofState.rpe);
    progressionSetup.threshold=(rpe===7||rpe===9)?rpe:8;
    ofApplyRepRange(ofState.reps);
    progressionSetup.trainingDays=ofClampDays(ofState.days);
    progressionSetup.progressionOff=(ofState.prog!=='on');
  }else if(typeof resetProgressionSetup==='function'){
    try{resetProgressionSetup();}catch(_){}
  }else if(typeof freshProgressionSetup==='function'){
    try{Object.assign(progressionSetup,freshProgressionSetup());}catch(_){}
  }
  try{if(typeof schedulePersist==='function')schedulePersist();}catch(_){}
}
/* Applies the chosen rep-range preset to the live progression defaults (Settings-pill sync when available). */
function ofApplyRepRange(key){
  const k=(typeof REP_PRESETS!=='undefined'&&REP_PRESETS[key])?key:'hypertrophy';
  /* programs.js's applyRepPreset also syncs the Settings pill DOM when it is
     present; fall back to a direct write when it isn't (tests). */
  if(typeof applyRepPreset==='function'){try{applyRepPreset(k,progressionSetup);return;}catch(_){}}
  const preset=REP_PRESETS[k];
  progressionSetup.defaultRange={preset:k,min:preset.min,max:preset.max??null,openTop:!!preset.openTop,amrap:!!preset.amrap};
}
/* ===== done-screen summary (reflects the branch taken) ===== */
const OF_REP_LABELS={strength:'1–5',hypertrophy:'6–12',endurance:'12–20',amrap:'AMRAP'};
const OF_IMPORT_LABELS={skipped:'Skipped',done:'Started'};
/* Done-screen summary rows reflecting the branch taken. */
function ofSummaryRows(){
  return [
    /* User 2026-09-16: no Setup row — the card IS the setup summary. */
    /* User 2026-09-16: the units row reads Imperial/Metric, not lb/kg. */
    ['Units',ofState.units==='kg'?'Metric':'Imperial'],
    ['RPE threshold',String(Number(ofState.rpe)===7||Number(ofState.rpe)===9?ofState.rpe:'8')],
    ['Rep range',OF_REP_LABELS[ofState.reps]||OF_REP_LABELS.hypertrophy],
    /* User 2026-09-19: no Days per week row on the done card. */
    ['Suggestions',ofState.prog==='off'?'Off':'On'],
    ['Import',OF_IMPORT_LABELS[ofState.imp]||OF_IMPORT_LABELS.skipped],
    /* User 2026-09-16: the done card shows the account state — always
       "Local only" in this build (see ofAccountLabel). */
    ['Account',ofAccountLabel()],
  ];
}
/* Account label for the done summary: there are no accounts in this
   build, so the done card always reads "Local only". */
function ofAccountLabel(){
  return 'Local only';
}
/* ===== screens (HTML builders — the flow's copy lives here) ===== */
/* ofTopbar(target,title): target is the back-button destination screen (or a
   falsy value for no back button). */
function ofTopbar(target,title){
  return '<div class="of-topbar">'
    +(target?`<button class="of-back" type="button" data-of-back="${target}" aria-label="Back">‹</button>`:'<span></span>')
    +`<span class="of-title">${title}</span>`
    /* Brand mark on every top-bar screen (#506): the right slot carries a
       mini Kohlrabi logo instead of sitting empty. */
    +`<img class="of-mark" src="icon-192.png" alt="Kohlrabi">`
    +`</div>`;
}
/* Welcome screen markup. */
function ofWelcomeHtml(){
  /* #506 follow-up (user 2026-09-16): the content is vertically centered;
     the white "Take me to the app" button skips straight into the app. */
  return `<div class="of-body of-center of-vcenter">`
    +`<img class="of-logo" src="icon-192.png" alt="Kohlrabi logo">`
    +`<div class="of-brand">Kohlrabi</div>`
    +`<p class="of-sub">Free workout tracking with smart progression.</p>`
    +`<button class="of-cta" type="button" data-of-go="choice">Get started</button>`
    +`<button class="of-cta of-secondary" type="button" data-of-skip>Take me to the app</button>`
    +`</div>`;
}
/* Setup-choice screen markup: the "use defaults" vs "customize" branch cards. */
function ofChoiceHtml(){
  return ofTopbar('welcome','Setup')
    +`<div class="of-body">`
    +`<h1 class="of-h1">How do you want to set up?</h1>`
    +`<p class="of-sub">Pick a path. You can change everything later in Settings.</p>`
    +`<div class="of-cards">`
    +`<button class="of-card${ofState.setup==='defaults'?' of-card-sel':''}" type="button" data-of-setup="defaults" aria-pressed="${ofState.setup==='defaults'}"><strong>Give me the defaults <span class="of-tag">Recommended</span></strong><span>Sensible training defaults. Start lifting in seconds.</span></button>`
    +`<button class="of-card${ofState.setup==='custom'?' of-card-sel':''}" type="button" data-of-setup="custom" aria-pressed="${ofState.setup==='custom'}"><strong>I want more options</strong><span>Tune units, RPE, rep ranges, training days, and more.</span></button>`
    +`</div><div class="of-spacer of-tight"></div>`
    +`<button class="of-cta" type="button" id="ofChoiceNext">Next</button>`
    +`<button class="of-quiet" type="button" data-of-skip>Skip to the app</button>`
    +`</div>`;
}
/* Segmented-control markup for an onboarding question (units). */
function ofSegHtml(name,options){
  return `<div class="of-seg" data-of-seg role="group" aria-label="${name}">`+options.map(([v,label])=>
    `<button type="button" class="${ofState[name]===v?'of-seg-sel':''}" data-of-name="${name}" data-of-segval="${v}" aria-pressed="${ofState[name]===v}">${label}</button>`
  ).join('')+`</div>`;
}
/* Pill-group markup for an onboarding question (RPE, rep range, days). */
function ofPillsHtml(name,options){
  return `<div class="of-pills" data-of-pills role="group" aria-label="${name}">`+options.map(([v,label])=>
    `<button type="button" class="of-pill${ofState[name]===v?' of-sel':''}" data-of-name="${name}" data-of-pillval="${v}" aria-pressed="${ofState[name]===v}">${label}</button>`
  ).join('')+`</div>`;
}
/* Options screen markup (custom branch only): units, RPE, rep range, days, progression switch. */
function ofOptionsHtml(){
  return ofTopbar('choice','Options')
    +`<div class="of-body">`
    +`<h1 class="of-h1">Tune your setup</h1>`
    +`<p class="of-sub">Set what matters, skip the rest.</p>`
    +`<div class="of-qgroup"><span>Units</span>${ofSegHtml('units',[['lb','lb'],['kg','kg']])}</div>`
    /* #514 (user 2026-09-16): beginners meet "RPE threshold" and "AMRAP"
       with no definitions — one short sublabel under each group. */
    +`<div class="of-qgroup"><span>RPE threshold</span><small class="of-qsub">How hard your top sets should feel, on a 1&ndash;10 scale</small>${ofPillsHtml('rpe',[['7','7'],['8','8'],['9','9']])}</div>`
    +`<div class="of-qgroup"><span>Rep range</span><small class="of-qsub">AMRAP = as many reps as possible</small>${ofPillsHtml('reps',[['strength','1–5'],['hypertrophy','6–12'],['endurance','12–20'],['amrap','AMRAP']])}</div>`
    +`<div class="of-qgroup"><span>Days per week</span>${ofPillsHtml('days',[['2','2'],['3','3'],['4','4'],['5','5'],['6','6']])}</div>`
    +`<div class="of-switchrow"><div><strong>Progression suggestions</strong><span>Suggest next targets after each workout</span></div>`
    +`<button class="of-switch${ofState.prog==='on'?' of-on':''}" type="button" data-of-switch="prog" role="switch" aria-checked="${ofState.prog==='on'}" aria-label="Progression suggestions"></button></div>`
    +`<div class="of-spacer"></div>`
    +`<button class="of-cta" type="button" id="ofOptionsContinue">Continue</button>`
    +`<button class="of-quiet" type="button" data-of-skip>Skip to the app</button>`
    +`</div>`;
}
/* #506 follow-up (user 2026-09-16): one button plus a plain list of the
   formats the real importer supports (Kohlrabi/template CSV, Hevy native
   exports, MacroFactor history CSV / program XLSX, Kohlrabi JSON backups).
   "Skip for now" is the primary green action (it continues the flow past
   import); Import is the white secondary; "Skip to the app" is the quiet
   link that exits onboarding entirely. Tapping Import opens the real importer right away (the
   standalone import overlay sits above the flow and returns to this screen
   when closed), exactly like a fresh-profile tap on Settings → Data. */
function ofImportHtml(){
  const back=ofState.cameFromOptions?'options':'choice';
  return ofTopbar(back,'Import')
    +`<div class="of-body">`
    +`<h1 class="of-h1">Bring your training with you</h1>`
    +`<p class="of-sub">Past workouts become history and power your progression.</p>`
    +`<ul class="of-srclist">`
    +`<li>Hevy exports</li>`
    +`<li>MacroFactor history or program files</li>`
    +`<li>CSV files — one row per set</li>`
    +`<li>Kohlrabi backups (.json)</li>`
    +`</ul>`
    +`<div class="of-spacer of-tight"></div>`
    /* User 2026-09-16: the two skips are switched — "Skip for now" (continue
       the flow past import) is the primary green action; "Skip to the app"
       (exit onboarding entirely) is the quiet link. */
    +`<button class="of-cta" type="button" id="ofImportSkip">Skip for now</button>`
    +`<button class="of-cta of-secondary" type="button" id="ofImportNow">Import workouts</button>`
    +`<button class="of-quiet" type="button" data-of-skip>Skip to the app</button>`
    +`</div>`;
}
/* #506 follow-up (user 2026-09-16): the cards are tappable — tapping one
   reveals a small detail card with material from the marketing site's
   getting-started page (one open at a time). The full page is linked at
   the bottom.
   #515 (user 2026-09-16): RPE and 1RM are defined on first use in the
   detail copy, so a beginner never has to leave the flow to learn them. */
const OF_HOW_CARDS=[
  ['log','Log your sets','Weight, reps, RPE. It saves as you type, and RPE is optional.',
   'Workout tab → Blank workout. Each set is a row: weight, reps, RPE — it saves as you type. RPE (rate of perceived exertion) is how hard the set felt, on a 1–10 scale, and it&rsquo;s optional. Tap the set number to tag it (warmup, dropset, to failure), then tap the check when the set is done.'],
  ['suggest','Smarter suggestions','Based on your real history — nothing changes until you tap a suggestion.',
   'Once an exercise has real history, suggestion cards show a computed target, each labeled with its basis. Tap a card to apply it — nothing changes until you tap.'],
  ['charts','Charts and progress','Estimated 1RM, volume by muscle, and blind spots.',
   'Estimated 1RM (one-rep max — the heaviest weight the app thinks you could lift once), volume by muscle, and blind spots — all on the Stats tab, with a time-period switcher up top.'],
];
/* How-it-works screen markup: three tappable detail cards. */
function ofHowHtml(){
  return ofTopbar('import','How it works')
    +`<div class="of-body">`
    /* User 2026-09-19: no title/subtitle on How it works — the cards
       carry the screen. */
    +OF_HOW_CARDS.map(([k,title,sub,detail])=>
      `<button class="of-infocard" type="button" data-of-how="${k}" aria-expanded="false"><strong>${title}</strong><span>${sub}</span></button>`
      +`<div class="of-howdetail" data-of-howdetail="${k}" hidden><p>${detail}</p></div>`
    ).join('')
    +`<div class="of-spacer of-tight"></div>`
    +`<button class="of-cta" type="button" id="ofHowContinue">Got it</button>`
    +`<a class="of-quiet" href="${ONBOARDING_GUIDE_URL}" target="_blank" rel="noopener">Read the full getting started guide</a>`
    +`<button class="of-quiet" type="button" data-of-skip>Skip to the app</button>`
    +`</div>`;
}
/* Tappable "How it works" card (one open at a time; tapping the open card
   closes it). Pure DOM toggle so tests can pin it. */
function ofToggleHow(key){
  let flow=null;
  try{flow=document.getElementById('onboardingFlow');}catch(_){}
  if(!flow)return;
  let opened=null;
  flow.querySelectorAll('[data-of-howdetail]').forEach(d=>{
    const isTarget=d.getAttribute('data-of-howdetail')===key;
    const open=isTarget&&d.hidden;
    d.hidden=!open;
    if(open)opened=key;
  });
  flow.querySelectorAll('[data-of-how]').forEach(b=>{
    b.setAttribute('aria-expanded',String(b.getAttribute('data-of-how')===opened));
  });
}
/* Done-screen markup: logo, app name, and the setup-summary card. */
function ofDoneHtml(){
  const rows=ofSummaryRows().map(([k,v])=>`<div><dt>${k}</dt><dd>${ofEsc(v)}</dd></div>`).join('');
  return `<div class="of-body of-center">`
    /* #506 follow-up (user 2026-09-16): the logo mark plus the bold app name
       sit at the top of the done screen. */
    +`<img class="of-logo of-logo-sm" src="icon-192.png" alt="Kohlrabi logo">`
    +`<div class="of-brand">Kohlrabi</div>`
    /* User 2026-09-16: no illustration on the done screen — the logo mark
       plus the app name already carry it. */
    /* User 2026-09-19: no "You're ready to lift" heading — the logo mark
       plus the app name carry the screen. */
    +`<p class="of-sub">Here&rsquo;s your setup. Change any of it later in Settings.</p>`
    +`<dl class="of-sumcard">${rows}</dl>`
    +`<div class="of-spacer of-tight"></div>`
    +`<button class="of-cta" type="button" id="ofEnterApp">Enter the app</button>`
    +`<a class="of-quiet" href="${ONBOARDING_GUIDE_URL}" target="_blank" rel="noopener">Read the full getting started guide</a>`
    +`</div>`;
}
/* Returns the markup for a flow screen by name (defaults to welcome). */
function ofScreenHtml(name){
  switch(name){
    case 'welcome':return ofWelcomeHtml();
    case 'choice':return ofChoiceHtml();
    case 'options':return ofOptionsHtml();
    case 'import':return ofImportHtml();
    case 'how':return ofHowHtml();
    case 'done':return ofDoneHtml();
    default:return ofWelcomeHtml();
  }
}
/* ===== flow controller ===== */
/* Starts the onboarding flow (resets state, builds the overlay, shows welcome). */
function startOnboardingFlow(){
  ofResetState();
  /* #506 follow-up: remember an ordinary deep-link hash so finishOnboarding
     can route back to it. Share links never reach this flow. */
  try{
    ofState.routeHash=decodeURIComponent(String(location.hash||'').replace(/^#/,'')).trim();
  }catch(_){ofState.routeHash='';}
  let flow=null;
  try{flow=document.getElementById('onboardingFlow');}catch(_){}
  if(!flow){
    try{
      flow=document.createElement('div');
      flow.id='onboardingFlow';
      flow.setAttribute('role','dialog');
      flow.setAttribute('aria-label','Welcome to Kohlrabi');
      flow.innerHTML='<div class="of-phone"><div id="ofBody"></div></div>';
      document.body.appendChild(flow);
    }catch(_){return;}
  }
  try{
    flow.hidden=false;
    document.body.classList.add('of-active');
  }catch(_){}
  ofGo('welcome');
}
/* Shows a flow screen: renders its markup, re-wires handlers, resets scroll. */
function ofGo(name){
  ofState.screen=name;
  let body=null;
  try{body=document.getElementById('ofBody');}catch(_){}
  if(body){body.innerHTML=ofScreenHtml(name);body.scrollTop=0;}
  ofWire();
  try{window.scrollTo(0,0);}catch(_){}
}
/* The back chevron returns to the named target screen (pure so tests can pin it). */
function ofResolveBack(target){
  return target;
}
/* One delegated click handler per screen render (replaced on every ofGo, so handlers never double-bind), plus per-screen wiring. */
function ofWire(){
  let body=null;
  try{body=document.getElementById('ofBody');}catch(_){}
  if(!body)return;
  body.onclick=(e)=>{
    const t=e&&e.target;
    if(!t||!t.closest)return;
    const goEl=t.closest('[data-of-go]');
    if(goEl){ofGo(goEl.getAttribute('data-of-go'));return;}
    const backEl=t.closest('[data-of-back]');
    if(backEl){ofGo(ofResolveBack(backEl.getAttribute('data-of-back')));return;}
    const pick=t.closest('[data-of-segval],[data-of-pillval]');
    if(pick){ofPick(pick);return;}
    const sw=t.closest('[data-of-switch]');
    if(sw){ofToggleSwitch(sw);return;}
    const setupEl=t.closest('[data-of-setup]');
    if(setupEl){
      ofState.setup=setupEl.getAttribute('data-of-setup')==='custom'?'custom':'defaults';
      /* Update the ring in place — re-rendering the whole screen here caused
         a visible flash/animation when toggling between the two cards. */
      const cards=setupEl.closest('.of-cards');
      if(cards)cards.querySelectorAll('[data-of-setup]').forEach(c=>{
        const sel=c===setupEl;
        c.classList.toggle('of-card-sel',sel);
        c.setAttribute('aria-pressed',String(sel));
      });
      return;
    }
    const howEl=t.closest('[data-of-how]');
    if(howEl){ofToggleHow(howEl.getAttribute('data-of-how'));return;}
    const skipEl=t.closest('[data-of-skip]');
    if(skipEl){
      /* #506 follow-up: skipping from the Options screen keeps the custom
         settings already picked (same apply step as Continue). */
      if(ofState.screen==='options')ofApplyOptions();
      finishOnboarding();return;
    }
  };
  const on=(id,fn)=>{const el=body.querySelector('#'+id);if(el)el.addEventListener('click',fn);};
  on('ofChoiceNext',()=>{
    if(ofState.setup==='custom'){ofState.cameFromOptions=true;ofGo('options');}
    else{ofState.cameFromOptions=false;ofApplyBranchSettings();ofGo('import');}
  });
  on('ofOptionsContinue',()=>{ofApplyOptions();ofGo('import');});
  /* #506 follow-up (user 2026-09-16): the Import button opens the real file
     picker immediately — the standalone import overlay paints above the flow
     (its z-index exceeds the flow's) and returns to the import screen when
     closed. No intent handoff needed anymore. */
  on('ofImportNow',()=>{
    ofState.imp='done';
    try{if(typeof openCsvImport==='function')openCsvImport();}catch(_){}
  });
  on('ofImportSkip',()=>{ofState.imp='skipped';ofGo('how');});
  on('ofHowContinue',()=>ofGo('done'));
  on('ofEnterApp',()=>finishOnboarding());
}
/* Shared Options-screen apply step (Continue and "Skip to the app" both run
   it so a skip from Options keeps the picked settings). */
function ofApplyOptions(){
  ofState.cameFromOptions=(ofState.setup==='custom');
  ofApplyBranchSettings();
}
/* Applies a segmented/pill choice: updates flow state and the group's pressed styles in place. */
function ofPick(btn){
  const name=btn.getAttribute('data-of-name');
  const val=btn.getAttribute('data-of-segval')||btn.getAttribute('data-of-pillval');
  if(!name||val==null)return;
  ofState[name]=val;
  const isSeg=btn.hasAttribute('data-of-segval');
  const group=btn.closest('[data-of-seg],[data-of-pills]');
  const selClass=isSeg?'of-seg-sel':'of-sel';
  if(group)group.querySelectorAll('button').forEach(b=>{b.classList.remove('of-seg-sel','of-sel');b.setAttribute('aria-pressed','false');});
  btn.classList.add(selClass);
  btn.setAttribute('aria-pressed','true');
}
/* iOS switch pattern (matches the mockup; not the app's press-pill switch —
   the flow is a self-contained full-screen takeover). */
function ofToggleSwitch(sw){
  const on=sw.classList.toggle('of-on');
  sw.setAttribute('aria-checked',String(on));
  ofState.prog=on?'on':'off';
}
/* ===== completion ===== */
/* #506 follow-up (user 2026-09-16): route back to an ordinary deep link after
   the flow completes — ordinary hashes no longer suppress onboarding, so the
   destination must survive the flow. Share links never reach this flow.
   Returns true when a deep link was consumed. */
function ofRouteDeepLink(){
  const id=ofState.routeHash||'';
  if(!id)return false;
  try{
    if(id==='library'){if(typeof showLibrary==='function')showLibrary(false);return true;}
    if(id==='workout'){if(typeof showWorkouts==='function')showWorkouts(false);return true;}
    if(id==='program'){
      try{if(typeof state!=='undefined'&&state&&typeof programSetupOpen==='function'){
        if(!state.activeProgram)programSetupOpen();
      }}catch(_){}
      if(typeof showProgram==='function')showProgram(false);
      try{if(typeof maybeOfferNewProgramForDeepLink==='function')maybeOfferNewProgramForDeepLink();}catch(_){}
      return true;
    }
    if(id==='stats'){if(typeof showStats==='function')showStats(false);return true;}
    if(id==='settings'){if(typeof showSettings==='function')showSettings(false);return true;}
    if(/^[a-zA-Z0-9_-]{3,}$/.test(id)&&typeof openExercise==='function'){
      try{openExercise(id,false);return true;}catch(_){return false;}
    }
  }catch(_){}
  return false;
}
/* Completes onboarding: stamps the done flag, hides the flow, and routes to the deep link or Home. */
function finishOnboarding(){
  try{localStorage.setItem(ONBOARDING_DONE_KEY,'1');}catch(_){}
  let flow=null;
  try{
    flow=document.getElementById('onboardingFlow');
    if(flow)flow.hidden=true;
    document.body.classList.remove('of-active');
  }catch(_){}
  /* #506 follow-up (user 2026-09-16): back to the pending deep link when one
     was captured; otherwise land on Home — the fresh profile shows the
     "Ready?" empty-state hero. */
  let routed=false;
  try{routed=ofRouteDeepLink();}catch(_){routed=false;}
  if(!routed){
    try{if(typeof showDashboard==='function')showDashboard(false);}catch(_){}
  }
}
/* #537 (2026-09-17): a wipe (delete-all) returns
   the profile to fresh, so the first-run gate must reset with it — otherwise
   the onboarding flow never resurfaces on the wiped profile. Called from
   wipeLocalUserData() (persistence.js, guarded); kept here with the key. */
function clearOnboardingDone(){
  try{localStorage.removeItem(ONBOARDING_DONE_KEY);}catch(_){}
}
/* ===== QA-only replay trigger (#506, user 2026-09-16) ===== */
/* "Replay onboarding" button for testing the first-run flow. The old
   prod-host allowlist (kohlrabi.us etc.) is gone — this build has no
   prod/beta distinction, so the row shows whenever the markup has it. */
function wireOnboardingReplay(){
  let btn=null,row=null;
  try{
    btn=document.getElementById('replayOnboardingButton');
    row=document.getElementById('qaOnboardingRow');
  }catch(_){return;}
  if(!btn||!row)return;
  try{row.hidden=false;}catch(_){}
  btn.addEventListener('click',()=>{
    clearOnboardingDone();
    startOnboardingFlow();
  });
}
