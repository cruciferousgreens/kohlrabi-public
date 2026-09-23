'use strict';
/* Persona P11#4 (2026-09-22): invalid weight/RPE could be marked complete —
   the toggle sanitized (-5→0, 15→10) BEFORE validating, so junk values
   silently became valid boundary values and the set completed. The handler
   now validates the RAW values first and blocks completion with a clear
   message. Structural pin: the gate must sit between the raw draft values
   and the #564 sanitize pass. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const src=fs.readFileSync(path.join(__dirname,'..','assets','js','workout','workout-editor.js'),'utf8');
const start=src.indexOf('    function wireLiveCompleteSet(');
const fn=src.slice(start,src.indexOf('\n    function ',start+10));

describe('set-complete raw-value gate (persona P11#4)',()=>{
  it('the complete-toggle handler exists',()=>{
    assert.ok(start>0,'wireLiveCompleteSet exists');
  });
  it('validates raw weight before the #564 sanitize pass',()=>{
    /* The gate must reject negative/non-finite/over-cap weights on the raw
       draft value — sanitizeSetValue('w','-5')===0 would otherwise launder
       it into a valid-looking 0. */
    assert.ok(fn.includes('Persona P11#4'),'gate comment marker present');
    assert.ok(fn.includes('wBad'),'weight validity is computed');
    assert.ok(/wNum<0/.test(fn),'negative weights are rejected');
    assert.ok(/wNum>5000/.test(fn),'over-cap weights are rejected');
    assert.ok(/!Number\.isFinite\(wNum\)/.test(fn),'non-finite weights are rejected');
  });
  it('validates raw RPE before the #564 sanitize pass',()=>{
    /* sanitizeSetValue('rpe','11')===10 would otherwise launder an
       out-of-range RPE into a valid-looking 10. */
    assert.ok(fn.includes('rpeBad'),'RPE validity is computed');
    assert.ok(fn.includes('validLoggedRpe(rawRpe)'),'raw RPE goes through validLoggedRpe');
  });
  it('blocks completion with a message instead of completing',()=>{
    /* The gate returns before the sanitize/commit section — the set must
       stay incomplete and the user must get a toast. */
    const gateIdx=fn.indexOf('Persona P11#4');
    const sanitizeIdx=fn.indexOf('#564: normalize on the commit point');
    assert.ok(gateIdx>0&&sanitizeIdx>0,'both markers present');
    assert.ok(gateIdx<sanitizeIdx,'gate runs BEFORE the sanitize pass');
    assert.ok(fn.includes('Enter a weight between 0 and 5000.'),'weight toast wording');
    assert.ok(fn.includes('must be between 0 and 10 (or left blank)'),'RPE toast wording');
  });
  it('the gate only applies to incomplete sets',()=>{
    assert.ok(fn.includes('if(!set.complete){'),'gate is scoped to incomplete sets');
  });
});
