'use strict';
/* #419 (user 2026-09-13): the create-program screen was an ugly text blob
   over a giant button. Redesign: guidance lives inline under each field,
   and the commit button sits in a natural-width actions row.
   Dependency-free: reads the markup, styles, and programs.js from disk.
   - Length and start-week inputs carry inline hints.
   - The button keeps its natural width (no full-width blob).
   - Validation behavior is unchanged (same message, same conditions). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');
const programs=fs.readFileSync(path.join(ROOT,'assets/js/pages/programs.js'),'utf8');

describe('#419 create-program commit area',()=>{
  it('length and start-week inputs carry inline hints',()=>{
    assert.ok(/id="programLength"[^>]*\/><p class="field-help">1 to 52 weeks\.<\/p>/.test(html),
      'length input has an inline "1 to 52 weeks" hint');
    assert.ok(/id="programStartWeek"[^>]*\/><p class="field-help">1 up to the program length\.<\/p>/.test(html),
      'start-week input has an inline range hint');
  });
  it('the button sits in a natural-width actions row',()=>{
    assert.ok(/class="program-setup-actions"/.test(html),'actions wrapper exists');
    const m=css.match(/\.program-setup-actions\s*\{([^}]*)\}/);
    assert.ok(m,'.program-setup-actions rule exists');
    assert.ok(/display:\s*flex/.test(m[1]),'actions row is a flex container');
    const btn=css.match(/\.program-setup-actions\s+\.primary-button\s*\{([^}]*)\}/);
    assert.ok(btn,'button sizing rule exists');
    assert.ok(/flex:\s*0\s+0\s+auto/.test(btn[1]),'button keeps its natural width');
  });
  it('validation behavior is unchanged',()=>{
    assert.ok(/programError.+textContent = 'Add a program name, a length from 1 to 52 weeks, and a start week within that range\.'/.test(programs),
      'same error message');
    assert.ok(/if \(!name \|\| !Number\.isInteger\(length\) \|\| length < 1 \|\| length > 52 \|\| !Number\.isInteger\(startWeek\) \|\| startWeek < 1 \|\| startWeek > length\)/.test(programs),
      'same validation conditions');
    assert.ok(/role="alert"/.test(html),'error paragraph keeps its alert role');
  });
});
