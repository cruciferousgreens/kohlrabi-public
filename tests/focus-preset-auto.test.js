'use strict';
/* User 2026-09-13: workout focus pills must select themselves whenever the
   range is known — program week range on program start, the template's saved
   focusKey on template start, and the finished session's focus on repeat.
   Also pins the removal of the "X logged." program-cover notice artifact. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole,REPO_ROOT}=require('./harness');

const {
  doStartProgramWorkout, startWorkoutFromTemplate, repeatWorkout, finishWorkout,
  workoutState, progressionSetup, DEFAULT_PROGRESSION_SETUP,
}=loadRole('focus-preset');

const freshSetup=()=>JSON.parse(JSON.stringify(DEFAULT_PROGRESSION_SETUP));

beforeEach(()=>{
  workoutState.completed=[];
  workoutState.templates=[];
  workoutState.activeProgram=null;
  workoutState.draft=null;
  Object.keys(progressionSetup).forEach(k=>delete progressionSetup[k]);
  Object.assign(progressionSetup,freshSetup());
  progressionSetup.units='imperial';
});

function testProgram(preset){
  return {
    id:'p1', name:'Test Block', length:8, startDate:'2026-09-07',
    workouts:[{uid:'w1', name:'Chest', template:{exercises:[
      {exerciseId:'bench-press', tracking:'reps', note:'', progression:{}},
    ]}}],
    progression:{scheme:'rpe', threshold:8, incrementType:'fixed', incrementValue:5,
      defaultRange:{preset, min:1, max:5}},
  };
}

describe('program workout start sets the focus pill',()=>{
  it('inherits the program week range preset (strength)',()=>{
    const program=testProgram('strength');
    doStartProgramWorkout(program,program.workouts[0]);
    assert.equal(workoutState.draft.focusPreset,'strength');
  });
  it('follows the undulating week preset, not the flat default',()=>{
    const program=testProgram('strength');
    program.progression.undulating=true;
    program.progression.weeklyRanges=['hypertrophy'];
    doStartProgramWorkout(program,program.workouts[0]);
    assert.equal(workoutState.draft.focusPreset,'hypertrophy');
  });
  it('#431: the program week range wins over stale template ranges',()=>{
    const program=testProgram('strength');
    program.workouts[0].template.exercises[0].progression={min:6,max:12};
    doStartProgramWorkout(program,program.workouts[0]);
    assert.equal(workoutState.draft.focusPreset,'strength');
    assert.equal(workoutState.draft.exercises[0].progression.min,1);
    assert.equal(workoutState.draft.exercises[0].progression.max,5);
  });
  it('leaves focus null when the range matches no preset',()=>{
    const program=testProgram('strength');
    program.progression.defaultRange={min:3,max:7}; /* no preset key */
    doStartProgramWorkout(program,program.workouts[0]);
    assert.equal(workoutState.draft.focusPreset,null);
  });
});

describe('template start carries the saved focus',()=>{
  it('sets focusPreset from the template focusKey',()=>{
    workoutState.templates=[{id:'t1', name:'Chest', focusKey:'hypertrophy',
      exercises:[{exerciseId:'bench-press', tracking:'reps', note:'', sets:[]}]}];
    startWorkoutFromTemplate('t1');
    assert.equal(workoutState.draft.focusPreset,'hypertrophy');
  });
  it('stays null when the template has no focus',()=>{
    workoutState.templates=[{id:'t1', name:'Chest', focusKey:null,
      exercises:[{exerciseId:'bench-press', tracking:'reps', note:'', sets:[]}]}];
    startWorkoutFromTemplate('t1');
    assert.equal(workoutState.draft.focusPreset,null);
  });
});

describe('finish persists focus; repeat restores it',()=>{
  function finishedLog(){
    workoutState.draft={
      name:'Chest', date:'2026-09-13', programId:null, programWorkoutUid:null,
      editingId:null, focusPreset:'strength',
      exercises:[{exerciseId:'bench-press', tracking:'reps', note:'', exerciseTags:[],
        supersetId:null, progression:{mode:'reps',min:1,max:5},
        sets:[{uid:'s1', w:'135', r:'5', seconds:'', rpe:'8', tags:[], complete:true}]}],
    };
    finishWorkout(true);
    return workoutState.completed[0];
  }
  it('stores focusPreset on the completed log',()=>{
    assert.equal(finishedLog().focusPreset,'strength');
  });
  it('repeatWorkout restores the finished session focus',()=>{
    repeatWorkout(finishedLog());
    assert.equal(workoutState.draft.focusPreset,'strength');
  });
});

describe('program-cover "X logged." notice is gone',()=>{
  const read=rel=>fs.readFileSync(path.join(REPO_ROOT,rel),'utf8');
  it('no notice setter in the finish path',()=>{
    assert.ok(!read('assets/js/workout/workout-history.js').includes('.notice='),
      'workout-history.js must not set a program notice');
  });
  it('no notice renderer on the program cover',()=>{
    const src=read('assets/js/pages/programs.js');
    assert.ok(!src.includes('program.notice'),'programs.js must not read program.notice');
    assert.ok(!src.includes('program-notice'),'programs.js must not render .program-notice');
  });
  it('no .program-notice CSS rule remains',()=>{
    assert.ok(!read('assets/styles.css').includes('.program-notice'),
      'styles.css must not define .program-notice');
  });
});
