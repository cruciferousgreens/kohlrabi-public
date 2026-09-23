'use strict';
/* #411: a brand-new saved/program workout builder pre-highlights the default
   focus pill (app Settings default / program current-week default). Edits
   keep their saved focus; 'custom' defaults leave the pills clear; tapping
   the highlighted pill still clears it (covered by existing builder tests). */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const role=loadRole('saved-workout-template',{globals:{
  programRangeForWeek:()=>({preset:'strength',min:1,max:5,openTop:false,amrap:false}),
  programWeek:()=>3,
  exercises:[],
}});
const indirectEval=eval;
const defaultBuilderFocusKey=indirectEval('defaultBuilderFocusKey');
const workoutState=indirectEval('workoutState');
const progressionSetup=indirectEval('progressionSetup');

beforeEach(()=>{
  workoutState.activeProgram=null;
  progressionSetup.defaultRange={preset:'hypertrophy',min:6,max:12,openTop:false,amrap:false};
});

describe('#411 builder default focus pill',()=>{
  it('new saved workout pre-highlights the app Settings default',()=>{
    const key=defaultBuilderFocusKey({isNewProgramShell:false,programWorkout:null,template:null,base:null});
    assert.equal(key,'hypertrophy');
  });
  it('a custom app default leaves the pills clear',()=>{
    progressionSetup.defaultRange={preset:'custom',min:8,max:10,openTop:false,amrap:false};
    const key=defaultBuilderFocusKey({isNewProgramShell:false,programWorkout:null,template:null,base:null});
    assert.equal(key,null);
  });
  it('new program workout pre-highlights the program week default',()=>{
    workoutState.activeProgram={id:'p1',progression:{}};
    const key=defaultBuilderFocusKey({isNewProgramShell:true,programWorkout:{uid:'w1'},template:null,base:null});
    assert.equal(key,'strength');
  });
  it('new program workout with no active program leaves the pills clear',()=>{
    const key=defaultBuilderFocusKey({isNewProgramShell:true,programWorkout:{uid:'w1'},template:null,base:null});
    assert.equal(key,null);
  });
  it('editing a saved workout keeps its saved focus',()=>{
    const key=defaultBuilderFocusKey({isNewProgramShell:false,programWorkout:null,template:{id:'t1'},base:{focusKey:'endurance'}});
    assert.equal(key,'endurance');
  });
  it('editing a program workout keeps its saved focus',()=>{
    const key=defaultBuilderFocusKey({isNewProgramShell:false,programWorkout:{uid:'w1'},template:null,base:{focusKey:'strength'}});
    assert.equal(key,'strength');
  });
});

describe('#411 follow-up: opening an existing workout without a saved focus falls back',()=>{
  it('an existing program workout falls back to the program current-week default',()=>{
    workoutState.activeProgram={id:'p1',progression:{}};
    const key=defaultBuilderFocusKey({isNewProgramShell:false,programWorkout:{uid:'w1'},template:null,base:undefined});
    assert.equal(key,'strength');
  });
  it('an existing program workout with no active program leaves the pills clear',()=>{
    const key=defaultBuilderFocusKey({isNewProgramShell:false,programWorkout:{uid:'w1'},template:null,base:undefined});
    assert.equal(key,null);
  });
  it('an existing program workout falls back to the program default when the week preset is custom',()=>{
    const real=globalThis.programRangeForWeek;
    globalThis.programRangeForWeek=()=>({preset:'custom',min:8,max:10});
    try{
      workoutState.activeProgram={id:'p1',progression:{defaultRange:{preset:'endurance',min:12,max:20}}};
      const key=defaultBuilderFocusKey({isNewProgramShell:false,programWorkout:{uid:'w1'},template:null,base:undefined});
      assert.equal(key,'endurance');
    }finally{globalThis.programRangeForWeek=real;}
  });
  it('an existing saved workout without saved focus falls back to the app Settings default',()=>{
    const key=defaultBuilderFocusKey({isNewProgramShell:false,programWorkout:null,template:{id:'t1'},base:undefined});
    assert.equal(key,'hypertrophy');
  });
  it('an existing template with a saved focus keeps it',()=>{
    const key=defaultBuilderFocusKey({isNewProgramShell:false,programWorkout:null,template:{id:'t1'},base:{focusKey:'endurance'}});
    assert.equal(key,'endurance');
  });
  it('a custom app default leaves reopened builders clear too',()=>{
    progressionSetup.defaultRange={preset:'custom',min:8,max:10,openTop:false,amrap:false};
    const key=defaultBuilderFocusKey({isNewProgramShell:false,programWorkout:null,template:{id:'t1'},base:undefined});
    assert.equal(key,null);
  });
});
