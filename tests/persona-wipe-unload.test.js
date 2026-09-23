'use strict';
/* Persona QA 2026-09-16 (beginner + techie passes): two durability bugs.
   1. "Delete all data" didn't wipe: wipeLocalUserData() fired the IndexedDB
      blob delete fire-and-forget and the caller reloaded immediately — boot
      resurrected the still-present blob. The wipe now returns the delete
      promise so callers await durability BEFORE location.reload().
   2. An in-progress workout vanished when the tab reloaded before the
      debounced async IDB write landed. pagehide now stashes a synchronous
      localStorage copy when (and only when) there are unwritten changes;
      boot and persistNow's read-before-write take the newer blob by savedAt.
   Role: state + utilities + storage + persistence + onboarding
   (persistence-unload); Storage is stubbed per-test for the IDB backend. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
/* persistence.js arms a 5s autosave interval at load — stub it to a no-op
   so the test process can exit (same pattern as other persistence tests). */
const __setInterval=globalThis.setInterval;
globalThis.setInterval=(fn,ms,...rest)=>(ms===5000?0:__setInterval(fn,ms,...rest));
const role=loadRole('persistence-unload',{globals:{exercises:[]}});
const {
  wipeLocalUserData,workoutState,state,persistSyncForUnload,
  newerBlob,savedAtOf,PERSIST_KEY,Storage,
}=role;

const LS=()=>globalThis.localStorage;
beforeEach(()=>{LS().clear();});

function fakeIdbStorage(delayMs=30){
  /* The app's Storage is a top-level const in storage.js — a bare
     globalThis.Storage assignment would NOT shadow it (lexical binding wins),
     so tests stub the backend + idbDel on the real object instead.
     (#520: the wipe goes through deleteBlobDurable, which verifies via
     idbGet — so idbDel is the seam to stub, not deleteBlob.) */
  const real=Storage;
  const origBackend=real.backend, origIdbDel=real.idbDel, origIdbGet=real.idbGet;
  let deleted=false;
  real.backend='idb';
  real.idbDel=()=>new Promise(res=>setTimeout(()=>{deleted=true;res(true);},delayMs));
  real.idbGet=async()=>null; /* the blob is gone after the (stubbed) delete */
  return {
    isDeleted:()=>deleted,
    restore:()=>{real.backend=origBackend;real.idbDel=origIdbDel;real.idbGet=origIdbGet;},
  };
}

describe('delete-all durability: the wipe is awaitable',()=>{
  it('returns a promise on the IDB backend that resolves only after the blob is gone',async()=>{
    const {isDeleted,restore}=fakeIdbStorage();
    try{
      workoutState.completed=[{id:'w1',name:'Ghost workout'}];
      const p=wipeLocalUserData();
      assert.equal(typeof p?.then,'function','wipe returns an awaitable on the IDB backend');
      assert.equal(isDeleted(),false,'the IDB delete is async — a synchronous reload would race it');
      await p;
      assert.equal(isDeleted(),true,'awaiting the wipe guarantees durability before location.reload()');
      assert.deepEqual(workoutState.completed,[],'in-memory state is cleared');
    }finally{restore();}
  });
  it('the IDB delete is attempted even when the memoized backend is localStorage (#520 retest)',async()=>{
    /* Real-browser failure on v1.799: the probe is per-session. A session
       that fell back to localStorage skipped the IDB delete entirely, and
       the next boot's successful probe resurrected the "deleted" blob.
       The wipe must never gate on Storage.backend. */
    const {isDeleted,restore}=fakeIdbStorage();
    const origBackend=Storage.backend;
    Storage.backend='localStorage';
    try{
      await wipeLocalUserData();
      assert.equal(isDeleted(),true,'IDB delete attempted regardless of the memoized probe result');
    }finally{Storage.backend=origBackend;restore();}
  });
  it('wipeLocalUserData(null) does not throw (null-safe opts)',async()=>{
    /* Found by the local #520 repro: Playwright's wait_for_function invoked
       the wipe as a predicate with null, and the destructuring default only
       covers undefined. No UI caller passes null today; this is defense. */
    workoutState.completed=[{id:'w1',name:'Ghost workout'}];
    await wipeLocalUserData(null);
    assert.deepEqual(workoutState.completed,[],'wipe ran');
  });
  it('an unreachable IDB still wipes via the localStorage trump card',async()=>{
    const origBackend=Storage.backend, origIdbDel=Storage.idbDel, origIdbGet=Storage.idbGet;
    Storage.backend='localStorage';
    /* No indexedDB in this harness at all: idbGet resolves undefined. */
    Storage.idbDel=async()=>false;
    Storage.idbGet=async()=>undefined;
    try{
      workoutState.completed=[{id:'w1',name:'Ghost workout'}];
      const p=wipeLocalUserData();
      assert.equal(typeof p?.then,'function','wipe always returns an awaitable');
      await p;
      const raw=LS().getItem(PERSIST_KEY);
      assert.ok(raw,'trump card written when IDB cannot be verified');
      const data=JSON.parse(raw);
      assert.deepEqual(data.completed,[],'trump carries the emptied state');
      assert.ok(Number(data.savedAt)>0,'trump is timestamped so newerBlob prefers it');
    }finally{Storage.backend=origBackend;Storage.idbDel=origIdbDel;Storage.idbGet=origIdbGet;}
  });
});

describe('unload safety net: persistSyncForUnload',()=>{
  it('writes a synchronous localStorage copy when there are unwritten changes',()=>{
    workoutState.completed=[{id:'w1',name:'In-progress stuff'}];
    persistSyncForUnload();
    const raw=LS().getItem(PERSIST_KEY);
    assert.ok(raw,'a dirty unload stashes a copy');
    const data=JSON.parse(raw);
    assert.ok(Number(data.savedAt)>0,'the copy is timestamped for newer-wins comparison');
    assert.equal(data.completed.length,1,'the copy carries the unwritten state');
  });
  it('writes nothing when the state is clean (no stale copy left behind)',()=>{
    workoutState.completed=[];
    wipeLocalUserData(); /* seeds lastWrittenHash with the emptied state */
    persistSyncForUnload();
    /* #520 (v1.801): the wipe itself plants the emptied state synchronously,
       so the key exists — but it must carry no data. The safety net must not
       add anything on top of the plant. */
    const raw=LS().getItem(PERSIST_KEY);
    assert.ok(raw,'the wipe plants the emptied state (#520 empty-window fix)');
    assert.deepEqual(JSON.parse(raw).completed,[],'the plant carries no stale data');
  });
  it('a post-wipe unload cannot resurrect data',()=>{
    workoutState.completed=[{id:'w1'}];
    wipeLocalUserData();
    /* pagehide fires during the post-wipe reload: the emptied state is
       "clean", so the safety net must not rewrite data — and boot's
       newest-copy selection must land on the plant's emptied state. */
    persistSyncForUnload();
    const raw=LS().getItem(PERSIST_KEY);
    assert.ok(raw,'the wipe plant survives the unload');
    const newer=newerBlob(null,raw);
    assert.deepEqual(JSON.parse(newer).completed,[],'boot would restore empty, not the wiped data');
  });
});

describe('unload safety net: newer-wins blob comparison',()=>{
  const blob=(savedAt)=>JSON.stringify({version:1,savedAt,completed:[]});
  it('savedAtOf reads the timestamp, -1 for garbage',()=>{
    assert.equal(savedAtOf(blob(123)),123);
    assert.equal(savedAtOf('not json'),-1);
    assert.equal(savedAtOf(JSON.stringify({version:1})),0);
    assert.equal(savedAtOf(JSON.stringify({nope:true})),-1,'versionless blobs never win');
  });
  it('newerBlob takes the newer copy by savedAt',()=>{
    const old=blob(100), fresh=blob(200);
    assert.equal(newerBlob(old,fresh),fresh,'the pagehide copy wins when newer');
    assert.equal(newerBlob(fresh,old),fresh,'the IDB blob wins when newer');
    assert.equal(newerBlob(null,fresh),fresh,'missing IDB blob falls back to the copy');
    assert.equal(newerBlob(old,null),old,'missing copy keeps the IDB blob');
    assert.equal(newerBlob('garbage',fresh),fresh,'a corrupt IDB blob loses to a valid copy');
  });
});
