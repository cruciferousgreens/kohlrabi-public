'use strict';
/* #527/#528 (agent browser QA, 2026-09-17): two storage-loss reports traced to
   the test Chromium's broken cross-reload storage — single-setting changes
   persisted individually in the same session, and no single-tab loss path is
   constructible from the persist code (memory-first mutations, debounced
   coalescing, pagehide safety net, read-before-write that only merges a
   strictly-newer cross-tab blob). These tests pin the write path so a future
   regression can't silently reintroduce real loss:
   - #527: rapid successive settings changes coalesce through schedulePersist
     into ONE debounced persistNow, and every change lands in the payload —
     including a change that lands while persistNow's async storage read is
     in flight. The pagehide safety net carries changes that never got a
     debounced write at all.
   - #528: the program muscle-card default view round-trips through
     collectPersistable → JSON → the boot restore path. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
/* persistence.js arms a 5s autosave interval at load — stub it to a no-op
   so the test process can exit (pattern from subscriptions-511). */
const __setInterval=globalThis.setInterval;
globalThis.setInterval=(fn,ms,...rest)=>(ms===5000?0:__setInterval(fn,ms,...rest));
/* One loadRole per process (re-loading re-declares top-level consts). */
const role=loadRole('persist-settings-527-528');
const {
  Storage,PERSIST_KEY,progressionSetup,
  collectPersistable,schedulePersist,persistNow,persistSyncForUnload,
  normalizeProgression,resetProgressionSetup,
}=role;
/* In-memory storage backend: writes captured, reads empty, no real IO. */
let saved={};
Storage.loadBlob=async()=>null;
Storage.saveBlob=async(key,str)=>{saved[key]=String(str);return true;};
/* Fake setTimeout/clearTimeout so the debounce is deterministic and the
   process never waits out the 250ms window. */
const __setTimeout=globalThis.setTimeout;
const __clearTimeout=globalThis.clearTimeout;
let fakeTimers=[];
function armFakeTimers(){
  fakeTimers=[];
  globalThis.setTimeout=(fn)=>{const id=fakeTimers.length;fakeTimers.push({id,fn});return id;};
  globalThis.clearTimeout=(id)=>{fakeTimers=fakeTimers.filter(t=>t.id!==id);};
}
function restoreTimers(){
  globalThis.setTimeout=__setTimeout;
  globalThis.clearTimeout=__clearTimeout;
}
const ie=eval; /* indirect: reaches the module-scope lets of persistence.js */
beforeEach(()=>{
  resetProgressionSetup();
  saved={};
  ie('lastWrittenHash=null;lastSeenSavedAt=0;persistTimer=null;');
});

describe('#527 rapid successive settings changes',()=>{
  it('coalesce into a single debounced write carrying every change',async()=>{
    armFakeTimers();
    try{
      /* The exact #527 repro pair: Units → Kilograms, then immediately
         Dumbbell entry → Total. */
      progressionSetup.units='metric';schedulePersist();
      progressionSetup.dbEntry='total';schedulePersist();
      assert.equal(fakeTimers.length,1,'second schedulePersist cancels the first');
      await fakeTimers[0].fn(); /* the surviving debounce fires persistNow */
      assert.ok(saved[PERSIST_KEY],'a write landed');
      const blob=JSON.parse(saved[PERSIST_KEY]);
      assert.equal(blob.progressionSetup.units,'metric','first change kept');
      assert.equal(blob.progressionSetup.dbEntry,'total','second change kept');
    }finally{restoreTimers();}
  });
  it('a change landing mid-write is not clobbered by the in-flight persist',async()=>{
    let release;const gate=new Promise(r=>{release=r;});
    const origLoad=Storage.loadBlob;
    Storage.loadBlob=async()=>{await gate;return null;};
    try{
      progressionSetup.units='metric';
      const p=persistNow(); /* starts, parks on the async storage read */
      await new Promise(r=>setImmediate(r)); /* let it reach the gate */
      progressionSetup.incrementValue=7; /* change lands while writing */
      release();await p;
      const blob=JSON.parse(saved[PERSIST_KEY]);
      assert.equal(blob.progressionSetup.units,'metric','pre-write change kept');
      assert.equal(blob.progressionSetup.incrementValue,7,'mid-write change kept');
    }finally{Storage.loadBlob=origLoad;}
  });
  it('the pagehide safety net carries changes that never got a debounced write',()=>{
    progressionSetup.threshold=7; /* no schedulePersist, straight to unload */
    persistSyncForUnload();
    const raw=localStorage.getItem(PERSIST_KEY);
    assert.ok(raw,'unload copy written');
    assert.equal(JSON.parse(raw).progressionSetup.threshold,7,'change carried');
  });
});

describe('#528 program muscle-card default view persistence',()=>{
  it('round-trips through the blob and the boot restore path',()=>{
    progressionSetup.programMuscleView='heatmap';
    const blob=JSON.parse(JSON.stringify(collectPersistable()));
    assert.equal(blob.progressionSetup.programMuscleView,'heatmap','persisted');
    /* Simulate a fresh boot: defaults, then the restore lines from
       persistence.js (Object.assign + normalizeProgression). */
    resetProgressionSetup();
    assert.equal(progressionSetup.programMuscleView,'chart','boot default');
    Object.assign(progressionSetup,blob.progressionSetup);
    normalizeProgression(progressionSetup);
    assert.equal(progressionSetup.programMuscleView,'heatmap','restored');
  });
  it('a garbage stored value normalizes back to chart',()=>{
    progressionSetup.programMuscleView='bogus';
    normalizeProgression(progressionSetup);
    assert.equal(progressionSetup.programMuscleView,'chart');
  });
});
