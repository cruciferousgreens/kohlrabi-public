'use strict';
/* #561 (persona sweep v1.862): malformed nested backup data is rejected at
   the validation boundary — it must never reach state and crash screens. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {obValidateBackupJson}=loadRole('csv-import');
const fs=require('node:fs');
const path=require('node:path');
const csvSrc=fs.readFileSync(path.join(__dirname,'..','assets','js','core','csv-import.js'),'utf8');

const base=()=>({version:99,savedAt:Date.now(),completed:[],templates:[]});
const bad=(mut)=>{const b=base();mut(b);return JSON.stringify(b);};

describe('#561: deep backup validation',()=>{
  it('rejects exercises that are not an array',()=>{
    const r=obValidateBackupJson(bad(b=>{b.completed=[{id:'w',exercises:'oops'}];}));
    assert.equal(r.ok,false);
  });
  it('rejects null set entries',()=>{
    const r=obValidateBackupJson(bad(b=>{b.completed=[{id:'w',exercises:[{exerciseId:'x',sets:[null]}]}];}));
    assert.equal(r.ok,false);
  });
  it('rejects non-numeric set fields',()=>{
    const r=obValidateBackupJson(bad(b=>{b.completed=[{id:'w',exercises:[{exerciseId:'x',sets:[{w:'abc',r:8}]}]}];}));
    assert.equal(r.ok,false);
  });
  it('rejects malformed program workouts',()=>{
    const r=obValidateBackupJson(bad(b=>{b.activeProgram={name:'P',workouts:[{name:'W',template:{exercises:'x'}}]};}));
    assert.equal(r.ok,false);
  });
  it('rejects non-string rest days (legacy backup key)',()=>{
    const r=obValidateBackupJson(bad(b=>{b.restDays=[20260920];}));
    assert.equal(r.ok,false);
  });
  it('rejects a malformed draft',()=>{
    const r=obValidateBackupJson(bad(b=>{b.draft={exercises:[{exerciseId:'x',sets:[{w:'abc'}]}]};}));
    assert.equal(r.ok,false);
  });
  it('accepts a well-formed backup (restDays is a legacy-accepted key, ignored on restore)',()=>{
    const b=base();
    b.completed=[{id:'w',name:'W',exercises:[{exerciseId:'bench-press',sets:[{w:100,r:8,rpe:8,tags:[]}]}]}];
    b.activeProgram={name:'P',length:4,workouts:[{name:'A',template:{name:'A',exercises:[{exerciseId:'bench-press',sets:[]}]}}]};
    b.restDays=['2026-09-20'];
    const r=obValidateBackupJson(JSON.stringify(b));
    assert.equal(r.ok,true);
  });
  it('still rejects the old top-level malformations',()=>{
    assert.equal(obValidateBackupJson('not json').ok,false);
    assert.equal(obValidateBackupJson(JSON.stringify({version:99,savedAt:1,bogusKey:1})).ok,false);
  });
});

describe('#564: CSV import funnels numerics through the same sanitizer',()=>{
  /* The csv-import role doesn't load utilities.js (which owns
     sanitizeSetValue), so the funnel is pinned at the source level; the
     sanitizer's own behavior is covered in persona-hash-sanitize-562-564. */
  it('every imported numeric routes through sanitizeSetValue',()=>{
    assert.ok(csvSrc.includes("w:sanitizeSetValue('w',obParseCsvNumber(row.weight_lb))"),
      'imported weight is sanitized');
    assert.ok(csvSrc.includes("r:sanitizeSetValue('r',pr.r)"),
      'imported reps are sanitized');
    assert.ok(csvSrc.includes("seconds:sanitizeSetValue('seconds',obParseCsvNumber(row.duration_s))"),
      'imported seconds are sanitized');
    assert.ok(csvSrc.includes("rpe:sanitizeSetValue('rpe',obParseCsvNumber(row.rpe))"),
      'imported RPE is sanitized');
  });
});
