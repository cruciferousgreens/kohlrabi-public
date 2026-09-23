'use strict';
/* #351 (user 2026-09-14): update-reload route restore. stashRouteForUpdateReload
   records the workout-tab sub-screen in sessionStorage before an update Refresh /
   future-version Reload; restoreRouteAfterUpdateReload (called once by
   app-bootstrap.js) consumes the stash and re-opens the sub-screen. A saved
   workout that no longer exists is dropped, never resurrected. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const store=new Map();
globalThis.sessionStorage={
  getItem:(k)=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)),
  removeItem:(k)=>store.delete(k),
  clear:()=>store.clear(),
};
let shownWith=null;
globalThis.showWorkouts=(a,b)=>{shownWith=[a,b];};

const {
  stashRouteForUpdateReload, restoreRouteAfterUpdateReload, state, workoutState,
}=loadRole('route-restore');

function readStash(){return JSON.parse(sessionStorage.getItem('cg-post-update-route'));}
beforeEach(()=>{
  store.clear(); shownWith=null;
  Object.assign(state,{activeView:'dashboard',workoutEditorOpen:false,builderOpen:false,
    savedWorkoutId:null,workoutHistoryOpen:false,savedBuilder:null});
  workoutState.draft=null; workoutState.templates=[];
});

describe('#351 stash before update reload',()=>{
  it('records the live editor sub-screen',()=>{
    Object.assign(state,{activeView:'workout',workoutEditorOpen:true});
    workoutState.draft={exercises:[]};
    stashRouteForUpdateReload();
    assert.deepEqual(readStash(),{view:'workout',workoutEditorOpen:true,builderOpen:false,
      savedWorkoutId:null,workoutHistoryOpen:false});
  });
  it('does not claim the editor when the draft is gone',()=>{
    Object.assign(state,{activeView:'workout',workoutEditorOpen:true});
    workoutState.draft=null;
    stashRouteForUpdateReload();
    assert.equal(readStash().workoutEditorOpen,false);
  });
  it('records builder, saved-workout id, and log list',()=>{
    Object.assign(state,{activeView:'workout',builderOpen:true,savedBuilder:{},
      savedWorkoutId:'t1',workoutHistoryOpen:true});
    stashRouteForUpdateReload();
    const s=readStash();
    assert.equal(s.builderOpen,true);
    assert.equal(s.savedWorkoutId,'t1');
    assert.equal(s.workoutHistoryOpen,true);
  });
});

describe('#351 restore after update reload',()=>{
  it('re-opens the builder and consumes the stash',()=>{
    sessionStorage.setItem('cg-post-update-route',JSON.stringify(
      {view:'workout',workoutEditorOpen:false,builderOpen:true,savedWorkoutId:null,workoutHistoryOpen:false}));
    restoreRouteAfterUpdateReload(null);
    assert.equal(state.builderOpen,true);
    assert.deepEqual(shownWith,[false,true],'showWorkouts(false,true)');
    assert.equal(sessionStorage.getItem('cg-post-update-route'),null,'stash consumed');
  });
  it('keeps a saved-workout id that still exists',()=>{
    workoutState.templates=[{id:'t1',name:'Legs'}];
    sessionStorage.setItem('cg-post-update-route',JSON.stringify(
      {view:'workout',workoutEditorOpen:false,builderOpen:false,savedWorkoutId:'t1',workoutHistoryOpen:false}));
    restoreRouteAfterUpdateReload(null);
    assert.equal(state.savedWorkoutId,'t1');
    assert.deepEqual(shownWith,[false,true]);
  });
  it('drops a saved-workout id that no longer exists',()=>{
    workoutState.templates=[];
    sessionStorage.setItem('cg-post-update-route',JSON.stringify(
      {view:'workout',workoutEditorOpen:false,builderOpen:false,savedWorkoutId:'gone',workoutHistoryOpen:false}));
    restoreRouteAfterUpdateReload(null);
    assert.equal(state.savedWorkoutId,null);
    assert.equal(shownWith,null,'nothing to restore — no navigation');
    assert.equal(sessionStorage.getItem('cg-post-update-route'),null,'stash consumed');
  });
  it('ignores non-workout views',()=>{
    sessionStorage.setItem('cg-post-update-route',JSON.stringify(
      {view:'stats',workoutEditorOpen:false,builderOpen:false,savedWorkoutId:null,workoutHistoryOpen:true}));
    restoreRouteAfterUpdateReload(null);
    assert.equal(state.workoutHistoryOpen,false);
    assert.equal(shownWith,null);
  });
  it('does not restore during a share boot',()=>{
    sessionStorage.setItem('cg-post-update-route',JSON.stringify(
      {view:'workout',workoutEditorOpen:false,builderOpen:true,savedWorkoutId:null,workoutHistoryOpen:false}));
    restoreRouteAfterUpdateReload({type:'hash'});
    assert.equal(state.builderOpen,false);
    assert.equal(shownWith,null);
  });
});
