'use strict';
/* #506 (v1.8): onboarding flow v2 — first-run gating, branch logic, optional
   sign-in, the import-intent handoff, and the Done summary. Role loads
   state + utilities + onboarding only (programs.js / persistence.js /
   sync-auth / csv-import are absent, so the guarded fallbacks run — the
   settings assertions exercise them).

   #506 follow-up (user 2026-09-16): deep links no longer suppress the flow
   (the destination is remembered and routed back to), the marketing opt-in
   moved to the sign-in CODE step and writes ONLY the Marketing newsletter
   pref (#511, user 2026-09-17: it renders only when signed in), every screen has a primary action + "Skip to the app", the
   how-it-works cards are tappable detail cards, import is "Skip for now"
   (primary green, continues the flow) + white "Import workouts" (opens the
   real picker at once) + quiet "Skip to the app" (exits the flow), the done
   screen carries the logo + bold app name,
   the welcome screen is vertically centered with a white "Take me to the
   app" button, and a brand-new post-boot sign-up gets its own entry
   point. */
const {describe,it,beforeEach,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const role=loadRole('onboarding-506');
const {
  shouldShowOnboarding,ofSummaryRows,ofAccountLabel,ofScreenHtml,ofApplyBranchSettings,
  ofApplyOptions,ofApplyRepRange,ofClampDays,ofResolveBack,ofPick,
  ofToggleHow,ofRouteDeepLink,
  finishOnboarding,ONBOARDING_DONE_KEY,ONBOARDING_GUIDE_URL,ofState,
  ofResetState,ofWire,progressionSetup,DEFAULT_PROGRESSION_SETUP,
  normalizeProgression,resetProgressionSetup,
  state,
}=role;

beforeEach(()=>{
  globalThis.localStorage.clear();
  ofResetState();
  resetProgressionSetup();
});

/* Fresh-profile gate: the flow shows when there is no persisted state, no
   session, and no share/auth-callback boot. Ordinary deep links no longer
   suppress it (#506 follow-up) — the destination survives the flow. */
describe('#506 first-run gate (shouldShowOnboarding)',()=>{
  const fresh=()=>({done:false,shareBoot:false,authCallback:false,routeHash:'',hasLocalData:false,hasSession:false});
  it('shows on a fresh profile',()=>{assert.equal(shouldShowOnboarding(fresh()),true);});
  it('hides once the completion marker is set',()=>{assert.equal(shouldShowOnboarding({...fresh(),done:true}),false);});
  it('hides when a share landing owns the boot',()=>{assert.equal(shouldShowOnboarding({...fresh(),shareBoot:true}),false);});
  /* Public fork: no auth callbacks or sessions — a fresh local profile
     always gets the flow. */
  it('shows for a fresh profile with no account concepts',()=>{assert.equal(shouldShowOnboarding(fresh()),true);});
  it('shows on an ordinary hash deep link (no longer suppressed)',()=>{assert.equal(shouldShowOnboarding({...fresh(),routeHash:'#stats'}),true);});
  it('hides when persisted data exists (existing profile)',()=>{assert.equal(shouldShowOnboarding({...fresh(),hasLocalData:true}),false);});
  it('hides when inputs are missing',()=>{assert.equal(shouldShowOnboarding(null),false);assert.equal(shouldShowOnboarding(undefined),false);});
  it('finishOnboarding sets the completion marker so the gate never reopens',()=>{
    assert.equal(globalThis.localStorage.getItem(ONBOARDING_DONE_KEY),null);
    finishOnboarding();
    assert.equal(globalThis.localStorage.getItem(ONBOARDING_DONE_KEY),'1');
    assert.equal(shouldShowOnboarding({...fresh(),done:true}),false);
  });
});

/* Branch logic: defaults resets to canonical defaults; custom maps answers. */
describe('#506 branch settings (ofApplyBranchSettings)',()=>{
  it('defaults branch resets a dirty setup to canonical defaults',()=>{
    progressionSetup.threshold=9;
    progressionSetup.units='metric';
    progressionSetup.trainingDays=6;
    ofState.setup='defaults';
    ofApplyBranchSettings();
    const p=progressionSetup;
    assert.equal(p.threshold,8,'RPE threshold');
    assert.equal(p.units,'imperial','units');
    assert.equal(p.defaultRange.preset,'hypertrophy','default rep range preset');
    assert.equal(p.trainingDays,3,'days/week');
    assert.equal(p.progressionOff,false,'progression suggestions on');
  });
  it('custom branch maps units / RPE / rep preset / days / suggestion toggle',()=>{
    ofState.setup='custom';
    ofState.units='kg';ofState.rpe='7';ofState.reps='strength';ofState.days='5';ofState.prog='off';
    ofApplyBranchSettings();
    const p=progressionSetup;
    assert.equal(p.units,'metric','kg → metric');
    assert.equal(p.threshold,7,'RPE 7 → threshold 7');
    assert.equal(p.defaultRange.preset,'strength','strength preset');
    assert.equal(p.defaultRange.min,1,'strength min');
    assert.equal(p.defaultRange.max,5,'strength max');
    assert.equal(p.trainingDays,5,'days/week 5');
    assert.equal(p.progressionOff,true,'suggestions off');
  });
  it('custom branch leaves suggestions on when the toggle is on',()=>{
    ofState.setup='custom';
    ofState.units='lb';ofState.rpe='9';ofState.reps='endurance';ofState.days='2';ofState.prog='on';
    ofApplyBranchSettings();
    const p=progressionSetup;
    assert.equal(p.units,'imperial');
    assert.equal(p.threshold,9);
    assert.equal(p.defaultRange.preset,'endurance');
    assert.equal(p.trainingDays,2);
    assert.equal(p.progressionOff,false);
  });
  it('custom branch coerces invalid answers to defaults',()=>{
    ofState.setup='custom';
    ofState.units='stones';ofState.rpe='x';ofState.reps='bogus';ofState.days='abc';ofState.prog='maybe';
    ofApplyBranchSettings();
    const p=progressionSetup;
    assert.equal(p.units,'imperial');
    assert.equal(p.threshold,8);
    assert.equal(p.defaultRange.preset,'hypertrophy');
    assert.equal(p.trainingDays,3);
    assert.equal(p.progressionOff,true,'non-on toggle means off');
  });
  it('ofApplyOptions preserves the Options-screen picks on a skip-from-Options',()=>{
    ofState.setup='custom';
    ofState.units='kg';ofState.rpe='7';ofState.reps='strength';ofState.days='5';ofState.prog='off';
    ofApplyOptions();
    assert.equal(progressionSetup.units,'metric','custom settings applied');
    assert.equal(progressionSetup.trainingDays,5);
    assert.equal(ofState.cameFromOptions,true,'cameFromOptions latched');
  });
  it('ofClampDays bounds days/week to 1..7 with a 3 default',()=>{
    assert.equal(ofClampDays('5'),5);
    assert.equal(ofClampDays('9'),7);
    assert.equal(ofClampDays('0'),3);
    assert.equal(ofClampDays('abc'),3);
    assert.equal(ofClampDays(null),3);
  });
  it('ofApplyRepRange falls back to hypertrophy on an unknown key',()=>{
    ofApplyRepRange('bogus');
    assert.equal(progressionSetup.defaultRange.preset,'hypertrophy');
  });
  it('trainingDays lives in the canonical defaults and normalizes legacy blobs',()=>{
    assert.equal(DEFAULT_PROGRESSION_SETUP.trainingDays,3);
    assert.equal(normalizeProgression({}).trainingDays,3,'missing → 3');
    assert.equal(normalizeProgression({trainingDays:9}).trainingDays,7,'clamped to 7');
    assert.equal(normalizeProgression({trainingDays:0}).trainingDays,3,'0 → 3');
    assert.equal(normalizeProgression({trainingDays:'abc'}).trainingDays,3,'junk → 3');
    assert.equal(normalizeProgression({trainingDays:5}).trainingDays,5,'valid stays');
  });
});

/* Done summary reflects the branch taken. */
describe('#506 done summary (ofSummaryRows)',()=>{
  const txt=()=>ofSummaryRows().map(r=>r[0]+': '+r[1]).join('\n');
  it('defaults branch + skipped import — no Setup row (the card IS the setup)',()=>{
    const s=txt();
    assert.ok(!s.includes('Setup:'),'Setup row must be gone');
    assert.ok(s.includes('Units: Imperial'));
    assert.ok(s.includes('RPE threshold: 8'));
    assert.ok(s.includes('Rep range: 6–12'));
    assert.ok(!s.includes('Days per week:'),'done summary should not include a Days per week row');
    assert.ok(s.includes('Suggestions: On'));
    assert.ok(s.includes('Import: Skipped'));
    assert.ok(s.includes('Account: Local only'));
  });
  it('custom branch + started import',()=>{
    ofState.setup='custom';ofState.units='kg';ofState.rpe='9';ofState.reps='strength';
    ofState.days='4';ofState.prog='on';ofState.imp='done';
    const s=txt();
    assert.ok(!s.includes('Setup:'),'Setup row must be gone');
    assert.ok(s.includes('Units: Metric'));
    assert.ok(s.includes('RPE threshold: 9'));
    assert.ok(s.includes('Rep range: 1–5'));
    assert.ok(!s.includes('Days per week:'),'done summary should not include a Days per week row');
    assert.ok(s.includes('Suggestions: On'));
    /* #516: the done summary reads "Import: Started", not "Opened". */
    assert.ok(s.includes('Import: Started'));
  });
  it('suggestions-off renders',()=>{
    ofState.prog='off';
    assert.ok(txt().includes('Suggestions: Off'));
  });
});

/* Done-screen account row (user 2026-09-16): the email when there is an
   account, "Local only" otherwise. Prefers the email captured by the
   in-flow sign-in, falls back to the live auth identity. */
describe('#506 done summary account row (ofAccountLabel)',()=>{
  it('reads Local only (public fork: the label is constant — no accounts)',()=>{
    assert.equal(ofAccountLabel(),'Local only');
  });
});

/* Done screen (user 2026-09-16): no illustration at all — the logo mark
   plus the app name already carry it. The exclamation mark is gone. */
describe('#506 done screen carries no illustration',()=>{
  it('shows no checkmark and no exclamation mark illustration',()=>{
    const html=ofScreenHtml('done');
    assert.ok(!html.includes('of-illus'),'illustration container remains');
    assert.ok(!html.includes('M34 53.5l12.5 12.5L70 41'),'old checkmark remains');
    assert.ok(!html.includes('M52 32v30'),'exclamation stem remains');
  });
});

/* The Import button opens the real importer AT ONCE (user call 2026-09-16):
   the standalone import overlay paints above the flow and returns to the
   import screen when closed — no intent handoff, nothing opens at finish. */
describe('#506 import button opens the picker immediately',()=>{
  const realGet=globalThis.document.getElementById;
  afterEach(()=>{globalThis.document.getElementById=realGet;});
  function wiredClicks(){
    const clicks={};
    const el=(id)=>({addEventListener:(ev,fn)=>{clicks[id+':'+ev]=fn;}});
    const body={innerHTML:'',scrollTop:0,onclick:null,
      querySelector:(sel)=>{
        if(sel==='#ofMarketingOptIn')return el('ofMarketingOptIn');
        const m=/^#(.+)$/.exec(sel);
        return m?el(m[1]):null;
      }};
    globalThis.document.getElementById=(id)=>id==='ofBody'?body:null;
    ofWire();
    return clicks;
  }
  it('tapping Import workouts opens the file picker and records the import',()=>{
    let opened=false;
    globalThis.openCsvImport=()=>{opened=true;};
    try{
      const clicks=wiredClicks();
      assert.ok(clicks['ofImportNow:click'],'import handler not wired');
      clicks['ofImportNow:click']();
      assert.equal(opened,true,'file picker not opened');
      assert.equal(ofState.imp,'done','import not recorded');
    }finally{delete globalThis.openCsvImport;}
  });
  it('finishOnboarding never opens the importer anymore',()=>{
    let opened=false;
    globalThis.openCsvImport=()=>{opened=true;};
    try{
      ofState.imp='done';finishOnboarding();
      assert.equal(opened,false,'importer opened at finish (done)');
      ofState.imp='skipped';finishOnboarding();
      assert.equal(opened,false,'importer opened at finish (skipped)');
    }finally{delete globalThis.openCsvImport;}
  });
});

/* Public fork: the #511 marketing opt-in and its subscription prefs are
   gone with email — onboarding has no subscription UI. */

/* Deep-link return: the remembered hash routes after the flow completes. */
describe('#506 deep-link return (ofRouteDeepLink)',()=>{
  const navFns=['showLibrary','showWorkouts','showProgram','showStats','showSettings','openExercise'];
  afterEach(()=>{for(const k of navFns)delete globalThis[k];});
  it('returns false with no pending deep link',()=>{
    ofState.routeHash='';
    assert.equal(ofRouteDeepLink(),false);
  });
  it('routes tab deep links to the matching tab',()=>{
    const calls=[];
    globalThis.showLibrary=(a)=>calls.push(['library',a]);
    globalThis.showStats=(a)=>calls.push(['stats',a]);
    ofState.routeHash='library';assert.equal(ofRouteDeepLink(),true);
    ofState.routeHash='stats';assert.equal(ofRouteDeepLink(),true);
    assert.deepEqual(calls,[['library',false],['stats',false]]);
  });
  it('routes an exercise id to openExercise',()=>{
    let got=null;
    globalThis.openExercise=(id,a)=>{got=[id,a];};
    ofState.routeHash='abc123';
    assert.equal(ofRouteDeepLink(),true);
    assert.deepEqual(got,['abc123',false]);
  });
  it('returns false for an unknown hash with no matching handler',()=>{
    ofState.routeHash='xyz';
    assert.equal(ofRouteDeepLink(),false);
  });
  it('finishOnboarding routes back to the pending deep link',()=>{
    let shown=null;
    globalThis.showStats=(a)=>{shown=a;};
    try{
      ofState.routeHash='stats';
      finishOnboarding();
      assert.equal(shown,false,'did not route to the deep link');
    }finally{delete globalThis.showStats;}
  });
});

/* Screens: short branching flow, correct back targets, no experience/goal
   questions, sign-in optional, skip affordance on every screen. */
describe('#506 flow screens (ofScreenHtml)',()=>{
  /* Public fork: the signin screen is gone — no accounts, no OTP, no
     marketing opt-in. */
  const screens=['welcome','choice','options','import','how','done'];
  it('every screen carries the Kohlrabi brand',()=>{
    for(const s of screens)assert.ok(ofScreenHtml(s).includes('Kohlrabi'),`${s} missing brand`);
  });
  it('unknown screens fall back to welcome',()=>{
    assert.ok(ofScreenHtml('nope').includes('Get started'),'fallback missing');
  });
  it('welcome is vertically centered with a white "Take me to the app" button',()=>{
    const html=ofScreenHtml('welcome');
    assert.ok(html.includes('of-vcenter'),'welcome not vertically centered');
    assert.ok(!html.includes('of-welcomespace'),'old fixed-gap spacer remains');
    assert.ok(html.includes('class="of-cta" type="button" data-of-go="choice">Get started</button>'),'Get started not primary / does not route to choice');
    assert.ok(html.includes('class="of-cta of-secondary" type="button" data-of-skip>Take me to the app</button>'),'Take me to the app missing/not white secondary');
    assert.ok(!html.includes('I already have an account'),'account link not removed');
    assert.ok(!html.includes('sign in'),'sign-in copy remains');
    assert.ok(html.indexOf('Get started')<html.indexOf('Take me to the app'),'button order wrong');
  });
  it('no signin screen exists',()=>{
    /* 'signin' is no longer a case — it falls through to welcome. */
    assert.ok(!ofScreenHtml('signin').includes('Want to sign in?'),'signin copy still renders');
    assert.ok(!ofScreenHtml('signin').includes('ofCodeInput'),'code step still renders');
  });
  it('every screen has a primary Next/continue action and a "Skip to the app" affordance',()=>{
    assert.ok(ofScreenHtml('welcome').includes('Get started'),'welcome missing primary');
    assert.ok(ofScreenHtml('choice').includes('id="ofChoiceNext"'),'choice missing primary');
    assert.ok(ofScreenHtml('options').includes('id="ofOptionsContinue"'),'options missing primary');
    /* import: "Skip for now" is the primary green action (user call) — it
       continues the flow past import; "Skip to the app" is the quiet link
       that exits onboarding entirely. */
    assert.ok(ofScreenHtml('import').includes('<button class="of-cta" type="button" id="ofImportSkip">Skip for now</button>'),'import missing primary skip-for-now');
    assert.ok(ofScreenHtml('how').includes('id="ofHowContinue"'),'how missing primary');
    assert.ok(ofScreenHtml('done').includes('id="ofEnterApp"'),'done missing primary');
    for(const s of ['choice','options','import','how']){
      const html=ofScreenHtml(s);
      assert.ok(html.includes('data-of-skip'),`${s} missing skip-to-app`);
      assert.ok(html.includes('Skip to the app'),`${s} missing skip copy`);
    }
  });
  it('back chevrons point at real screens',()=>{
    assert.ok(ofScreenHtml('choice').includes('data-of-back="welcome"'),'choice back');
    assert.ok(ofScreenHtml('options').includes('data-of-back="choice"'),'options back');
    ofState.cameFromOptions=false;
    assert.ok(ofScreenHtml('import').includes('data-of-back="choice"'),'import back (defaults branch)');
    ofState.cameFromOptions=true;
    assert.ok(ofScreenHtml('import').includes('data-of-back="options"'),'import back (custom branch)');
    assert.ok(ofScreenHtml('how').includes('data-of-back="import"'),'how back');
    assert.equal(ofResolveBack('choice'),'choice','back targets pass through');
    assert.equal(ofResolveBack('import'),'import','back targets pass through');
  });
  it('choice offers selectable cards plus a primary Next button',()=>{
    const html=ofScreenHtml('choice');
    assert.ok(html.includes('Give me the defaults'),'missing defaults card');
    assert.ok(html.includes('Recommended'),'missing Recommended tag');
    assert.ok(html.includes('I want more options'),'missing custom card');
    assert.ok(html.includes('data-of-setup="defaults"'),'defaults card not selectable');
    assert.ok(html.includes('data-of-setup="custom"'),'custom card not selectable');
    assert.ok(html.includes('id="ofChoiceNext"'),'missing Next');
    assert.ok(!html.includes('ofChooseDefaults'),'old immediate-nav id remains');
  });
  it('choice defaults to the recommended card selected',()=>{
    const html=ofScreenHtml('choice');
    assert.ok(html.includes('data-of-setup="defaults" aria-pressed="true"'),'defaults not pre-selected');
  });
  it('options covers units, RPE, rep range, days/week, and the suggestion toggle',()=>{
    const html=ofScreenHtml('options');
    for(const s of ['Units','RPE threshold','Rep range','Days per week','Progression suggestions'])
      assert.ok(html.includes(s),`missing ${s}`);
  });
  it('import: skip-for-now is primary green, Import is the white secondary, skip-to-app is quiet',()=>{
    const html=ofScreenHtml('import');
    assert.ok(html.includes('<button class="of-cta" type="button" id="ofImportSkip">Skip for now</button>'),'skip-for-now not the primary green action');
    assert.ok(html.includes('class="of-cta of-secondary" type="button" id="ofImportNow"'),'Import not the white secondary button');
    assert.ok(html.includes('Hevy exports'),'missing Hevy');
    assert.ok(html.includes('MacroFactor'),'missing MacroFactor');
    assert.ok(html.includes('CSV files'),'missing CSV');
    assert.ok(html.includes('.json'),'missing JSON backup');
    assert.ok(html.includes('<button class="of-quiet" type="button" data-of-skip>Skip to the app</button>'),'skip-to-app not the quiet link');
    assert.ok(html.indexOf('Skip for now')<html.indexOf('ofImportNow'),'primary skip-for-now not first');
    assert.ok(!html.includes('data-of-import'),'old selectable source rows remain');
    assert.ok(!html.includes('csv-import'),'import engine inlined');
  });
  it('how-it-works is three tappable cards with hidden details and the guide link at the bottom',()=>{
    const html=ofScreenHtml('how');
    assert.equal((html.match(/data-of-how="/g)||[]).length,3,'not three tappable cards');
    assert.equal((html.match(/data-of-howdetail="/g)||[]).length,3,'not three detail cards');
    assert.ok(html.includes('data-of-howdetail="log" hidden'),'log detail not hidden');
    assert.ok(!html.includes('Three ideas. Tap a card for details.'),'how-it-works subtitle should be gone');
    assert.ok(html.includes(ONBOARDING_GUIDE_URL),'missing guide URL');
    assert.ok(html.indexOf('ofHowContinue')<html.indexOf(ONBOARDING_GUIDE_URL),'guide link not below the primary action');
  });
  it('done has the logo mark and bold app name at the top, plus the summary',()=>{
    const html=ofScreenHtml('done');
    assert.ok(html.includes('class="of-logo of-logo-sm"'),'missing logo mark');
    assert.ok(html.includes('<div class="of-brand">Kohlrabi</div>'),'missing bold app name');
    assert.ok(!html.includes('You&rsquo;re ready to lift'),'done heading should be gone');
    assert.ok(html.includes('Enter the app'),'missing Enter the app');
    assert.ok(html.includes(ONBOARDING_GUIDE_URL),'missing guide URL');
    assert.ok(html.includes('of-sumcard'),'missing summary card');
  });
  it('no experience/goal questions anywhere in the flow',()=>{
    const all=screens.map(ofScreenHtml).join('\n');
    for(const re of [/fitness goal/i,/experience level/i,/what's your (main )?goal/i,/how long have you been (training|lifting)/i])
      assert.ok(!re.test(all),`found dropped question pattern: ${re}`);
  });
  /* #514: RPE threshold and AMRAP are defined in plain language on the
     options screen — a beginner never has to guess. */
  it('#514 options screen defines RPE threshold and AMRAP',()=>{
    const html=ofScreenHtml('options');
    assert.ok(html.includes('How hard your top sets should feel'),'missing RPE sublabel');
    assert.ok(html.includes('as many reps as possible'),'missing AMRAP definition');
  });
  /* #515: the how-it-works detail cards define RPE and 1RM on first use. */
  it('#515 how-it-works details define RPE and 1RM',()=>{
    const html=ofScreenHtml('how');
    assert.ok(html.includes('rate of perceived exertion'),'log detail does not define RPE');
    assert.ok(html.includes('one-rep max'),'charts detail does not define 1RM');
  });
});

/* Tappable "How it works" cards: one open at a time, tapping the open card
   closes it. The stub document can't render, so a minimal fake flow element
   carries the detail/button nodes. */
describe('#506 tappable how-it-works cards (ofToggleHow)',()=>{
  const realGet=globalThis.document.getElementById;
  afterEach(()=>{globalThis.document.getElementById=realGet;});
  function howDom(){
    const detailState={log:true,suggest:true,charts:true};
    const expanded={log:'false',suggest:'false',charts:'false'};
    const detailEls=Object.keys(detailState).map(k=>({
      getAttribute:(a)=>a==='data-of-howdetail'?k:null,
      set hidden(v){detailState[k]=v;},
      get hidden(){return detailState[k];},
    }));
    const btnEls=Object.keys(expanded).map(k=>({
      getAttribute:(a)=>a==='data-of-how'?k:null,
      setAttribute:(a,v)=>{if(a==='aria-expanded')expanded[k]=v;},
    }));
    const flow={querySelectorAll:(sel)=>{
      if(sel==='[data-of-howdetail]')return detailEls;
      if(sel==='[data-of-how]')return btnEls;
      return [];
    }};
    return {detailState,expanded,flow};
  }
  it('opens the tapped card and marks it expanded',()=>{
    const dom=howDom();
    globalThis.document.getElementById=(id)=>id==='onboardingFlow'?dom.flow:null;
    ofToggleHow('log');
    assert.equal(dom.detailState.log,false,'log detail not opened');
    assert.equal(dom.detailState.suggest,true,'suggest detail opened too');
    assert.equal(dom.detailState.charts,true,'charts detail opened too');
    assert.equal(dom.expanded.log,'true','button not marked expanded');
  });
  it('tapping the open card closes it',()=>{
    const dom=howDom();
    globalThis.document.getElementById=(id)=>id==='onboardingFlow'?dom.flow:null;
    ofToggleHow('suggest');
    ofToggleHow('suggest');
    assert.equal(dom.detailState.suggest,true,'detail stayed open');
    assert.equal(dom.expanded.suggest,'false','button stayed expanded');
  });
  it('only one card stays open at a time',()=>{
    const dom=howDom();
    globalThis.document.getElementById=(id)=>id==='onboardingFlow'?dom.flow:null;
    ofToggleHow('log');
    ofToggleHow('charts');
    assert.equal(dom.detailState.log,true,'first card stayed open');
    assert.equal(dom.detailState.charts,false,'second card not opened');
    assert.equal(dom.expanded.log,'false');
    assert.equal(dom.expanded.charts,'true');
  });
  it('no-ops when the flow element is absent',()=>{
    globalThis.document.getElementById=()=>null;
    assert.doesNotThrow(()=>ofToggleHow('log'));
  });
});

/* Public fork: post-sign-up onboarding is gone with accounts — there is no
   sign-in screen and no brand-new account created after boot. */

/* ofPick clears sibling selections within the seg/pills group (the group
   wrappers carry data-of-seg / data-of-pills). */
describe('#506 option single-select (ofPick)',()=>{
  function fakeGroup(){const btns=[];return{btns,querySelectorAll:()=>btns};}
  function fakeBtn(group,name,val,isSeg){
    const classes=new Set();
    const btn={
      getAttribute:(a)=>{
        if(a==='data-of-name')return name;
        if(a==='data-of-segval')return isSeg?val:null;
        if(a==='data-of-pillval')return isSeg?null:val;
        return null;
      },
      hasAttribute:(a)=>a==='data-of-segval'&&isSeg,
      closest:(sel)=>sel==='[data-of-seg],[data-of-pills]'?group:null,
      classList:{add:(c)=>classes.add(c),remove:(...cs)=>cs.forEach(c=>classes.delete(c)),contains:(c)=>classes.has(c)},
      setAttribute(){},
    };
    group.btns.push(btn);
    return btn;
  }
  it('selecting a pill clears the other pill in the group',()=>{
    const group=fakeGroup();
    const b7=fakeBtn(group,'rpe','7',false);
    const b8=fakeBtn(group,'rpe','8',false);
    ofState.rpe='8';b8.classList.add('of-sel');
    ofPick(b7);
    assert.equal(ofState.rpe,'7','state not updated');
    assert.ok(b7.classList.contains('of-sel'),'picked pill not marked');
    assert.ok(!b8.classList.contains('of-sel'),'old pill still marked');
  });
  it('selecting a seg option clears the other seg option',()=>{
    const group=fakeGroup();
    const blb=fakeBtn(group,'units','lb',true);
    const bkg=fakeBtn(group,'units','kg',true);
    ofState.units='lb';blb.classList.add('of-seg-sel');
    ofPick(bkg);
    assert.equal(ofState.units,'kg','state not updated');
    assert.ok(bkg.classList.contains('of-seg-sel'),'picked seg not marked');
    assert.ok(!blb.classList.contains('of-seg-sel'),'old seg still marked');
  });
});
