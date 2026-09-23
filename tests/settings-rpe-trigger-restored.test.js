'use strict';
/* v1.883 item 21 (user-reported 2026-09-22): the RPE trigger control was
   dropped from Settings → Progression during the %1RM rework. The persisted
   default (progressionSetup.threshold, default 8) still exists and the
   program setup form still has its own pills, but Settings had NO control —
   the user could not change the global default. The field is restored as a
   pills row (#settingsRpePills) inside #progressionDefaultsCard, visible only
   when RPE-based mode is selected. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const bootstrap=fs.readFileSync(path.join(ROOT,'assets/js/core/app-bootstrap.js'),'utf8');
const stateSrc=fs.readFileSync(path.join(ROOT,'assets/js/core/state.js'),'utf8');

describe('Settings RPE trigger restored (v1.883#21)',()=>{
  it('the persisted default still exists',()=>{
    /* The state definition must keep the threshold so the restored control
       has something to write to. */
    assert.match(stateSrc,/const DEFAULT_PROGRESSION_SETUP=\{[^}]*threshold:8/,'DEFAULT_PROGRESSION_SETUP.threshold defaults to 8');
  });
  it('the pills markup exists inside the Progression section',()=>{
    const card=html.indexOf('id="progressionDefaultsCard"');
    const row=html.indexOf('id="settingsRpeTriggerRow"');
    assert.ok(card>0&&row>card,'#settingsRpeTriggerRow sits inside #progressionDefaultsCard');
    assert.ok(html.includes('id="settingsRpePills"'),'#settingsRpePills exists');
    for(const v of ['7','8','9','completion']){
      assert.ok(html.includes(`data-rpe-threshold="${v}"`),`threshold choice ${v} exists`);
    }
  });
  it('the row is hidden by default (RPE mode not the default scheme)',()=>{
    /* The default scheme is linear, so the row must start hidden and only
       appear when the user picks RPE-based. */
    assert.match(html,/<div class="rule-field" id="settingsRpeTriggerRow" hidden>/,'row starts hidden');
  });
  it('clicking a pill writes progressionSetup.threshold',()=>{
    /* Two occurrences of the selector exist: syncSettingsRpeTrigger (the
       render path) and the click wiring. Target the wiring — the one that
       adds the click listener. */
    const occurrences=[];
    let idx=bootstrap.indexOf('#settingsRpePills [data-rpe-threshold]');
    while(idx>0){occurrences.push(idx);idx=bootstrap.indexOf('#settingsRpePills [data-rpe-threshold]',idx+1);}
    assert.ok(occurrences.length>=2,'both the sync and the click wiring exist');
    const wiringIdx=occurrences.find(i=>bootstrap.slice(i,i+80).includes('addEventListener'));
    assert.ok(wiringIdx!==undefined,'click wiring for the settings pills exists');
    const block=bootstrap.slice(wiringIdx,wiringIdx+400);
    assert.ok(block.includes('progressionSetup.threshold'),'writes progressionSetup.threshold');
    assert.ok(block.includes("'completion'"),'"Off" maps to the completion sentinel');
    assert.ok(block.includes('schedulePersist()'),'persists the change');
    assert.ok(block.includes('syncSettingsRpeTrigger()'),'re-syncs the pills after a tap');
  });
  it('syncSettingsRpeTrigger mirrors the stored value and gates visibility',()=>{
    const fn=bootstrap.indexOf('function syncSettingsRpeTrigger');
    assert.ok(fn>0,'syncSettingsRpeTrigger exists');
    const body=bootstrap.slice(fn,fn+700);
    assert.ok(body.includes("scheme!=='rpe'"),'row hidden unless scheme is rpe');
    assert.ok(body.includes('progressionSetup.threshold'),'reads the stored threshold');
    assert.ok(body.includes('aria-pressed'),'reflects the active choice');
  });
  it('switching progression mode re-syncs the trigger row',()=>{
    /* Picking RPE-based must reveal the row; picking another mode must hide
       it again. syncSettingsScheme is the single choke point. */
    const fn=bootstrap.indexOf('function syncSettingsScheme');
    assert.ok(fn>0,'syncSettingsScheme exists');
    const body=bootstrap.slice(fn,fn+1200);
    assert.ok(body.includes('syncSettingsRpeTrigger()'),'syncSettingsScheme calls syncSettingsRpeTrigger');
  });
});
