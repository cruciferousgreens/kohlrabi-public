'use strict';
/* F2 — workoutPRs flagged PRs on zero-rep sets: the current/prior weighted
   filters only required Number(set.w)>0, so a 200×0 set (reachable via
   "Finish anyway" with unlogged sets, where finishWorkout keeps invalid sets
   as r:null) earned a heaviest-set PR, and estimate1RM({w:220,r:0})
   degenerates to 220, false-flagging e1RM PRs too. Both filters now require
   Number(set.r)>0, matching the sibling surfaces recentPRRows
   (dashboard-stats.js) and statsFor (exercise-detail.js). The bodyweight
   branch already had r>0. Role: workout-history-logic. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

/* The 'focus-preset' role bundles workout-history.js with the real
   exercise-detail.js (estimate1RM) and exercise-library.js, and its stub
   catalog carries bench-press = 'Barbell Bench Press'. workoutPRs is pure. */
const {workoutPRs,workoutState}=loadRole('focus-preset');

const set=(w,r,rpe=null)=>({w,r,seconds:null,rpe,tags:[],complete:true});
const log=(id,date,sets)=>({id,date,completedAt:`${date}T12:00:00.000Z`,name:'W',
  exercises:[{exerciseId:'bench-press',tracking:'reps',sets}]});

beforeEach(()=>{workoutState.completed=[];});

describe('F2 — workoutPRs ignores zero-rep sets',()=>{
  it('a 200×0 session yields no PRs (the F2 repro)',()=>{
    const prior=log('w1','2026-09-10',[set(150,5,8)]); /* e1RM 185, heaviest 150 */
    const cur=log('w2','2026-09-11',[set(200,null)]);  /* r:null — "Finish anyway" */
    workoutState.completed=[cur,prior];
    /* estimate1RM({w:200,r:0}) degenerates to 200, beating the prior 185 —
       pre-fix this false-flagged an estimated-1RM PR. */
    assert.deepEqual(workoutPRs(cur),[]);
  });
  it('a real 200×5@8 session still flags the estimated-1RM PR',()=>{
    const prior=log('w1','2026-09-10',[set(190,5,8)]);
    const cur=log('w2','2026-09-11',[set(200,5,8)]);
    workoutState.completed=[cur,prior];
    const prs=workoutPRs(cur);
    assert.equal(prs.length,1);
    assert.equal(prs[0].name,'Barbell Bench Press');
    assert.equal(prs[0].kind,'estimated 1RM PR');
  });
  it('a real 200×1 session still flags the heaviest-set PR',()=>{
    const prior=log('w1','2026-09-10',[set(190,5,8)]);
    const cur=log('w2','2026-09-11',[set(200,1)]);
    workoutState.completed=[cur,prior];
    assert.deepEqual(workoutPRs(cur),[{name:'Barbell Bench Press',kind:'heaviest set PR',value:'200 lb'}]);
  });
});
