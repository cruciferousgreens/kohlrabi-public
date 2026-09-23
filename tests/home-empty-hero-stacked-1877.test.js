'use strict';
/* v1.877 regression: the Home empty state ("No workouts yet") must stack
   vertically. A trainer style rule (.training-hero{display:flex}) leaked from
   the Training page and turned Home's empty-state children into a flex row.
   Pins: no unscoped `.training-hero` flex rule exists in styles.css, and the
   original block-level `.training-hero` card rule is intact. Source-text
   assertions on styles.css, following the #98/#533 pattern. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const css=fs.readFileSync(path.resolve(__dirname,'..','assets/styles.css'),'utf8');

describe('v1.877 Home empty state stacks vertically (no flex leak)',()=>{
  it('no unscoped .training-hero{display:flex} rule',()=>{
    // A scoped rule like `#trainingView.training-hero` would be fine; a bare
    // `.training-hero` flex rule breaks Home's empty state.
    const re=/(^|[}\n])\s*\.training-hero\s*\{[^}]*display\s*:\s*flex/gi;
    const hits=[...css.matchAll(re)];
    assert.equal(hits.length,0,
      `unscoped .training-hero flex rule found: ${hits.map(h=>h[0].slice(0,60)).join(' | ')}`);
  });
  it('the original block-level .training-hero card rule is intact',()=>{
    const i=css.indexOf('.training-hero { position: relative;');
    assert.ok(i>=0,'original .training-hero card rule missing from styles.css');
    const body=css.slice(css.indexOf('{',i)+1,css.indexOf('}',css.indexOf('{',i)));
    assert.match(body,/border-radius:/,'empty-state hero card keeps its radius');
    assert.ok(!/display\s*:\s*flex/.test(body),'card rule must not set display:flex');
  });
});
