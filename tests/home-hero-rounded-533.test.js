'use strict';
/* user 2026-09-17: the Home empty-state card ("No workouts yet") rendered
   with straight/sharp corners while every inner element (buttons, the
   "Create a program" card) is rounded. Pins: .training-hero — the shared
   register used by Home's empty state and the Workout tab's no-data card —
   carries a border-radius from the app token scale (no sharp 90-degree box).
   Source-text assertions on styles.css, following the #98 pattern. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const css=fs.readFileSync(path.resolve(__dirname,'..','assets/styles.css'),'utf8');

function ruleBlock(selector){
  const i=css.indexOf(selector);
  assert.ok(i>=0,`${selector} rule exists in styles.css`);
  const j=css.indexOf('{',i);
  const k=css.indexOf('}',j);
  return css.slice(j+1,k);
}

describe('#533 Home empty-state card is rounded, not sharp-edged',()=>{
  it('.training-hero carries a border-radius',()=>{
    const body=ruleBlock('.training-hero { position: relative;');
    assert.match(body,/border-radius:\s*var\(--radius-(sm|md|lg)\)/,
      'the empty-state hero card is rounded via the app radius scale');
  });
});
