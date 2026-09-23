'use strict';
/* #398 (user 2026-09-13): tapping "increase reps only" on a progression card
   must do the surgical in-place card swap (same as the #334 Reps/Seconds
   toggle) instead of the full renderWorkoutExercises() rebuild, which
   destroyed the tapped toggle (focus dropped to <body> — an iOS scroll cue)
   and re-ran card animations.

   Mechanism pin: repsOnlyAfterChange with a findable card swaps the card
   (replaceWith), restores focus to the toggle, recomputes suggestions, and
   never calls the full render (observed via window.scrollTo, which only the
   full render calls). With no findable card it falls back to the full render.
   Role: workout-screen-logic — workout-editor.js loads clean under the stub
   DOM. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const prepCalls=[];
const progCalls=[];
const scrollToCalls=[];
const scrollByCalls=[];
const focusCalls=[];
let replaceCount=0;
let cardPresent=true;

const fakeCard={
  getBoundingClientRect:()=>({top:100}),
  replaceWith(){replaceCount++;},
  querySelectorAll:()=>[],
  querySelector:()=>null,
};
const fakeToggle={focus(opts){focusCalls.push(opts||{});}};
const fakeNewCard={
  getBoundingClientRect:()=>({top:100}),
  querySelectorAll:()=>[],
  querySelector:sel=>String(sel).includes('data-reps-only-toggle')?fakeToggle:null,
};
const fakeHost={
  _html:'',set innerHTML(v){this._html=String(v);},get innerHTML(){return this._html;},
  querySelectorAll:()=>[],querySelector:()=>null,style:{},addEventListener(){},
};
const fakeDoc={
  querySelector(sel){
    if(String(sel).startsWith('[data-workout-exercise'))return cardPresent?fakeCard:null;
    if(sel==='#workoutExercises')return fakeHost;
    if(sel==='#reorderWorkoutExercises')return {style:{}};
    return null;
  },
  querySelectorAll:()=>[],
  createElement(){
    /* swapExerciseCard builds the fresh card via tmp.innerHTML; the
       exerciseId is unknown to the fixture catalog so the real
       liveExerciseCardHtml bails to '' — firstElementChild is stubbed. */
    return {set innerHTML(v){},get firstElementChild(){return fakeNewCard;}};
  },
  addEventListener(){},removeEventListener(){},
  body:{},documentElement:{scrollHeight:2000},
};
const fakeWin={
  scrollY:120,innerHeight:852,
  scrollTo(...a){scrollToCalls.push(a);},
  scrollBy(...a){scrollByCalls.push(a);},
  addEventListener(){},removeEventListener(){},
  location:{href:'http://localhost/'},
};

const role=loadRole('workout-screen-logic',{globals:{
  document:fakeDoc,window:fakeWin,
  exercises:[{id:'bench-press',name:'Barbell Bench Press',equipment:'barbell'}],
  getExerciseLogs:()=>[],
  /* progression.js is outside this role — the recompute is a no-op here. */
  prepareDraftProgression(){prepCalls.push(1);},
  freeformProgressionConfig(){return {threshold:8};},
  programWeek(){return 1;},
  renderWorkoutProgression(){progCalls.push(1);},
  schedulePersist(){},
}});
const {repsOnlyAfterChange,workoutState}=role;

const mkItem=()=>({uid:'u1',exerciseId:'unknown-ex',sets:[],progression:{repsOnly:false}});
beforeEach(()=>{
  prepCalls.length=0;progCalls.length=0;scrollToCalls.length=0;
  scrollByCalls.length=0;focusCalls.length=0;replaceCount=0;
  cardPresent=true;
  workoutState.draft={programId:null,exercises:[mkItem()]};
  workoutState.activeProgram=null;
});

describe('repsOnlyAfterChange (#398)',()=>{
  it('swaps the card in place instead of the full re-render',()=>{
    repsOnlyAfterChange(mkItem());
    assert.equal(prepCalls.length,1,'suggestions are still recomputed');
    assert.equal(replaceCount,1,'the affected card is swapped in place');
    assert.equal(progCalls.length,1,'the progression strip re-renders');
    assert.equal(scrollToCalls.length,0,'no full-render scroll reset');
    assert.equal(scrollByCalls.length,0,'no scroll nudge (card stayed pinned)');
  });
  it('restores focus to the tapped toggle without a scroll cue',()=>{
    repsOnlyAfterChange(mkItem());
    assert.equal(focusCalls.length,1,'the reps-only toggle is re-focused');
    assert.equal(focusCalls[0].preventScroll,true,'focus does not scroll');
  });
  it('falls back to the full render when the card cannot be found',()=>{
    cardPresent=false;
    repsOnlyAfterChange(mkItem());
    assert.equal(replaceCount,0,'no swap possible');
    assert.equal(scrollToCalls.length,1,'full render restores scroll');
    assert.deepEqual(scrollToCalls[0],[0,120],'scroll returns to the pre-render position');
    assert.equal(progCalls.length,1,'the progression strip still re-renders');
  });
});
