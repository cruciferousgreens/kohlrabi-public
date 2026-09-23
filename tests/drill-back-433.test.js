'use strict';
/* Drill-back audit (user 2026-09-14): Back from a drilled-in view must return
   to the view the user came from, not the tab home.
   - Shared-program page → workout drill → Back chevron/system Back returns to
     the program card (the reported bug: it landed on the workout tab).
   - Workout sub-screen (live editor, builder, saved editor) → exercise detail
     → Back returns to that sub-screen (the pushed-detail path dropped it on
     the workout start screen while the in-app path restored it).
   - #432 pin: the shared-program Share control is the standard icon-button
     Share used elsewhere (#240), not a bare icon. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const shareSrc=fs.readFileSync(path.join(ROOT,'assets/js/share/share.js'),'utf8');
const bootstrapSrc=fs.readFileSync(path.join(ROOT,'assets/js/core/app-bootstrap.js'),'utf8');

describe('shared-program drill Back returns to the program card',()=>{
  it('backOutOfSharePreview returns a drill sentinel for drilled-in workouts',()=>{
    const fn=shareSrc.slice(shareSrc.indexOf('function backOutOfSharePreview(){'));
    assert.ok(fn.includes("return 'drill'"),
      'drill branch returns the drill sentinel (not a plain true the router would ignore)');
  });
  it('the drill sentinel still counts as handled for the chevron fallback',()=>{
    const fn=shareSrc.slice(shareSrc.indexOf('function backOutOfSharePreview(){'));
    assert.ok(fn.includes("if(!state.sharePreview)return false;"),
      'no-preview still returns false');
    assert.ok(fn.includes('state.sharePreview._drillParent'),
      'drill detection keys off _drillParent');
  });
  it('popstate stops routing once the drill-back restored the program card',()=>{
    const pop=bootstrapSrc.slice(bootstrapSrc.indexOf("window.addEventListener('popstate'"));
    const stopAt=pop.indexOf("if(backOutOfSharePreview()==='drill')return;");
    assert.ok(stopAt!==-1,'popstate early-returns on the drill sentinel');
    const routeAt=pop.indexOf("e.state?.view === 'workout') showWorkouts(false);");
    assert.ok(stopAt<routeAt || routeAt===-1,
      'the early return sits before the workout-tab routing that used to swallow the drill-back');
  });
  it('the drill still pushes its own history entry so system Back reaches it',()=>{
    assert.ok(shareSrc.includes("sub:'share-drill'"),
      'openSharedProgramWorkout pushes a share-drill entry');
  });
});

describe('exercise-detail Back restores the workout sub-screen',()=>{
  it('popstate restores editor/builder/saved sub-screens from the detail return',()=>{
    const pop=bootstrapSrc.slice(bootstrapSrc.indexOf("window.addEventListener('popstate'"));
    assert.ok(pop.includes("exRet.sub==='editor'&&!!workoutState.draft"),
      'editor restored when a draft is live');
    assert.ok(pop.includes("exRet.sub==='builder'&&!!state.savedBuilder"),
      'builder restored when a builder draft is live');
    assert.ok(pop.includes("exRet.sub==='saved'?(exRet.savedWorkoutId||null):null"),
      'saved editor restored with its template id');
    assert.ok(pop.includes('showWorkouts(false,true)'),
      'restored with keepSub so the sub-screen survives');
  });
  it('the detail return is consumed so a closed sub-screen cannot resurrect',()=>{
    const pop=bootstrapSrc.slice(bootstrapSrc.indexOf("window.addEventListener('popstate'"));
    const branch=pop.slice(pop.indexOf('workout') ,pop.indexOf('workout')+200);
    assert.ok(pop.includes('state.exerciseDetailReturn=null;'),
      'popstate consumes the return after restoring');
  });
  it('a bare return (no sub) still lands on the workout start screen',()=>{
    const pop=bootstrapSrc.slice(bootstrapSrc.indexOf("window.addEventListener('popstate'"));
    assert.ok(pop.includes("exRet.sub!=='start'"),
      'start-screen returns fall through to the plain tab route');
  });
});

describe('#432: shared-program Share is the standard Share button',()=>{
  it('uses the icon-button class with the #240 upload-arrow artwork',()=>{
    assert.ok(shareSrc.includes('class=\"icon-button\" data-share-act=\"shareProgram\"'),
      'program Share is the standard icon-button, not a bare icon');
    assert.ok(shareSrc.includes('aria-label=\"Share this program\"'),
      'program Share is labeled');
  });
  it('sits left of the green Start button in the program header',()=>{
    assert.ok(shareSrc.includes('shareProgramBtn+programStartBtn'),
      'program header renders Share then Start');
  });
});
