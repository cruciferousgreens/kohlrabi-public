'use strict';
/* #520 (2026-09-16 persona QA): delete-all resurrected the full persisted
   state after reload. Root cause: _idbDel resolved on the delete request's
   onsuccess, not the transaction's oncomplete — location.reload() tore the
   page down before the transaction committed, so boot read the "deleted"
   blob back. The fix (v1.798):
   - _idbSet/_idbDel resolve on transaction commit (tx.oncomplete), never on
     request success;
   - Storage.deleteBlobDurable deletes, verifies the blob is gone, and
     retries once;
   - wipeLocalUserData falls back to a synchronous localStorage write of the
     emptied payload with a fresh savedAt when IDB won't delete, so boot's
     newest-copy selection (newerBlob) picks the empty state.
   v1.799 post-mortem (real browser): the v1.798 wipe gated the IDB delete
   on the memoized Storage.backend. The probe is per-session — when it
   failed that session the app ran on localStorage while a full blob sat in
   IDB; the wipe skipped IDB and the next boot's successful probe
   resurrected everything. The fix: deleteBlobDurable attempts the raw
   delete+verify unconditionally (never consulting the probe), treats an
   unreachable IDB as unverified rather than success, and the wipe always
   awaits it, falling back to the localStorage trump card.
   In Node, indexedDB is undefined, so the harness installs a fake with real
   commit semantics: a delete's request success fires BEFORE the delete
   lands, which only happens at transaction commit. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const REPO_ROOT=path.join(__dirname,'..');

function loadPersistence(initialLS){
  const store=new Map();
  if(initialLS)for(const [k,v] of Object.entries(initialLS))store.set(k,String(v));
  const localStorage={
    getItem:k=>store.has(k)?store.get(k):null,
    setItem:(k,v)=>store.set(k,String(v)),
    removeItem:k=>store.delete(k),
    clear:()=>store.clear(),
  };
  const sandbox={
    console:console,
    localStorage:localStorage,
    window:{addEventListener:function(){}},
    navigator:{onLine:true},
    $:function(){return null;},
    setTimeout:setTimeout,clearTimeout:clearTimeout,
    setInterval:function(){return 0;},clearInterval:function(){},
    Date:Date,JSON:JSON,Math:Math,Number:Number,String:String,Array:Array,
    Object:Object,Map:Map,Set:Set,Promise:Promise,isFinite:isFinite,isNaN:isNaN,
  };
  sandbox.globalThis=sandbox;
  sandbox.workoutState={completed:[],templates:[],tags:[],exerciseTagPresets:[],
    activeProgram:null,archivedPrograms:[],savedPrograms:[],draft:null};
  sandbox.state={customExercises:[],favorites:new Set(),muscles:new Set(),
    savedBuilder:null,savedFilter:null,dashboardPeriod:'week',statsPeriod:'week',
    logPeriod:'week'};
  sandbox.exercises=[];
  sandbox.progressionSetup={};
  sandbox.cloneWorkoutTemplates=function(){return [];};
  sandbox.DEFAULT_SET_TAGS=[];
  sandbox.DEFAULT_EXERCISE_TAG_PRESETS=[];
  sandbox.mergeTagLists=function(def,list){return Array.isArray(list)?list:def;};
  sandbox.normalizeProgression=function(){};
  sandbox.resetProgressionSetup=function(){};
  vm.createContext(sandbox);
  const storageCode=fs.readFileSync(path.join(REPO_ROOT,'assets/js/core/storage.js'),'utf8');
  vm.runInContext(storageCode,sandbox,{filename:'assets/js/core/storage.js'});
  const code=fs.readFileSync(path.join(REPO_ROOT,'assets/js/core/persistence.js'),'utf8');
  vm.runInContext(code,sandbox,{filename:'assets/js/core/persistence.js'});
  return {sandbox,store};
}

/* Fake IndexedDB with genuine commit semantics: a delete request's
   onsuccess fires first, and the delete only becomes visible at the
   transaction's oncomplete. If _idbDel resolves on request success (the
   #520 bug), the returned promise settles BEFORE the 'tx-complete-del'
   event; the fix settles it after. */
function installFakeIndexedDb(sandbox){
  const data=new Map();
  const events=[];
  sandbox.window.__idbEvents=events;
  sandbox.indexedDB={
    open:function(){
      const openReq={onsuccess:null,onerror:null,onblocked:null,onupgradeneeded:null,result:null};
      setTimeout(function(){
        const db={
          transaction:function(){
            /* The transaction object IS the return value (as in real
               IndexedDB) — the app sets tx.oncomplete on it directly. */
            const tx={oncomplete:null,onerror:null,onabort:null};
            const commit=function(ok){setTimeout(function(){
              if(ok){if(tx.oncomplete)tx.oncomplete({});}
              else if(tx.onerror)tx.onerror({});
            },0);};
            tx.objectStore=function(){
              return {
                put:function(value,key){
                  const r={onsuccess:null,onerror:null,result:undefined};
                  setTimeout(function(){
                    data.set(key,value);
                    events.push('req-success-put');
                    if(r.onsuccess)r.onsuccess({target:r});
                    events.push('tx-complete-put');
                    commit(true);
                  },0);
                  return r;
                },
                delete:function(key){
                  const r={onsuccess:null,onerror:null,result:undefined};
                  setTimeout(function(){
                    /* Request success fires BEFORE the delete commits —
                       a concurrent reader here would still see the key. */
                    events.push('req-success-del');
                    if(r.onsuccess)r.onsuccess({target:r});
                    setTimeout(function(){
                      data.delete(key);
                      events.push('tx-complete-del');
                      commit(true);
                    },0);
                  },0);
                  return r;
                },
                get:function(key){
                  const r={onsuccess:null,onerror:null,result:undefined};
                  setTimeout(function(){
                    r.result=data.has(key)?data.get(key):undefined;
                    if(r.onsuccess)r.onsuccess({target:r});
                    commit(true);
                  },0);
                  return r;
                }
              };
            };
            return tx;
          },
          close:function(){}
        };
        openReq.result=db;
        if(openReq.onsuccess)openReq.onsuccess({target:openReq});
      },0);
      return openReq;
    },
    _data:data
  };
  return {data,events};
}

/* In-memory Map standing in for a working IndexedDB behind the Storage
   adapter (Node has no indexedDB). Drives the durable-delete and wipe
   paths exactly as the browser does. */
function simulateIdb(sandbox){
  vm.runInContext(`
    (function(){
      const idbStore=new Map();
      Storage.idbGet=async function(k){return idbStore.has(k)?idbStore.get(k):null;};
      Storage.idbSet=async function(k,v){idbStore.set(k,String(v));return true;};
      Storage.idbDel=async function(k){idbStore.delete(k);return true;};
      Storage.backend='idb';
      Storage.probe=async function(){return 'idb';};
      Storage._idbStore=idbStore;
    })();
  `,sandbox);
}

const W1={id:'w1',name:'Squat day',exercises:[{id:'e1',sets:[{weight:135,reps:5}]}]};
const BLOB={version:1,savedAt:100,completed:[W1],templates:[],tags:[],
  exerciseTagPresets:[],archivedPrograms:[],customExercises:[],favorites:[]};

describe('#520: IDB writes and deletes resolve on transaction commit',()=>{
  it('idbDel resolves after the transaction commits, not on request success',async ()=>{
    const {sandbox}=loadPersistence({});
    const {events}=installFakeIndexedDb(sandbox);
    assert.equal(await vm.runInContext('Storage.probe()',sandbox),'idb');
    events.length=0; /* drop the probe's round-trip events */
    await vm.runInContext(`Storage.idbSet('k','v')`,sandbox);
    assert.deepEqual([...events],['req-success-put','tx-complete-put']);
    events.length=0;
    const p=vm.runInContext(
      `(async()=>{const ok=await Storage.idbDel('k');`+
      `window.__idbEvents.push(ok?'promise-resolved':'promise-resolved-false');})()`,sandbox);
    await p;
    /* The buggy code resolved here: ['req-success-del','promise-resolved',
       'tx-complete-del']. The fix must resolve only at commit. */
    assert.deepEqual([...events],
      ['req-success-del','tx-complete-del','promise-resolved'],
      'delete promise settles on transaction commit');
  });
  it('idbSet resolves after the transaction commits too',async ()=>{
    const {sandbox}=loadPersistence({});
    const {events}=installFakeIndexedDb(sandbox);
    assert.equal(await vm.runInContext('Storage.probe()',sandbox),'idb');
    events.length=0;
    const p=vm.runInContext(
      `(async()=>{const ok=await Storage.idbSet('k','v');`+
      `window.__idbEvents.push(ok?'promise-resolved':'promise-resolved-false');})()`,sandbox);
    await p;
    assert.deepEqual([...events],
      ['req-success-put','tx-complete-put','promise-resolved'],
      'write promise settles on transaction commit');
  });
});

describe('#520: deleteBlobDurable verifies and retries',()=>{
  it('retries once when the blob survives the first delete',async ()=>{
    const {sandbox}=loadPersistence({});
    simulateIdb(sandbox);
    vm.runInContext(`Storage._idbStore.set('k','v')`,sandbox);
    vm.runInContext(`(function(){
      Storage.idbDel=async function(k){
        window.__dels=(window.__dels||0)+1;
        if(window.__dels>=2)Storage._idbStore.delete(k);
        return true;
      };
    })()`,sandbox);
    assert.equal(await vm.runInContext(`Storage.deleteBlobDurable('k')`,sandbox),true);
    assert.equal(vm.runInContext(`window.__dels`,sandbox),2,'deleted on the retry');
    assert.equal(await vm.runInContext(`Storage.idbGet('k')`,sandbox),null,'blob gone');
  });
  it('reports false after two failed attempts',async ()=>{
    const {sandbox}=loadPersistence({});
    simulateIdb(sandbox);
    vm.runInContext(`Storage._idbStore.set('k','v')`,sandbox);
    vm.runInContext(`(function(){
      window.__dels=0;
      /* The #520 symptom: delete "succeeds" but never removes. */
      Storage.idbDel=async function(k){window.__dels++;return true;};
    })()`,sandbox);
    assert.equal(await vm.runInContext(`Storage.deleteBlobDurable('k')`,sandbox),false);
    assert.equal(vm.runInContext(`window.__dels`,sandbox),2,'exactly two attempts');
  });
  it('attempts the delete even when the memoized backend is localStorage (#520 retest)',async ()=>{
    /* Real-browser failure on v1.799: the probe is per-session. A session
       that fell back to localStorage skipped the IDB delete entirely, and
       the next boot resurrected the "deleted" blob. The durable delete must
       never consult the memoized probe. */
    const {sandbox}=loadPersistence({});
    simulateIdb(sandbox);
    vm.runInContext(`Storage._idbStore.set('k','v')`,sandbox);
    vm.runInContext(`(function(){
      Storage.backend='localStorage';
      Storage.probe=async function(){return 'localStorage';};
      window.__dels=0;
      const origDel=Storage.idbDel;
      Storage.idbDel=async function(k){window.__dels++;return origDel(k);};
    })()`,sandbox);
    assert.equal(await vm.runInContext(`Storage.deleteBlobDurable('k')`,sandbox),true);
    assert.equal(vm.runInContext(`window.__dels`,sandbox),1,'delete attempted despite the localStorage backend');
    assert.equal(await vm.runInContext(`Storage.idbGet('k')`,sandbox),null,'blob gone');
  });
  it('reports false (unverified) when IDB is unreachable — never success',async ()=>{
    /* v1.798 treated "cannot read back" (get → undefined) as success, so a
       wedged IDB skipped the fallback and boot resurrected the blob. */
    const {sandbox}=loadPersistence({});
    simulateIdb(sandbox);
    vm.runInContext(`(function(){
      window.__dels=0;
      Storage.idbDel=async function(k){window.__dels++;return false;};
      Storage.idbGet=async function(k){return undefined;};
    })()`,sandbox);
    assert.equal(await vm.runInContext(`Storage.deleteBlobDurable('k')`,sandbox),false);
    assert.equal(vm.runInContext(`window.__dels`,sandbox),1,'no pointless retry against an unreachable IDB');
  });
});

describe('#520: wipe falls back to a synchronous emptied localStorage copy',()=>{
  it('writes the emptied payload with a fresh savedAt when IDB will not delete',async ()=>{
    const {sandbox,store}=loadPersistence({});
    simulateIdb(sandbox);
    vm.runInContext(`Storage._idbStore.set('workout-app:v1',${JSON.stringify(JSON.stringify(BLOB))})`,sandbox);
    /* The #520 symptom: the IDB delete resolves but the blob survives. */
    vm.runInContext(`Storage.idbDel=async function(k){return true;};`,sandbox);
    await vm.runInContext('restorePersisted()',sandbox);
    assert.equal(vm.runInContext('workoutState.completed.length',sandbox),1,'state hydrated from the stale blob');
    /* wipeLocalUserData returns the durability promise the caller awaits
       before location.reload(). */
    await vm.runInContext('wipeLocalUserData()',sandbox);
    const lsRaw=store.get('workout-app:v1');
    assert.ok(lsRaw,'fallback wrote the emptied payload to localStorage');
    const d=JSON.parse(lsRaw);
    assert.deepEqual(d.completed,[],'fallback payload is the emptied state');
    assert.ok(Number(d.savedAt)>100,'fallback savedAt is fresh');
    /* Boot's newest-copy selection prefers the empty fallback over the
       stale IDB copy that refused to die. */
    const picked=vm.runInContext(
      `newerBlob(Storage._idbStore.get('workout-app:v1'),localStorage.getItem('workout-app:v1'))`,sandbox);
    assert.equal(picked,lsRaw,'empty fallback beats the resurrected IDB blob');
    assert.equal(vm.runInContext('workoutState.completed.length',sandbox),0,'in-memory state stayed empty');
  });
  it('kills a stale IDB blob even when the memoized backend is localStorage (#520 retest)',async ()=>{
    /* The real-browser v1.799 failure: this session runs on localStorage
       (probe failed) but an earlier session left a full blob in IDB. The
       wipe must delete it anyway — otherwise the next boot's successful
       probe resurrects everything. */
    const {sandbox,store}=loadPersistence({});
    simulateIdb(sandbox);
    vm.runInContext(`Storage._idbStore.set('workout-app:v1',${JSON.stringify(JSON.stringify(BLOB))})`,sandbox);
    vm.runInContext(`Storage.backend='localStorage';Storage.probe=async function(){return 'localStorage';};`,sandbox);
    await vm.runInContext('restorePersisted()',sandbox);
    assert.equal(vm.runInContext('workoutState.completed.length',sandbox),0,'localStorage backend boots empty (LS was clean)');
    /* The stale IDB blob is still there, waiting for the next boot. */
    assert.ok(vm.runInContext(`Storage._idbStore.has('workout-app:v1')`,sandbox),'stale IDB blob present pre-wipe');
    const durable=await vm.runInContext('wipeLocalUserData()',sandbox);
    assert.equal(durable,true,'IDB delete verified despite the localStorage backend');
    assert.equal(await vm.runInContext(`Storage.idbGet('workout-app:v1')`,sandbox),null,'stale IDB blob is gone');
    assert.equal(vm.runInContext('workoutState.completed.length',sandbox),0,'in-memory state stayed empty');
  });
});
