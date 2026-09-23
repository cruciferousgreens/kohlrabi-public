'use strict';
/* Role: view-transition — pins the subtle view-transition fade (user 2026-09-16):
   tab switches should crossfade instead of snapping. The stylesheet must
   define a view-enter keyframe (opacity + small rise, composited properties
   only so there is no layout thrash), apply it to every top-level view
   selector, and disable it under prefers-reduced-motion. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const css=fs.readFileSync(path.resolve(__dirname,'..','assets','styles.css'),'utf8');

const VIEW_SELECTORS=[
  '.dashboard-view.active',
  '.stats-view.active',
  '.workout-view.active',
  '.program-view.active',
  '.detail.active',
  '.library:not(.hidden)',
];

describe('view-transition fade',()=>{
  it('defines the view-enter keyframes (opacity + rise, no layout properties)',()=>{
    const m=css.match(/@keyframes\s+view-enter\s*\{([\s\S]*?)\}\s*\}/);
    assert.ok(m,'@keyframes view-enter is defined');
    assert.match(m[1],/opacity:\s*0/);
    assert.match(m[1],/opacity:\s*1/);
    assert.match(m[1],/translateY\(/);
    assert.doesNotMatch(m[1],/\b(width|height|margin|padding|top|left)\s*:/);
  });
  it('applies the fade to every top-level view selector',()=>{
    for(const sel of VIEW_SELECTORS)assert.ok(css.includes(sel),sel+' is animated');
    assert.match(css,/animation:\s*view-enter\s+\d+ms/);
  });
  it('disables the animation under prefers-reduced-motion',()=>{
    const m=css.match(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{([\s\S]*?)\}\s*\}/);
    assert.ok(m,'prefers-reduced-motion guard exists');
    assert.match(m[1],/animation:\s*none/);
  });
});
