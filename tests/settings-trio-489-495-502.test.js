'use strict';
/* Settings trio: #502 (Settings reorganization), #489 (default number of
   sets), #495 (hide the dumbbell total-weight option). The Settings UI and
   its logic live in index.html + assets/js/core/app-bootstrap.js (there is no
   settings.js — see the historical note at the top of app-bootstrap.js). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadRole}=require('./harness');

const ROOT=path.resolve(__dirname,'..');
const src=(p)=>fs.readFileSync(path.join(ROOT,p),'utf8');
const html=src('index.html');
const bootstrap=src('assets/js/core/app-bootstrap.js');
const builder=src('assets/js/workout/workout-builder.js');
const utilities=src('assets/js/lib/utilities.js');

/* Extract one top-level `function name(...) { ... }` from a source string
   with a balanced-brace scan (regex can't count braces). */
function extractFunction(source,name){
  const start=source.indexOf('function '+name+'(');
  assert.ok(start>=0,`function ${name} defined`);
  const open=source.indexOf('{',start);
  let depth=0;
  for(let i=open;i<source.length;i++){
    if(source[i]==='{')depth++;
    else if(source[i]==='}'){depth--;if(depth===0)return source.slice(start,i+1);}
  }
  throw new Error(`unbalanced braces in ${name}`);
}

/* #502: Settings section order — Account, Appearance, Units, Progression
   defaults, Defaults, Warm-up sets, Data, Marketing, About (attributions
   merged in). The Marketing card (user 2026-09-17, #532) holds the
   privacy/subscription controls, collapsed by default. */
function settingsHeadings(){
  const sv=html.slice(html.indexOf('<section id="settingsView"'),html.indexOf('<article id="detailView"'));
  return [...sv.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map(m=>m[1]);
}

describe('#502 Settings is reorganized into clear groups',()=>{
  it('sections read in the new order (public fork: no Account/Marketing)',()=>{
    assert.deepEqual(settingsHeadings(),
      ['Appearance','Display','Units','Exercise defaults','Progression','Data','About'],
      'section order');
  });
  it('Attributions lives inside the About card, not as its own card',()=>{
    assert.ok(!settingsHeadings().includes('Attributions'),'no standalone Attributions card');
    const sv=html.slice(html.indexOf('<section id="settingsView"'),html.indexOf('<article id="detailView"'));
    const aboutAt=sv.indexOf('<h2>About</h2>');
    const attrAt=sv.indexOf('class="attribution-list"');
    assert.ok(attrAt>aboutAt,'attribution list sits after the About heading');
  });
  it('every pre-existing settings control id is still present',()=>{
    /* QA batch 2026-09-22: allSetsToggle is retired (per-set targets are the
       only path); autoDeload controls were removed in the same batch.
       v1.883 (user 2026-09-22): the global RPE trigger default is BACK in
       Settings (#settingsRpePills, RPE-mode only) alongside the per-exercise
       pills under Exercise options — the global default was dropped by
       accident during the %1RM rework and the user asked for it restored. */
    for(const id of ['darkModeToggle','swipeDeleteSetsToggle','themePills',
      'progressionOffToggle','settingsSchemePills','settingsRpePills',
      'settingsIncrementType','settingsIncrementValue','settingsRepMin','settingsRepMax',
      'settingsTimeStepPills','settingsCyclePills','settingsPctWaveDefaultToggle',
      'settingsWarmupRungs','settingsWarmupPct0','settingsUnitPills','settingsDbEntryPills',
      'settingsStatsDefaultPills','settingsProgramMusclePills','appVersionLine',
      'checkUpdatesButton','buildUpdatedLine','exportDataButton','importCsvButton',
      'deleteAllDataButton']){
      assert.ok(html.includes(`id="${id}"`),`#${id} present`);
    }
    /* Public fork: account controls are gone with accounts. */
    for(const id of ['signinNudgeToggle','accountEmail','sendMagicLinkButton',
      'accountSignedIn','backupNudgeLine','subAppUpdates','subMarketing','subTips']){
      assert.ok(!html.includes(`id="${id}"`),`#${id} still present`);
    }
    assert.ok(!html.includes('id="allSetsToggle"'),'retired allSetsToggle is gone');
  });
  it('no duplicate ids in the settings view',()=>{
    const sv=html.slice(html.indexOf('<section id="settingsView"'),html.indexOf('<article id="detailView"'));
    const ids=[...sv.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(new Set(ids).size,ids.length,'ids unique');
  });
});

/* #489: default number of sets for newly added exercises. */
describe('#489 default number of sets',()=>{
  const fnSrc=extractFunction(bootstrap,'defaultSetCount');
  const run=(stored)=>{
    const sandbox={progressionSetup:{defaultSetCount:stored}};
    vm.runInNewContext(fnSrc+';this.__out=defaultSetCount();',sandbox);
    return sandbox.__out;
  };
  it('falls back to the old hardcoded 3 when the setting was never saved',()=>{
    assert.equal(run(undefined),3,'undefined -> 3');
    assert.equal(run(null),3,'null -> 3');
  });
  it('returns the saved value untouched inside the range',()=>{
    assert.equal(run(1),1);
    assert.equal(run(5),5);
    assert.equal(run(10),10);
  });
  it('clamps to 1..10',()=>{
    assert.equal(run(0),3,'0 is invalid -> default 3');
    assert.equal(run(-4),1,'negative -> 1');
    assert.equal(run(11),10,'11 -> 10');
    assert.equal(run(99),10,'99 -> 10');
  });
  it('rounds fractional values',()=>{
    assert.equal(run(4.6),5);
  });
  it('both picker call sites use the setting, not a hardcoded count',()=>{
    assert.equal((builder.match(/Array\.from\(\{length:defaultSetCount\(\)\},/g)||[]).length,2,
      'template editor + live draft pickers both call defaultSetCount()');
    assert.ok(!builder.includes('Array.from({length:3}'),'no hardcoded length:3 left in the builder');
  });
  it('the Settings markup carries the number input (1–10)',()=>{
    assert.ok(html.includes('id="settingsDefaultSetCount"'),'#settingsDefaultSetCount present');
    const tag=html.match(/<input[^>]*id="settingsDefaultSetCount"[^>]*>/)[0];
    assert.ok(tag.includes('min="1"')&&tag.includes('max="10"'),'min=1 max=10');
    assert.ok(html.includes('<h2>Exercise defaults</h2>'),'lives in the Exercise defaults section');
  });
  it('the input is wired to the progressionSetup blob',()=>{
    assert.ok(bootstrap.includes("$('#settingsDefaultSetCount')"),'input wired');
    assert.ok(bootstrap.includes('progressionSetup.defaultSetCount='),'persists to progressionSetup');
  });
  it('renderSettings syncs the input from the setting',()=>{
    assert.ok(bootstrap.includes("$('#settingsDefaultSetCount'); if(defSets)defSets.value=defaultSetCount();"),
      'renderSettings writes the clamped value');
  });
});

/* #495: hide the dumbbell total-weight option. */
describe('#495 hide the dumbbell total-weight option',()=>{
  it('the Settings markup carries the toggle in the Defaults section',()=>{
    assert.ok(html.includes('id="hideDbTotalToggle"'),'#hideDbTotalToggle present');
    const sv=html.slice(html.indexOf('<section id="settingsView"'),html.indexOf('<article id="detailView"'));
    const defAt=sv.indexOf('<h2>Defaults</h2>');
    const togAt=sv.indexOf('id="hideDbTotalToggle"');
    assert.ok(togAt>defAt,'toggle sits inside the Defaults card');
  });
  it('the toggle persists to the progressionSetup blob and clears stale total overrides',()=>{
    assert.ok(bootstrap.includes('progressionSetup.hideDbTotal='),'persists the flag');
    assert.ok(bootstrap.includes("progressionSetup.dbEntryPrefs[k]==='total'"),'drops stored total overrides when hiding');
    assert.ok(bootstrap.includes("it.progression.dbEntry==='total'"),'drops live draft total overrides when hiding');
  });
  it('the per-exercise toggle render is guarded by the flag',()=>{
    assert.ok(utilities.includes('dbTotalHidden'),'guard variable present');
    assert.ok(utilities.includes("progressionSetup.hideDbTotal"),'guard reads the setting');
  });
  it('toggle renders when visible, vanishes when hidden (live render)',()=>{
    const role=loadRole('utilities',{globals:{
      exercises:[{id:'db-press',name:'DB Press',equipment:'dumbbell'}],
      getExerciseLogs:()=>[]
    }});
    const {progressionSummaryForOptions,progressionSetup,dbEntryMode}=role;
    assert.ok(!progressionSetup.hideDbTotal,'visible by default — the flag is falsy until the user opts in');
    const item={uid:'x1',exerciseId:'db-press',tracking:'reps',
      progression:{mode:'reps',min:6,max:12}};
    const shown=progressionSummaryForOptions(item);
    assert.ok(shown.includes('prog-db-entry-row'),'toggle row renders by default');
    assert.ok(shown.includes('data-db-entry-mode="total"'),'Total option present by default');
    progressionSetup.hideDbTotal=true;
    const hidden=progressionSummaryForOptions(item);
    assert.ok(!hidden.includes('prog-db-entry-row'),'toggle row gone when hidden');
    assert.equal(dbEntryMode('db-press',item),'per','entry falls back to per-dumbbell');
  });
});
