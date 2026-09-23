'use strict';
/* #414 (agent 2026-09-13): future-version persisted state must never be
   quarantined as corrupt — force a service-worker update check and prompt
   the user to reload instead. Past versions run the migration pipeline;
   only unreadable garbage is quarantined. Also pins that the writer stamps
   SCHEMA_VERSION (not a hardcoded 1) and that the persist hold keeps the
   autosave from clobbering a newer blob with this build's empty state.
   Follows the storage-reconciliation.test.js vm-sandbox pattern. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
const KEY='workout-app:v1';

function loadTab(initialRaw){
  const storageSrc=fs.readFileSync(path.join(ROOT,'assets/js/core/storage.js'),'utf8');
  const src=fs.readFileSync(path.join(ROOT,'assets/js/core/persistence.js'),'utf8');
  const store=initialRaw!=null?{[KEY]:initialRaw}:{};
  const dialogs={
    future:{open:false,shown:0,closed:0,showModal(){this.open=true;this.shown++;},close(){this.open=false;this.closed++;}},
    corrupt:{open:false,shown:0,close(){this.open=false;},showModal(){this.open=true;this.shown=(this.shown||0)+1;}},
  };
  const swCalls={update:0,getRegistration:0};
  const sandbox={
    window:{addEventListener(){},removeEventListener(){}},
    navigator:{
      serviceWorker:{
        async getRegistration(){swCalls.getRegistration++;return {update:async()=>{swCalls.update++;}};},
      },
    },
    localStorage:{
      getItem(k){return Object.prototype.hasOwnProperty.call(store,k)?store[k]:null;},
      setItem(k,v){store[k]=String(v);},
      removeItem(k){delete store[k];},
    },
    $(sel){return sel==='#futureVersionDialog'?dialogs.future:sel==='#corruptDataDialog'?dialogs.corrupt:null;},
    setTimeout(){return 0;},
    clearTimeout(){},
    setInterval(){return 0;},
    clearInterval(){},
    cloneWorkoutTemplates(){return [];},
    DEFAULT_SET_TAGS:[],
    DEFAULT_EXERCISE_TAG_PRESETS:[],
    document:{},
    workoutState:{completed:[],templates:[],tags:[],exerciseTagPresets:[],draft:null,activeProgram:null,archivedPrograms:[]},
    state:{customExercises:[],favorites:new Set(),savedBuilder:null,dashboardPeriod:'week',statsPeriod:'week',logPeriod:'week',topExercisesMode:'x',savedFilter:{muscles:[],inProgram:false}},
    progressionSetup:{},
  };
  vm.createContext(sandbox);
  vm.runInContext(storageSrc,sandbox,{filename:'storage.js'});
  vm.runInContext(src,sandbox,{filename:'persistence.js'});
  const api={
    store,dialogs,swCalls,sandbox,
    restore(){return vm.runInContext('restorePersisted()',sandbox);},
    persist(){return vm.runInContext('persistNow()',sandbox);},
    eval(expr){return vm.runInContext(expr,sandbox);},
    blob(){const raw=store[KEY];return raw?JSON.parse(raw):null;},
    quarantined(){return Object.keys(store).some(k=>k.startsWith(KEY+':corrupt-'));},
  };
  return api;
}

const W1={id:'workout-1',name:'W1',exercises:[]};
/* vm-realm arrays fail strict deepEqual against host literals — round-trip
   through JSON so both sides are host-realm. */
const completedIds=tab=>JSON.parse(tab.eval('JSON.stringify(workoutState.completed.map(w=>w.id))'));
function blob(version,extra){
  return JSON.stringify(Object.assign(
    {version,savedAt:100,completed:[W1],templates:[],archivedPrograms:[],customExercises:[],tags:[],exerciseTagPresets:[],favorites:[]},
    extra||{}));
}

describe('#414 future-version persisted state',()=>{
  it('a newer-version blob is never quarantined — update check fires and the reload prompt shows',async ()=>{
    const tab=loadTab(blob(2));
    await tab.restore();
    assert.equal(tab.quarantined(),false,'no quarantine key written');
    assert.equal(tab.swCalls.getRegistration,1,'service-worker registration fetched');
    assert.equal(tab.swCalls.update,1,'reg.update() forced');
    assert.equal(tab.dialogs.future.shown,1,'future-version dialog shown');
    assert.equal(tab.dialogs.corrupt.shown||0,0,'corrupt dialog not shown');
    assert.equal(tab.blob().version,2,'blob left untouched on disk');
    assert.deepEqual(completedIds(tab),[],'boots to empty state behind the modal');
  });
  it('the persist hold stops the autosave from clobbering the newer blob',async ()=>{
    const tab=loadTab(blob(2));
    await tab.restore();
    assert.equal(await tab.persist(),false,'persistNow refuses while held');
    assert.equal(tab.blob().version,2,'newer blob still intact after a persist attempt');
    assert.deepEqual(JSON.parse(JSON.stringify(tab.blob().completed.map(w=>w.id))),['workout-1']);
  });
  it('a current-version blob restores normally with no prompt and no update check',async ()=>{
    const tab=loadTab(blob(1));
    await tab.restore();
    assert.deepEqual(completedIds(tab),['workout-1']);
    assert.equal(tab.quarantined(),false);
    assert.equal(tab.dialogs.future.shown,0,'no future-version prompt');
    assert.equal(tab.swCalls.update,0,'no forced update check');
    assert.equal(await tab.persist(),true,'writes flow normally');
  });
  it('a past-version blob runs migrations and hydrates instead of quarantining',async ()=>{
    const tab=loadTab(blob(0));
    await tab.restore();
    assert.equal(tab.quarantined(),false,'past versions are not quarantined');
    assert.deepEqual(completedIds(tab),['workout-1'],'state hydrates');
    assert.equal(tab.dialogs.future.shown,0);
  });
  it('unparseable garbage is still quarantined, with no update check',async ()=>{
    const tab=loadTab('not-json{{{');
    await tab.restore();
    assert.equal(tab.quarantined(),true,'garbage quarantined as before');
    assert.equal(tab.swCalls.update,0,'no update check for garbage');
    assert.equal(tab.dialogs.future.shown,0);
  });
  it('valid JSON that is not an object is quarantined, not treated as a version',async ()=>{
    const tab=loadTab('42');
    await tab.restore();
    assert.equal(tab.quarantined(),true);
    assert.equal(tab.swCalls.update,0);
    const tab2=loadTab('"just a string"');
    await tab2.restore();
    assert.equal(tab2.quarantined(),true);
  });
  it('the writer stamps SCHEMA_VERSION, not a hardcoded 1',()=>{
    const tab=loadTab(null);
    assert.equal(tab.eval('collectPersistable().version'),tab.eval('SCHEMA_VERSION'));
    assert.equal(tab.eval('SCHEMA_VERSION'),1,'schema is still 1 today');
  });
});
