'use strict';
/* User 2026-09-22: Exercise options must show the current weekly-wave %
   (what the engine actually prescribes), not the stale 75% placeholder.
   onermDisplayPct(prof) resolves: exercise override → active program's
   current weekly-wave percentage → program default → 75. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {makeStubs}=require('./stubs');

const stubs=makeStubs();
const PROGRAM={
  id:'prog-1',
  name:'Wave Program',
  progression:{scheme:'onerm',pctWave:true,weeklyPcts:[80,85,90,80],weeklyDeloads:[false,false,false,true],percentOf1RM:75},
};
const role=loadRole('utilities',{
  globals:{
    window:stubs.window,
    document:stubs.document,
    findProgramById:id=>id==='prog-1'?PROGRAM:null,
    programWeek:()=>2,
  },
});
beforeEach(()=>{
  role.workoutState.draft={exercises:[],programId:null};
});

describe('onermDisplayPct: Exercise options shows the live wave %',()=>{
  it('exercise override wins',()=>{
    role.workoutState.draft={exercises:[],programId:'prog-1'};
    assert.equal(role.onermDisplayPct({percentOf1RM:88}),88,'stored 88% override beats the wave: ');
  });
  it('active program current-wave % comes next',()=>{
    role.workoutState.draft={exercises:[],programId:'prog-1'};
    assert.equal(role.onermDisplayPct({}),85,'week 2 of [80,85,90,80] is 85, not the 75 placeholder');
  });
  it('program default when no wave',()=>{
    role.workoutState.draft={exercises:[],programId:'prog-1'};
    const noWave={...PROGRAM,progression:{...PROGRAM.progression,pctWave:false,weeklyPcts:[]}};
    const role2=loadRole('utilities',{
      globals:{
        window:stubs.window,
        document:stubs.document,
        findProgramById:()=>noWave,
        programWeek:()=>2,
      },
    });
    role2.workoutState.draft={exercises:[],programId:'prog-1'};
    assert.equal(role2.onermDisplayPct({}),75,'falls back to the program default');
  });
  it('75% when nothing applies',()=>{
    role.workoutState.draft={exercises:[],programId:null};
    assert.equal(role.onermDisplayPct({}),75,'no program context — the honest 75 placeholder');
  });
});
