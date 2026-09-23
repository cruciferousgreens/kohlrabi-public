'use strict';
/* v1.883 item 23 (user-reported 2026-09-22, from his workout screenshot):
   the per-exercise RPE trigger pills did not render for TIME-based
   exercises — the render was gated on (scheme === 'rpe' && !time). But the
   engine DOES gate timed-exercise progression on the threshold
   (progression.js: "Top set was at or below RPE ${threshold}; add
   ${secJump} seconds"), resolving it per-exercise from profile.threshold.
   The UI hid a control the engine actually uses, so a timed exercise could
   never have its trigger changed from Exercise options. The !time
   exclusion is removed; the pills render for timed RPE-scheme exercises. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const role=loadRole('exercise-math',{globals:{exercises:[
  {id:'plank',name:'Plank',tracking:'time',primary:['core']},
],
/* getExerciseLogs lives in exercise-library.js, outside this role — the
   pills render on the no-history "why" path, so an empty log list is the
   right fixture. */
getExerciseLogs:()=>[]}});
const indirectEval=eval;
const progressionSummaryForOptions=indirectEval('progressionSummaryForOptions');

function timedItem(overrides={}){
  return Object.assign({
    uid:'u-plank-1',
    exerciseId:'plank',
    progression:{mode:'time',scheme:'rpe',threshold:8,timeMin:30,timeMax:60},
  },overrides);
}

describe('per-exercise RPE trigger pills for timed exercises (v1.883#23)',()=>{
  it('renders the trigger pills for a timed exercise with scheme rpe',()=>{
    const html=progressionSummaryForOptions(timedItem());
    assert.ok(html.includes('prog-threshold-row'),'threshold row renders');
    assert.ok(html.includes('RPE trigger'),'RPE trigger label renders');
    for(const v of ['7','8','9','completion']){
      assert.ok(html.includes(`data-ex-threshold="${v}"`),`threshold choice ${v} renders`);
    }
  });
  it('marks the exercise-level threshold as pressed',()=>{
    const html=progressionSummaryForOptions(timedItem({progression:{mode:'time',scheme:'rpe',threshold:9,timeMin:30,timeMax:60}}));
    assert.ok(html.includes('data-ex-threshold="9" data-ex-threshold-uid="u-plank-1" aria-pressed="true"'),'threshold 9 is pressed');
    assert.ok(html.includes('data-ex-threshold="8" data-ex-threshold-uid="u-plank-1" aria-pressed="false"'),'threshold 8 is not pressed');
  });
  it('still renders the pills for non-timed RPE exercises (no regression)',()=>{
    const html=progressionSummaryForOptions({
      uid:'u-squat-1',exerciseId:'plank',
      progression:{mode:'reps',scheme:'rpe',threshold:8,min:6,max:12},
    });
    assert.ok(html.includes('prog-threshold-row'),'threshold row still renders for rep-based RPE');
  });
  it('still hides the pills for non-RPE schemes',()=>{
    const html=progressionSummaryForOptions(timedItem({progression:{mode:'time',scheme:'linear',timeMin:30,timeMax:60}}));
    assert.ok(!html.includes('prog-threshold-row'),'no threshold row for linear scheme');
  });
});

describe('per-exercise RPE pills reflect the effective default (v1.883#follow-up B)',()=>{
  const progressionSetup=indirectEval('progressionSetup');
  it('no override: the global default (8) shows pressed',()=>{
    progressionSetup.threshold=8;
    const html=progressionSummaryForOptions({
      uid:'u-b1',exerciseId:'plank',
      progression:{mode:'reps',scheme:'rpe',min:6,max:12},
    });
    assert.ok(html.includes('data-ex-threshold="8" data-ex-threshold-uid="u-b1" aria-pressed="true"'),'default 8 is pressed');
    assert.ok(!html.includes('aria-pressed="true" data-ex-threshold="7"'),'7 is not pressed');
  });
  it('no override: a completion global default shows Off pressed',()=>{
    progressionSetup.threshold='completion';
    const html=progressionSummaryForOptions({
      uid:'u-b2',exerciseId:'plank',
      progression:{mode:'reps',scheme:'rpe',min:6,max:12},
    });
    assert.ok(html.includes('data-ex-threshold="completion" data-ex-threshold-uid="u-b2" aria-pressed="true"'),'Off is pressed');
    progressionSetup.threshold=8;
  });
  it('explicit override wins over the default',()=>{
    progressionSetup.threshold=8;
    const html=progressionSummaryForOptions({
      uid:'u-b3',exerciseId:'plank',
      progression:{mode:'reps',scheme:'rpe',threshold:7,min:6,max:12},
    });
    assert.ok(html.includes('data-ex-threshold="7" data-ex-threshold-uid="u-b3" aria-pressed="true"'),'override 7 is pressed');
    assert.ok(html.includes('data-ex-threshold="8" data-ex-threshold-uid="u-b3" aria-pressed="false"'),'default 8 is not pressed');
  });
});
