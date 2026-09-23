'use strict';
/* #543 (user 2026-09-17): Back from an exercise detail drilled in from the
   live workout editor could return to a mostly blank screen with only a
   sliver of a set row visible (iPhone Safari; desktop Chromium never
   reproduced it). Strongest theory: the browser's native history scroll
   restoration ('auto') raced the app's manual restoreScroll() on
   history.back(), and the loser parked the viewport outside the content —
   which iOS Safari renders as blank with the content edge peeking through.
   The fix takes restoration fully manual and clamps every manual restore to
   the live document range, so no return path can leave the viewport stranded.
   Pins: scrollRestoration='manual' at boot; restoreScroll() clamps
   out-of-range slots to [0, max]; the system-Back-to-completed-log branch
   scrolls explicitly now that the native pass is off. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');
const {makeStubs}=require('./stubs');

const ROOT=path.resolve(__dirname,'..');
const bootstrapSrc=fs.readFileSync(path.join(ROOT,'assets/js/core/app-bootstrap.js'),'utf8');
const utilitiesSrc=fs.readFileSync(path.join(ROOT,'assets/js/lib/utilities.js'),'utf8');

/* One shared rig: the loaded sources read bare window/document, so mutating
   these stub objects between tests re-aims the same loaded functions. */
const stubs=makeStubs();
const scrollCalls=[];
stubs.window.scrollTo=(arg)=>{scrollCalls.push(arg&&typeof arg==='object'?arg.top:arg);};
const role=loadRole('utilities',{globals:{window:stubs.window,document:stubs.document}});
/* Simulate the live editor: several exercises, draft present. */
role.workoutState.draft={exercises:[{sets:[{}]},{sets:[{}]},{sets:[{}]}]};

function restoreAt({scrollHeight,savedY,slot='workout:editor',innerHeight=852}){
  scrollCalls.length=0;
  stubs.window.innerHeight=innerHeight;
  stubs.document.documentElement.scrollHeight=scrollHeight;
  for(const k of Object.keys(role.state.scroll))role.state.scroll[k]=0;
  role.state.scroll[slot]=savedY;
  role.restoreScroll('workout');
  assert.equal(scrollCalls.length,1,'restoreScroll issues exactly one scrollTo');
  return scrollCalls[0];
}

describe('#543: native scroll restoration is disabled',()=>{
  it("boot sets history.scrollRestoration='manual'",()=>{
    assert.ok(bootstrapSrc.includes("history.scrollRestoration='manual'"),
      'app-bootstrap.js takes scroll restoration manual');
  });
  it('the manual switch is guarded so old browsers cannot throw at boot',()=>{
    const i=bootstrapSrc.indexOf("history.scrollRestoration='manual'");
    assert.ok(bootstrapSrc.slice(Math.max(0,i-10),i).includes('try{'),
      'the assignment sits inside try/catch');
  });
  it('the switch is documented as the #543 race fix',()=>{
    assert.ok(bootstrapSrc.includes('#543'),
      'the change carries its issue marker');
  });
});

describe('#543: restoreScroll clamps to the live document',()=>{
  it('a slot saved past the content clamps to the bottom, not past it',()=>{
    /* Saved 5000 against a taller layout (e.g. the detail page's); the
       editor is only 2000 tall in an 852 viewport -> max 1148. */
    assert.equal(restoreAt({scrollHeight:2000,savedY:5000}),1148);
  });
  it('a negative slot clamps to the top',()=>{
    assert.equal(restoreAt({scrollHeight:2000,savedY:-1400}),0);
  });
  it('a valid saved position passes through untouched',()=>{
    assert.equal(restoreAt({scrollHeight:2000,savedY:400}),400);
  });
  it('an empty slot lands at the top',()=>{
    assert.equal(restoreAt({scrollHeight:2000,savedY:0}),0);
  });
  it('a short document shorter than the viewport clamps to zero',()=>{
    assert.equal(restoreAt({scrollHeight:500,savedY:300}),0);
  });
  it('the editor return reads the editor slot while a draft is live',()=>{
    assert.equal(role.scrollKeyFor('workout'),'workout:editor');
    assert.equal(restoreAt({scrollHeight:3000,savedY:250,slot:'workout:editor'}),250);
  });
});

describe('#543: system Back to a completed log still lands at top',()=>{
  it('the popstate completed branch scrolls explicitly (native pass is off)',()=>{
    const pop=bootstrapSrc.slice(bootstrapSrc.indexOf("window.addEventListener('popstate'"));
    assert.ok(pop.includes("renderCompletedWorkout(w); window.scrollTo({top:0,behavior:'auto'});"),
      'completed-log restore scrolls to top like finishWorkout does');
  });
  it('restoreScroll itself clamps rather than trusting the slot',()=>{
    assert.ok(utilitiesSrc.includes('Math.min(Math.max(0,want),max)'),
      'utilities.js restoreScroll clamps the wanted position into [0, max]');
  });
});
