'use strict';
/* Role: pr-label-logic — pins #372 for the live-workout PR toast:
   completing a bodyweight set that beats the prior best unweighted rep set
   fires the same celebration path as a weighted PR. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const catalog=[
  {id:'pullup',name:'Pull-Up',equipment:'body only',tracking:'reps'},
  {id:'squat',name:'Barbell Squat',equipment:'barbell',tracking:'reps'},
];

const {livePRLabel,workoutState}=loadRole('pr-label-logic',{globals:{exercises:catalog}});

const bwLog=(id,date,sets)=>({
  id,date,completedAt:`${date}T12:00:00.000Z`,name:'Workout',
  exercises:[{exerciseId:'pullup',tracking:'reps',sets:sets.map(s=>({w:s.w??'',r:s.r??'',seconds:'',rpe:'',tags:[],complete:true}))}],
});
const bwSet=(w,r)=>({w:w??'',r:r??'',seconds:'',rpe:'',tags:[],complete:true});
const bwItem=()=>({exerciseId:'pullup',tracking:'reps'});

beforeEach(()=>{workoutState.completed=[];});

describe('livePRLabel — #372 bodyweight rep PR toast',()=>{
  it('bodyweight set beats the prior unweighted best → rep PR label',()=>{
    workoutState.completed=[bwLog('w1','2026-09-10',[{w:'',r:'10'}])];
    assert.equal(livePRLabel(bwItem(),bwSet('',12)),'Pull-Up · new rep PR');
  });
  it('no improvement → no label',()=>{
    workoutState.completed=[bwLog('w1','2026-09-10',[{w:'',r:'10'}])];
    assert.equal(livePRLabel(bwItem(),bwSet('',9)),'');
  });
  it('no prior history → no label (first-session rule)',()=>{
    assert.equal(livePRLabel(bwItem(),bwSet('',12)),'');
  });
  it('weighted history alone does not gate a bodyweight PR check',()=>{
    workoutState.completed=[bwLog('w1','2026-09-10',[{w:'25',r:'8'},{w:'',r:'10'}])];
    assert.equal(livePRLabel(bwItem(),bwSet('',11)),'Pull-Up · new rep PR');
    assert.equal(livePRLabel(bwItem(),bwSet('',10)),'');
  });
  it('weighted PR path is unchanged',()=>{
    const item={exerciseId:'squat',tracking:'reps'};
    const prior={id:'w1',date:'2026-09-10',completedAt:'2026-09-10T12:00:00.000Z',name:'W',
      exercises:[{exerciseId:'squat',tracking:'reps',sets:[{w:'100',r:'8',seconds:'',rpe:'5',tags:[],complete:true}]}]};
    workoutState.completed=[prior];
    /* 105×5@9 → e1RM 126 < prior 143, but the load is heavier → heaviest. */
    assert.equal(livePRLabel(item,{w:'105',r:'5',seconds:'',rpe:'9',tags:[],complete:true}),'Barbell Squat · new heaviest set PR');
  });
});
