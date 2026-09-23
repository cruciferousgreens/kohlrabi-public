'use strict';
/* #108: one selector style across Settings — square boxes per #97.
   - Program setup's RPE trigger is the same 7/8/9 pill row as Settings
     (the plain spinbutton is gone).
   - Time-step / unit / metric pill selectors use the rounded-rectangle box
     (10px), not the old circular 999px pills. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');
const programsSrc=fs.readFileSync(path.join(ROOT,'assets/js/pages/programs.js'),'utf8');
const bootstrapSrc=fs.readFileSync(path.join(ROOT,'assets/js/core/app-bootstrap.js'),'utf8');

describe('#108: program RPE trigger is a pill row, not a spinbutton',()=>{
  it('program setup has the 7/8/9 RPE pill row',()=>{
    assert.ok(html.includes('id="programRpePills"'),
      'program RPE pill row exists');
    assert.ok(html.includes('data-rpe-threshold="7"')&&html.includes('data-rpe-threshold="9"'),
      'pill row offers 7/8/9');
    assert.ok(!html.includes('id="progressionThreshold"'),
      'the old spinbutton is gone');
  });
  it('the program pill row uses the square-box rep-preset style',()=>{
    assert.ok(html.includes('class="rep-preset-row" id="programRpePills"'),
      'program pill row uses the rep-preset-row component');
    assert.ok(css.includes('#programRpePills .rep-preset'),
      'program pills get the 44px square-box treatment');
  });
  it('syncProgramForm syncs the program RPE pills',()=>{
    assert.ok(programsSrc.includes("$('#programRpePills')"),
      'program form sync targets the pill row');
    assert.ok(programsSrc.includes('data-rpe-threshold'),
      'sync sets aria-pressed per threshold');
  });
  it('tapping a program RPE pill sets the program threshold',()=>{
    assert.ok(bootstrapSrc.includes("#programRpePills [data-rpe-threshold]"),
      'click wiring targets the program pill row');
    assert.ok(/programFormProgression\(\)\.threshold=v==='completion'\?'completion':Number\(v\)/.test(bootstrapSrc),
      'tap writes the threshold to the program form model (7/8/9 numeric, On completion as the string)');
  });
});

describe('#108: time-step pills keep the user-pinned pill shape',()=>{
  it('#316 still holds — step pills stay circular',()=>{
    /* Deliberate: #108 asked for square boxes everywhere, but #316 (user
       2026-09-13, newer) pins pills at 999px — "pills, switches, and step
       controls must not pick up the field treatment". The remaining
       square-vs-circle tension is parked for the user's call on #108. */
    const m=css.match(/\.step-pills \[data-step\]\s*\{([^}]*)\}/);
    assert.ok(m,'.step-pills [data-step] rule found');
    assert.match(m[1],/border-radius\s*:\s*999px/,'step pills stay pills per #316');
  });
  it('time-step pills render inside the step-pills family',()=>{
    assert.ok(html.includes('class="step-pills" id="settingsTimeStepPills"'),
      'settings time-step pills use step-pills');
    assert.ok(html.includes('class="step-pills" id="programTimeStepPills"'),
      'program time-step pills use step-pills');
  });
});
