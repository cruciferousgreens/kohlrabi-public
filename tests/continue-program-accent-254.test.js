'use strict';
/* #254 (user 2026-09-12): the Workout tab's "Continue program" card
   (.program-next-main) rendered a blue/teal border even under the Rosé theme —
   it used the Rosé Pine palette tokens --foam/--pine instead of the theme
   accent. It must use var(--accent) / var(--accent-hover) so the glow follows
   the active theme (pink under Rosé). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const css=fs.readFileSync(path.join(__dirname,'..','assets','styles.css'),'utf8');

describe('#254 continue-program card follows the theme accent',()=>{
  it('border uses the theme accent, not the pine/foam palette tokens',()=>{
    /* Anchor at line start: compound selectors like
       `.dash-empty-hero .program-next-main` must not match — only the base
       card rule. */
    const rule=css.match(/^[ \t]*\.program-next-main\s*\{[^}]*\}/m);
    assert.ok(rule,'.program-next-main rule found');
    assert.ok(/border:[^;]*var\(--accent\)/.test(rule[0]),'border follows --accent: '+rule[0].slice(0,120));
    assert.ok(!rule[0].includes('--foam')&&!rule[0].includes('--pine'),'no pine/foam tokens remain');
  });
  it('hover uses the accent hover token',()=>{
    const hover=css.match(/\.program-next-main:hover\s*\{[^}]*\}/);
    assert.ok(hover,'.program-next-main:hover rule found');
    assert.ok(hover[0].includes('var(--accent-hover)'),'hover follows --accent-hover');
  });
});
