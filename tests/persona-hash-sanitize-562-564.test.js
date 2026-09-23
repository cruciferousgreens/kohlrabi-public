'use strict';
/* Persona sweep v1.862 — pure utilities regressions.
   #562: malformed hashes must not abort routing (safeDecodeHash).
   #564: set fields are canonically sanitized (sanitizeSetValue). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const role=loadRole('utilities');
const {safeDecodeHash,sanitizeSetValue}=role;
/* The app reads the bare `location` global (a window property in browsers);
   the harness only stubs window.location, so alias it for this file. */
globalThis.location=role.window.location;
const loc=()=>globalThis.location;

describe('#562: safeDecodeHash',()=>{
  it('decodes a normal hash',()=>{
    loc().hash='#program';
    assert.equal(safeDecodeHash(),'program');
  });
  it('a lone % falls back to the raw slice instead of throwing',()=>{
    loc().hash='#foo%bar';
    assert.equal(safeDecodeHash(),'foo%bar');
    loc().hash='#%';
    assert.equal(safeDecodeHash(),'%');
  });
  it('an empty hash decodes to empty',()=>{
    loc().hash='';
    assert.equal(safeDecodeHash(),'');
    loc().hash='#';
    assert.equal(safeDecodeHash(),'');
  });
});

describe('#564: sanitizeSetValue',()=>{
  it('reps are whole numbers',()=>{
    assert.equal(sanitizeSetValue('r','8.7'),9);
    assert.equal(sanitizeSetValue('r','8.2'),8);
  });
  it('absurd weights clamp',()=>{
    assert.equal(sanitizeSetValue('w','999999'),5000);
    assert.equal(sanitizeSetValue('w','-5'),0);
  });
  it('RPE clamps to 0–10',()=>{
    assert.equal(sanitizeSetValue('rpe','11'),10);
    assert.equal(sanitizeSetValue('rpe','-1'),0);
    assert.equal(sanitizeSetValue('rpe','7.5'),7.5);
  });
  it('empty and non-numeric become null',()=>{
    assert.equal(sanitizeSetValue('w',''),null);
    assert.equal(sanitizeSetValue('r','abc'),null);
    assert.equal(sanitizeSetValue('seconds',undefined),null);
  });
  it('seconds and distance keep sane bounds',()=>{
    assert.equal(sanitizeSetValue('seconds','999999'),86400);
    assert.equal(sanitizeSetValue('distance','2000000'),1000000);
    assert.equal(sanitizeSetValue('distance','1500.5'),1500.5);
  });
  it('already-numeric values pass through',()=>{
    assert.equal(sanitizeSetValue('w',100),100);
    assert.equal(sanitizeSetValue('rpe',8),8);
  });
});
