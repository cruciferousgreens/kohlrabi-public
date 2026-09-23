'use strict';
/* #434: finishing a program workout lands on the completed log (user
   2026-09-12 decision — never regressed), but Back from that log returns
   to the Program page, not the Workout tab — the program context survives.
   Source-level pins (the finish flow needs a full DOM to run). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const hist=fs.readFileSync(path.join(ROOT,'assets/js/workout/workout-history.js'),'utf8');
const nav=fs.readFileSync(path.join(ROOT,'assets/js/core/navigation.js'),'utf8');
const finishFn=hist.slice(hist.indexOf('function finishWorkout('));

describe('#434 program finish keeps program-context Back',()=>{
  it('a brand-new program-workout finish records the PROGRAM return',()=>{
    assert.ok(finishFn.includes('draft.programId?ROUTES.DETAIL_RETURN.PROGRAM:ROUTES.DETAIL_RETURN.WORKOUT'),
      'finish picks PROGRAM when the draft was a program workout');
  });
  it('a brand-new non-program finish still records the WORKOUT return',()=>{
    assert.ok(finishFn.includes('if(!draft.editingId)state.workoutDetailReturn='),
      'the return is only reset on brand-new finishes');
    assert.ok(/ROUTES\.DETAIL_RETURN\.WORKOUT; persistNow/.test(finishFn),
      'the WORKOUT fallback is the non-program branch of the ternary');
  });
  it('an edit-finish keeps the recorded return (#275 untouched)',()=>{
    const line=finishFn.split('\n').find(l=>l.includes('if(!draft.editingId)state.workoutDetailReturn='));
    assert.ok(line&&line.includes('if(!draft.editingId)'),
      'the return assignment stays guarded so edit-finishes keep the list/wherever return');
  });
  it('the finish still lands on the completed log first (user 2026-09-12)',()=>{
    assert.ok(/renderCompletedWorkout\(completed\); renderProgram\(\);/.test(finishFn),
      'finish renders the completed log before the program re-render');
    assert.ok(!/renderCompletedWorkout\(completed\)[\s\S]{0,80}showProgram\(\)/.test(finishFn),
      'no immediate showProgram() call covers the just-finished log');
  });
  it('the PROGRAM return route actually shows the program page',()=>{
    assert.ok(nav.includes('[ROUTES.DETAIL_RETURN.PROGRAM]:()=>showProgram(false)'),
      'backFromWorkoutDetail routes the PROGRAM return to showProgram(false)');
  });
  it('backFromWorkoutDetail honors the recorded return',()=>{
    assert.ok(nav.includes('function backFromWorkoutDetail()'),
      'the top-bar chevron routes through backFromWorkoutDetail');
    assert.ok(nav.includes('returnRouteKey(state.workoutDetailReturn)'),
      'the recorded return is what the chevron follows');
  });
});
