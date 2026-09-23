'use strict';
/* #546 (user 2026-09-19): resolveExercise() perf regression pin.

   The #539 consolidation wrote resolveExercise() as
     exercises.find(x=>x&&x.id===canonicalExerciseId(id))
   — canonicalExerciseId() (itself an O(n) catalog scan) ran INSIDE the
   .find() predicate, so every lookup was O(n²): ~767k operations per call
   on the 876-entry catalog. Logs list renders took ~700ms and the whole
   app felt sluggish; the fix hoists the canonicalization out and serves
   both functions from a lazily-built cached id→entry Map (O(1)).

   Pins:
   - one resolveExercise() call invokes canonicalExerciseId() exactly once
     (pre-fix: once per scanned catalog entry, i.e. hundreds of calls) —
     deterministic, no wall-clock flakiness;
   - 20,000 resolveExercise() calls over the full catalog finish quickly
     (pre-fix ~2s on the dev machine; post-fix a few ms — bound is generous);
   - behavior is unchanged: variant -> canonical entry object, canonical ->
     itself, unknown id -> undefined. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const role=loadRole('alias-539');
const {exercises,resolveExercise}=role;
const indirectEval=eval;
const getGlobal=name=>indirectEval(`typeof ${name}==='undefined'?undefined:${name}`);

describe('#546: resolveExercise() is O(1), not O(n²)',()=>{
  it('invokes canonicalExerciseId() exactly once per lookup',()=>{
    const orig=getGlobal('canonicalExerciseId');
    assert.equal(typeof orig,'function');
    globalThis.__546calls=0;
    globalThis.__546orig=orig;
    try{
      indirectEval('canonicalExerciseId=function(id){globalThis.__546calls++;return globalThis.__546orig(id);};');
      const variant=exercises.find(x=>x&&x.aliasOf);
      assert.ok(variant,'catalog has a variant entry');
      resolveExercise(variant.id);
      assert.equal(globalThis.__546calls,1,
        `canonicalExerciseId ran ${globalThis.__546calls}x per resolveExercise (pre-fix: hundreds)`);
      resolveExercise(variant.aliasOf);
      assert.equal(globalThis.__546calls,2,'a second lookup adds exactly one more call');
    }finally{
      indirectEval('canonicalExerciseId=globalThis.__546orig;');
      delete globalThis.__546calls;
      delete globalThis.__546orig;
    }
  });

  it('behavioral: variant/canonical/unknown resolution unchanged',()=>{
    const variant=exercises.find(x=>x&&x.aliasOf);
    assert.ok(variant,'catalog has a variant entry');
    const canon=resolveExercise(variant.aliasOf);
    assert.ok(canon,'canonical id resolves');
    assert.equal(resolveExercise(variant.id),canon,'variant resolves to the canonical entry object');
    assert.equal(resolveExercise(variant.aliasOf),canon,'canonical id resolves to itself');
    assert.equal(resolveExercise('no-such-exercise-xyz'),undefined,'unknown id resolves to undefined');
    assert.equal(resolveExercise(undefined),undefined,'undefined resolves to undefined');
  });

  it('20,000 lookups over the catalog complete quickly',()=>{
    const ids=exercises.filter(x=>x&&x.id).map(x=>x.id);
    assert.ok(ids.length>=800,'catalog has the expected ~876 entries');
    const t0=Date.now();
    for(let k=0;k<20000;k++)resolveExercise(ids[k%ids.length]);
    const ms=Date.now()-t0;
    assert.ok(ms<1000,`20k resolveExercise calls took ${ms}ms (pre-fix: ~2000ms+)`);
  });
});
