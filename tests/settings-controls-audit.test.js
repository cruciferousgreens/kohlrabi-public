'use strict';
/* v1.883 item 22 (user 2026-09-22): full Settings audit. Every persisted
   setting in DEFAULT_PROGRESSION_SETUP must have a rendered control in
   index.html (or a documented exception), and every item on the user's
   expected-settings list must render. The RPE trigger (#21) was the only
   genuine regression found; this file pins the rest so future reworks
   cannot silently drop a control again.
   Exceptions (persisted but intentionally UI-less, documented here):
   - treatment: dead key — written by long-gone wiring, never read anywhere.
   - deloadPct: fallback constant (60) sizing per-week deload flags; the
     wave rows carry the boolean flags, intensity is not user-settable.
   - dbEntryPrefs / singleDbPrefs: per-exercise prefs, not Settings-level.
   - trainingDays: onboarding-only (#506), asked at first run. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');

function hasId(id){return html.includes(`id="${id}"`);}

/* persisted key → control id(s) that must exist in the markup. */
const KEY_TO_CONTROLS={
  threshold:['settingsRpePills'],
  incrementType:['settingsIncrementType'],
  incrementValue:['settingsIncrementValue'],
  timeStep:['settingsTimeStepPills'],
  scheme:['settingsSchemePills'],
  percentOf1RM:['settingsPercentOf1RM'],
  pctWave:['settingsPctWaveDefaultToggle','settingsPctWaveList'],
  weeklyPcts:['settingsPctWaveList'],
  weeklyDeloads:['settingsPctWaveList'],
  defaultRange:['settingsRepMin','settingsRepMax','settingsRepPresets'],
  undulating:['settingsVaryRangesToggle'],
  cycleLength:['settingsCyclePills'],
  weeklyRanges:['settingsWeekRangeList'],
  units:['settingsUnitPills'],
  statsDefaultMetric:['settingsStatsDefaultPills'],
  programMuscleView:['settingsProgramMusclePills'],
  warmupRungs:['settingsWarmupRungs'],
  warmupLadder:['settingsWarmupPct0','settingsWarmupPct1','settingsWarmupPct2','settingsWarmupReps0'],
  dbEntry:['settingsDbEntryPills'],
  hideDbTotal:['hideDbTotalToggle'],
  defaultSetCount:['settingsDefaultSetCount'],
  progressionOff:['progressionOffToggle'],
  effortMode:['settingsEffortPills'],
};

describe('Settings audit: every persisted setting has a rendered control (v1.883#22)',()=>{
  for(const [key,ids] of Object.entries(KEY_TO_CONTROLS)){
    it(`${key} → ${ids.join(', ')}`,()=>{
      for(const id of ids)assert.ok(hasId(id),`control #${id} for persisted key "${key}" is missing from index.html`);
    });
  }
});

describe('Settings audit: the expected section list renders',()=>{
  /* PP1 reorganization (pixel-peeper, v1.883), public fork: Account and
     Marketing removed — Appearance → Display → Units → Exercise defaults →
     Progression → Data → About. */
  const expected={
    'Appearance':['darkModeToggle','themePills'],
    'Display':['settingsDbEntryPills','settingsEffortPills','settingsStatsDefaultPills','settingsProgramMusclePills'],
    'Units':['settingsUnitPills'],
    'Exercise defaults':['settingsDefaultSetCount','hideDbTotalToggle','settingsWarmupRungs','settingsWarmupPct0'],
    'Progression':['progressionOffToggle','settingsSchemePills','settingsRpePills','settingsIncrementType','settingsIncrementValue','settingsRepMin','settingsRepMax','settingsTimeStepPills'],
    'Data':['exportDataButton','importCsvButton','deleteAllDataButton','deleteAllDialog'],
    'About':['appVersionLine','checkUpdatesButton','buildUpdatedLine'],
  };
  for(const [section,ids] of Object.entries(expected)){
    it(`${section} section renders all expected controls`,()=>{
      for(const id of ids)assert.ok(hasId(id),`${section}: #${id} is missing from index.html`);
    });
  }
  it('Account and Marketing sections are gone (public fork: no accounts/email)',()=>{
    assert.ok(!html.includes('data-section="account"'),'account section still present');
    assert.ok(!html.includes('data-section="marketing"'),'marketing section still present');
  });
  it('delete-all keeps its two-step confirm',()=>{
    /* The button opens a confirm dialog; the actual wipe is behind the
       dialog's own confirm button — the button alone must never delete. */
    const dialog=html.indexOf('id="deleteAllDialog"');
    assert.ok(dialog>0,'deleteAllDialog exists');
    assert.ok(html.indexOf('id="confirmDeleteAll"')>dialog,'confirmDeleteAll lives inside the dialog');
  });
  it('About carries attributions',()=>{
    assert.ok(html.includes('class="attribution-list"'),'attribution list renders');
  });
  it('sections render in the PP1 order (public fork: no Account/Marketing)',()=>{
    /* Appearance → Display → Units → Exercise defaults → Progression →
       Data → About. */
    const order=['Appearance','Display','Units','Exercise defaults','Progression','Data','About'];
    let last=-1;
    for(const title of order){
      const at=html.indexOf(`<h2>${title}</h2>`,last+1);
      assert.ok(at>last,`"${title}" renders after the previous section`);
      last=at;
    }
  });
  it('Units keeps only the weight-unit control (Display holds the rest)',()=>{
    const unitsAt=html.indexOf('data-section="units"');
    const displayAt=html.indexOf('data-section="display"');
    assert.ok(displayAt>0&&unitsAt>0,'both sections exist');
    /* The Display section comes before Units; the pill groups must live
       between the Display open and the Units open. */
    const between=html.slice(displayAt,unitsAt);
    for(const id of ['settingsDbEntryPills','settingsEffortPills','settingsStatsDefaultPills','settingsProgramMusclePills'])
      assert.ok(between.includes(`id="${id}"`),`#${id} lives in Display`);
  });
  it('fixed increment type is labeled "Weight (lb)" (v1.879 release notes)',()=>{
    /* Both the Settings select and the program-form select must label the
       fixed-increment option "Weight (lb)" — "Pounds (lb)" was the stale label. */
    for(const id of ['settingsIncrementType','progressionIncrementType']){
      const at=html.indexOf(`id="${id}"`);
      assert.ok(at>0,`#${id} exists`);
      const sel=html.slice(at,html.indexOf('</select>',at));
      assert.ok(sel.includes('<option value="lb">Weight (lb)</option>'),`#${id} labels the fixed increment "Weight (lb)"`);
      assert.ok(!sel.includes('Pounds (lb)'),`#${id} no longer says "Pounds (lb)"`);
    }
  });
});
