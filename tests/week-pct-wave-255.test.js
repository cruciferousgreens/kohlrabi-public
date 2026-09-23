'use strict';
/* #255 (user 2026-09-12, reworked 2026-09-13): the "Vary % of 1RM by week"
   rows use the standard input components — bordered 44px inputs with focus
   rings on var(--surface-raised), grid-aligned rows. The 2026-09-13 rework
   fixed the range labels: they used to ellipsize ("6...") in a squeezed grid
   column — they now stack under the week with room to wrap, fully visible. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const css=fs.readFileSync(path.join(__dirname,'..','assets','styles.css'),'utf8');
const programs=fs.readFileSync(path.join(__dirname,'..','assets','js','pages','programs.js'),'utf8');

function rule(sel){
  const m=css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*\\{[^}]*\\}'));
  assert.ok(m,sel+' rule found');
  return m[0];
}

describe('#255 %1RM wave rows use standard input styling',()=>{
  it('the % input is a standard bordered input',()=>{
    const r=rule('.week-pct-input input');
    assert.ok(/border:\s*1px solid var\(--line\)/.test(r),'bordered like .rule-field input');
    assert.ok(/background:\s*var\(--surface-raised\)/.test(r),'surface-raised background');
    assert.ok(/border-radius:\s*var\(--radius-sm\)/.test(r),'standard radius');
  });
  it('the % input gets the standard focus ring',()=>{
    const r=rule('.week-pct-input input:focus');
    assert.ok(r.includes('var(--accent)'),'accent border on focus');
    assert.ok(r.includes('var(--focus-ring)'),'focus ring on focus');
  });
  it('the range label is fully visible — no ellipsis truncation',()=>{
    const r=rule('.week-pct-range');
    assert.ok(!/text-overflow:\s*ellipsis/.test(r),'no ellipsis');
    assert.ok(!/white-space:\s*nowrap/.test(r),'wraps instead of clipping');
  });
  it('the range label stacks under the week with room to wrap',()=>{
    assert.ok(programs.includes('class="week-pct-id"'),'week+label stack in markup');
    const r=rule('.week-pct-id');
    assert.ok(/display:\s*grid/.test(r),'stacked layout');
  });
  it('rows align on a grid',()=>{
    const r=rule('.week-pct-row');
    assert.ok(/display:\s*grid/.test(r),'grid-aligned rows');
  });
});
