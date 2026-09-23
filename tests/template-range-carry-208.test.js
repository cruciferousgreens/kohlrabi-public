'use strict';
/* #208 (user 2026-09-13): the per-exercise rep range set on a saved workout
   must survive into the live workout as the target range, and the
   progression engine must respect it (stored-zone machinery, same as program
   rep ranges). Drives the real startWorkoutFromTemplate +
   prepareDraftProgression against stubbed DOM. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const {
  startWorkoutFromTemplate, workoutState, progressionSetup,
  DEFAULT_PROGRESSION_SETUP, rangePlaceholder,
}=loadRole('focus-preset');

beforeEach(()=>{
  workoutState.completed=[];
  workoutState.templates=[];
  workoutState.activeProgram=null;
  workoutState.draft=null;
  Object.keys(progressionSetup).forEach(k=>delete progressionSetup[k]);
  Object.assign(progressionSetup,JSON.parse(JSON.stringify(DEFAULT_PROGRESSION_SETUP)));
  progressionSetup.units='imperial';
  /* #577: linear is now the app default; these tests exercise RPE mechanics. */
  progressionSetup.scheme='rpe';
});

const hist=()=>{workoutState.completed=[mkLog('w1','2026-09-10',[mkItem('bench-press',[{w:100,r:8,rpe:7}])])];};
const templateWith=(progression)=>{workoutState.templates=[{id:'t1',name:'Chest',focusKey:null,
  exercises:[{exerciseId:'bench-press',tracking:'reps',note:'',progression,sets:[{r:'',w:''}]}]}];};

describe('template range carries into the live workout (#208)',()=>{
  it('the draft item carries the template range and shows it as the target range',()=>{
    templateWith({preset:'strength',min:1,max:5,openTop:false,amrap:false,custom:true});
    startWorkoutFromTemplate('t1');
    const item=workoutState.draft.exercises[0];
    assert.equal(item.progression.min,1);
    assert.equal(item.progression.max,5);
    assert.equal(rangePlaceholder(item.progression,false).text,'1–5');
  });
  it('the suggestion respects the template zone, not the lifter last zone',()=>{
    hist();
    templateWith({preset:'strength',min:1,max:5,openTop:false,amrap:false,custom:true});
    startWorkoutFromTemplate('t1');
    const s=workoutState.draft.progressionSuggestions[0];
    assert.ok(s,'a suggestion card is computed');
    assert.ok(s.nextReps>=1&&s.nextReps<=5,
      `suggestion must land in the template 1–5 zone, got ${s.nextReps} reps`);
  });
  it('no range: the fixed-reps path follows the lifter as today',()=>{
    hist();
    templateWith(null);
    startWorkoutFromTemplate('t1');
    const s=workoutState.draft.progressionSuggestions[0];
    assert.ok(s,'a suggestion card is computed');
    /* Freeform follow-the-lifter narrows the zone to the lifter's 8-rep top
       set, so the RPE-7 trigger adds load at the same reps (not a 9th rep). */
    assert.equal(s.kind,'load');
    assert.equal(s.nextReps,8);
    assert.equal(s.nextWeight,110,'100 + 1.5×5 lb RPE-scaled step, snapped to the 5 lb grid');
  });
});
