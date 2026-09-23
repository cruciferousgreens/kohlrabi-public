'use strict';
/* #312 (user 2026-09-12/13): adding a saved workout to a program must not
   duplicate it in the saved-workout list. The v1.032 dedup hides program
   shells whose sourceTemplateId matches a live template; shells created
   before v1.032 carry no sourceTemplateId, so a boot migration backfills
   the link where a shell uniquely matches a live template by name +
   exercise structure. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
const savedJs=fs.readFileSync(path.join(ROOT,'assets/js/pages/saved-workouts.js'),'utf8');

function loadPersistence(){
  const src=fs.readFileSync(path.join(ROOT,'assets/js/core/persistence.js'),'utf8');
  const store={};
  const sandbox={
    window:{addEventListener(){}},
    localStorage:{
      getItem(k){return Object.prototype.hasOwnProperty.call(store,k)?store[k]:null;},
      setItem(k,v){store[k]=String(v);},
      removeItem(k){delete store[k];},
      key(i){return Object.keys(store)[i]||null;},
      get length(){return Object.keys(store).length;},
    },
    $(){return null;},
    setTimeout(){return 0;},clearTimeout(){},
    setInterval(){return 0;},clearInterval(){},
    cloneWorkoutTemplates(){return [];},
    DEFAULT_SET_TAGS:[],DEFAULT_EXERCISE_TAG_PRESETS:[],
    document:{},
    'ADOPTED_UID_KEY':'adopted-uid',
    workoutState:{completed:[],templates:[],tags:[],exerciseTagPresets:[],draft:null,activeProgram:null,archivedPrograms:[]},
    state:{customExercises:[],favorites:new Set(),muscles:new Set(),savedBuilder:null},
    exercises:[],
    progressionSetup:{},
    resetProgressionSetup(){},
  };
  vm.createContext(sandbox);
  vm.runInContext(src,sandbox,{filename:'persistence.js'});
  return sandbox;
}
function blob(){
  return {version:1,
    templates:[
      {id:'t1',name:'Push Day',exercises:[{exerciseId:'bench',sets:[{},{},{}]},{exerciseId:'ohp',sets:[{},{}]}]},
      {id:'t3',name:'Pull Day',exercises:[{exerciseId:'row',sets:[{},{}]}]},
    ],
    activeProgram:{name:'P',workouts:[
      {uid:'w2',name:'Pull Day',template:{name:'Pull Day',exercises:[{exerciseId:'row',sets:[{r:'10'},{r:'10'}]}]}},
    ]},
    archivedPrograms:[],
  };
}

describe('#312 programShellCoveredByTemplate predicate',()=>{
  it('a shell linked to a live template is covered',()=>{
    const m=savedJs.match(/function programShellCoveredByTemplate\(workout,liveTemplateIds\)\{([\s\S]*?)\n    \}/);
    assert.ok(m,'predicate found');
    assert.ok(/workout\.sourceTemplateId&&liveTemplateIds\.has\(workout\.sourceTemplateId\)/.test(m[1]),
      'covers exactly the linked-and-live case');
  });
  it('the list render skips covered shells, keeps program-only ones',()=>{
    const m=savedJs.match(/\(program\?\.workouts\|\|\[\]\)\.forEach\(w=>\{([\s\S]*?)\n      \}\);/);
    assert.ok(m,'program-workout loop found');
    assert.ok(m[1].includes('if(programShellCoveredByTemplate(w,liveTemplateIds))return;'),
      'covered shells return before pushing a card');
    assert.ok(m[1].includes("items.push({kind:'program'"),'other shells still push cards');
  });
});

describe('#312 migration backfills sourceTemplateId for legacy shells',()=>{
  it('links a shell that uniquely matches a live template',()=>{
    const sb=loadPersistence();
    sb.data=blob();
    vm.runInContext('runBlobMigrations(data)',sb);
    assert.equal(sb.data.activeProgram.workouts[0].sourceTemplateId,'t3');
  });
  it('ignores edited set values — structure is what matters',()=>{
    const sb=loadPersistence();
    sb.data=blob(); /* w2's sets carry r:'10' values; t3's are empty — still links */
    vm.runInContext('runBlobMigrations(data)',sb);
    assert.equal(sb.data.activeProgram.workouts[0].sourceTemplateId,'t3');
  });
  it('leaves ambiguous matches alone (two templates, same name+structure)',()=>{
    const sb=loadPersistence();
    const d=blob();
    d.templates.push({id:'t4',name:'Pull Day',exercises:[{exerciseId:'row',sets:[{},{}]}]});
    sb.data=d;
    vm.runInContext('runBlobMigrations(data)',sb);
    assert.ok(!sb.data.activeProgram.workouts[0].sourceTemplateId,'no link on ambiguity');
  });
  it('never links past-session shells or already-linked shells',()=>{
    const sb=loadPersistence();
    const d=blob();
    d.activeProgram.workouts.push(
      {uid:'w4',name:'Custom',sourceWorkoutId:'log1',template:{name:'Custom',exercises:[]}},
      {uid:'w5',name:'Push Day',sourceTemplateId:'t9',template:{name:'Push Day',exercises:[{exerciseId:'bench',sets:[{},{},{}]},{exerciseId:'ohp',sets:[{},{}]}]}},
    );
    sb.data=d;
    vm.runInContext('runBlobMigrations(data)',sb);
    assert.ok(!d.activeProgram.workouts[1].sourceTemplateId,'past-session shell untouched');
    assert.equal(d.activeProgram.workouts[2].sourceTemplateId,'t9','existing link kept');
  });
  it('archived templates never match; archived programs still link',()=>{
    const sb=loadPersistence();
    const d=blob();
    d.templates.push({id:'t5',name:'Legs',exercises:[{exerciseId:'squat',sets:[{}]}],archivedAt:'2026-01-01'});
    d.activeProgram.workouts.push({uid:'w6',name:'Legs',template:{name:'Legs',exercises:[{exerciseId:'squat',sets:[{}]}]}});
    d.archivedPrograms=[{name:'Old',workouts:[{uid:'w7',name:'Pull Day',template:{name:'Pull Day',exercises:[{exerciseId:'row',sets:[{},{}]}]}}]}];
    sb.data=d;
    vm.runInContext('runBlobMigrations(data)',sb);
    assert.ok(!d.activeProgram.workouts[1].sourceTemplateId,'archived template does not link');
    assert.equal(d.archivedPrograms[0].workouts[0].sourceTemplateId,'t3','archived-program shell links');
  });
  it('is idempotent — a second run changes nothing',()=>{
    const sb=loadPersistence();
    sb.data=blob();
    vm.runInContext('runBlobMigrations(data)',sb);
    vm.runInContext('runBlobMigrations(data)',sb);
    assert.equal(sb.data.activeProgram.workouts[0].sourceTemplateId,'t3');
  });
});
