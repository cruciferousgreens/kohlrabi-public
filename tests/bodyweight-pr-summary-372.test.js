'use strict';
/* Role: workout-history-logic — pins #372 for the log "PRs hit" summary:
   a completed workout whose bodyweight sets beat the prior best unweighted
   rep set lists a best-rep-set PR. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const catalog=[
  {id:'pullup',name:'Pull-Up',equipment:'body only',tracking:'reps'},
  {id:'squat',name:'Barbell Squat',equipment:'barbell',tracking:'reps'},
];

const {workoutPRs,workoutState}=loadRole('workout-history-logic',{globals:{exercises:catalog,
  /* The workout-history-logic role doesn't load exercise-detail.js, so the
     weighted path needs the real estimate1RM formula injected (it is pinned
     itself in exercise-math.test.js; here only workoutPRs' branching is
     under test). */
  estimate1RM:(set)=>{const w=Number(set.w);if(!Number.isFinite(w)||w<=0)return 0;
    const rir=set.rpe==null||set.rpe==='' ? 0 : Math.max(0,10-Number(set.rpe));
    return w*(1+(Number(set.r)+rir)/30);},
}});

const bwLog=(id,date,sets)=>({id,date,completedAt:`${date}T12:00:00.000Z`,name:'Workout',
  exercises:[{exerciseId:'pullup',tracking:'reps',
    sets:sets.map(s=>({w:s.w??'',r:s.r??'',seconds:'',rpe:'',tags:[],complete:true}))}]});

beforeEach(()=>{workoutState.completed=[];});

describe('workoutPRs — #372 bodyweight PRs in the post-workout summary',()=>{
  it('bodyweight best beats prior → best rep set PR listed',()=>{
    const prior=bwLog('w1','2026-09-10',[{w:'',r:'10'}]);
    const cur=bwLog('w2','2026-09-11',[{w:'',r:'8'},{w:'',r:'12'}]);
    workoutState.completed=[cur,prior];
    assert.deepEqual(workoutPRs(cur),[{name:'Pull-Up',kind:'best rep set PR',value:'12 reps'}]);
  });
  it('no improvement → no PR entry',()=>{
    const prior=bwLog('w1','2026-09-10',[{w:'',r:'10'}]);
    const cur=bwLog('w2','2026-09-11',[{w:'',r:'9'}]);
    workoutState.completed=[cur,prior];
    assert.deepEqual(workoutPRs(cur),[]);
  });
  it('first bodyweight session (no prior) → no PR entry',()=>{
    const cur=bwLog('w2','2026-09-11',[{w:'',r:'12'}]);
    workoutState.completed=[cur];
    assert.deepEqual(workoutPRs(cur),[]);
  });
  it('weighted-only history does not suppress a bodyweight PR against unweighted prior',()=>{
    const prior=bwLog('w1','2026-09-10',[{w:'25',r:'8'},{w:'',r:'10'}]);
    const cur=bwLog('w2','2026-09-11',[{w:'',r:'11'}]);
    workoutState.completed=[cur,prior];
    assert.deepEqual(workoutPRs(cur),[{name:'Pull-Up',kind:'best rep set PR',value:'11 reps'}]);
  });
  it('weighted PR path is unchanged',()=>{
    const mkW=(id,date,sets)=>({id,date,completedAt:`${date}T12:00:00.000Z`,name:'W',
      exercises:[{exerciseId:'squat',tracking:'reps',sets:sets.map(s=>({w:s.w,r:s.r,seconds:'',rpe:'8',tags:[],complete:true}))}]});
    const prior=mkW('w1','2026-09-10',[{w:'100',r:'8'}]);
    const cur=mkW('w2','2026-09-11',[{w:'105',r:'8'}]);
    workoutState.completed=[cur,prior];
    const prs=workoutPRs(cur);
    assert.equal(prs.length,1);
    assert.equal(prs[0].name,'Barbell Squat');
    assert.equal(prs[0].kind,'estimated 1RM PR');
  });
});
