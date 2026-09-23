'use strict';
/* Phone-QA batch (user 2026-09-20, beta v1.869):
   #575 tapping a suggestion card writes the suggestion into unchecked sets
       (filled-but-unchecked included) — the tap is an explicit apply;
       completed sets and warm-up rows are never touched; a per-set
       position with no baseline is never invented.
   #576 linear progression respects the rep/time range — an out-of-range
       top set is pulled back inside instead of carried through.
   #577 linear is the default scheme; explicit stored schemes are kept.
   #578 the Settings "All sets" default is live (on-wins), not just a seed
       for new programs; linear back-offs take the load step from their own
       baselines with their own range-clamped reps. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{globals:{exercises:[]}});
const {progressionForExercise,applyProgressionSuggestion,
  workoutState,progressionSetup,freshProgressionSetup}=role;

const WARMUP_TAG='Warmup';
const profile=(over)=>Object.assign({mode:'reps',min:6,max:12},over);
const seed=(sets,prog)=>{workoutState.completed=[mkLog('w1','2026-09-10',[mkItem('bench-press',sets,{progression:prog||profile()})])];};
const lin=()=>{progressionSetup.scheme='linear';progressionSetup.incrementType='lb';progressionSetup.incrementValue=5;};
const rpe=()=>{progressionSetup.scheme='rpe';progressionSetup.threshold=8;};

beforeEach(()=>{
  progressionSetup.scheme='linear';
  progressionSetup.threshold=8;
  progressionSetup.progressionOff=false;
  progressionSetup.progressAllSets=false;
  progressionSetup.incrementType='lb';
  progressionSetup.incrementValue=5;
  progressionSetup.timeStep=5;
  progressionSetup.advanceOnCompletion=false;
  workoutState.completed=[];
  workoutState.activeProgram=null;
  workoutState.draft=null;
});
/* Draft-shape apply helper: applyProgressionSuggestion(draft, suggestion)
   reads workoutState.draft.exercises itself and finds the item. */
const draftWith=(sets,prog)=>{
  const item={exerciseId:'bench-press',uid:'ex1',sets:sets.map((s,i)=>Object.assign({uid:'s'+i,complete:false},s)),progression:prog||profile()};
  workoutState.draft={exercises:[item]};
  return workoutState.draft;
};
const apply=(draft,s)=>{applyProgressionSuggestion(draft,s,false);return draft.exercises[0];};

describe('#575: tapping the card writes values into unchecked sets',()=>{
  it('filled-but-unchecked sets take their own per-set target',()=>{
    /* QA batch 2026-09-22: per-set targets are the only path — the back-off
       takes its own cascade target (95+5=100), not the top's 105. */
    seed([{w:100,r:8,rpe:8},{w:95,r:8,rpe:8}]);
    const draft=draftWith([{w:'100',r:'8'},{w:'95',r:'8'}]);
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s);
    assert.equal(s.nextWeight,105);
    const item=apply(draft,s);
    assert.equal(item.sets[0].w,'105');
    assert.equal(item.sets[0].r,'8');
    assert.equal(item.sets[1].w,'100');
    assert.equal(item.sets[1].r,'8');
    assert.equal(s.applied,true);
  });
  it('completed sets keep their logged values',()=>{
    seed([{w:100,r:8,rpe:8},{w:95,r:8,rpe:8}]);
    const draft=draftWith([{w:'100',r:'8',complete:true},{w:'95',r:'8'}]);
    const s=progressionForExercise('bench-press',profile(),null);
    const item=apply(draft,s);
    assert.equal(item.sets[0].w,'100');
    assert.equal(item.sets[0].r,'8');
    assert.equal(item.sets[1].w,'100');
  });
  it('warm-up rows keep their typed values but the ladder hints rescale (QA batch 2026-09-22)',()=>{
    seed([{w:100,r:8,rpe:8}]);
    /* Two warmup rows with stale hints from the old 100 lb anchor
       (40/60). The new 105 top re-anchors the ladder: 40% → 42 → grid 40,
       60% → 63 → grid 65. */
    const draft=draftWith([
      {w:'40',r:'5',tags:[WARMUP_TAG],warmupHint:{w:'40',perf:'5'}},
      {w:'60',r:'3',tags:[WARMUP_TAG],warmupHint:{w:'60',perf:'3'}},
      {w:'95',r:'8'},
    ]);
    const s=progressionForExercise('bench-press',profile(),null);
    assert.equal(s.nextWeight,105);
    const item=apply(draft,s);
    assert.equal(item.sets[0].w,'40');
    assert.equal(item.sets[0].r,'5');
    assert.equal(item.sets[1].w,'60');
    assert.equal(item.sets[1].r,'3');
    /* Hints rescale to the new anchor (rung 2 moves 60 → 65); typed values
       and rung reps are untouched. */
    assert.equal(item.sets[0].warmupHint.w,'40');
    assert.equal(item.sets[0].warmupHint.perf,'5');
    assert.equal(item.sets[1].warmupHint.w,'65');
    assert.equal(item.sets[1].warmupHint.perf,'3');
  });
  it('all-sets targets land on the matching unchecked rows',()=>{
    rpe();
    progressionSetup.progressAllSets=true;
    seed([{w:100,r:8,rpe:7},{w:90,r:8,rpe:7},{w:80,r:8,rpe:6}]);
    const draft=draftWith([{w:'100',r:'8'},{w:'90',r:'8'},{w:'80',r:'8'}]);
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s&&s.setTargets&&s.setTargets.length===3);
    const item=apply(draft,s);
    /* Top set takes its own target; back-offs take theirs — each row's
       values come from the matching setTargets position, not the top. */
    assert.equal(item.sets[0].w,String(s.setTargets[0].w));
    assert.equal(item.sets[1].w,String(s.setTargets[1].w));
    assert.equal(item.sets[2].w,String(s.setTargets[2].w));
    assert.notEqual(item.sets[1].w,item.sets[0].w);
  });
  it('a per-set position with no baseline is never invented',()=>{
    rpe();
    progressionSetup.progressAllSets=true;
    seed([{w:100,r:8,rpe:7},{w:90,r:8,rpe:7}]);
    const draft=draftWith([{w:'',r:''},{w:'90',r:'8'},{w:'77',r:'8'}]);
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s&&s.setTargets&&s.setTargets.length===2);
    const item=apply(draft,s);
    /* Third row has no baseline at its position: untouched. */
    assert.equal(item.sets[2].w,'77');
    assert.equal(item.sets[2].r,'8');
    assert.equal(item.sets[0].w,String(s.setTargets[0].w));
  });
});

describe('#576: linear respects the rep/time range',()=>{
  it('in-range reps carry through with the load step',()=>{
    lin();
    seed([{w:150,r:8,rpe:9}]);
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s);
    assert.equal(s.nextWeight,155);
    assert.equal(s.nextReps,8);
    assert.ok(!/pulled into/.test(s.reason));
  });
  it('reps below the range floor rebase back into range, not carried through',()=>{
    lin();
    seed([{w:150,r:4,rpe:9}]);
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s);
    /* QA batch (user 2026-09-21, #11): the old "add the increment and clamp"
       (155x6) is retired — a below-range top set rebases from the estimated
       1RM onto the middle of the range. */
    assert.equal(s.kind,'backrange');
    assert.equal(s.nextWeight,135);
    assert.equal(s.nextReps,9);
    assert.ok(/Back into range/.test(s.reason));
  });
  it('reps above the range ceiling are pulled down, not carried through',()=>{
    lin();
    seed([{w:150,r:14,rpe:9}]);
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s);
    assert.equal(s.nextWeight,155);
    assert.equal(s.nextReps,12);
    assert.ok(/pulled into the 6–12 range/.test(s.reason));
  });
  it('time mode clamps seconds into the time range',()=>{
    lin();
    seed([{w:0,seconds:90,rpe:9}],{mode:'time',timeMin:20,timeMax:60});
    const s=progressionForExercise('bench-press',{mode:'time',timeMin:20,timeMax:60},null);
    assert.ok(s);
    assert.equal(s.nextSeconds,60);
    assert.ok(/pulled into the 20–60s range/.test(s.reason));
  });
});

describe('#577: linear is the default; explicit schemes are kept',()=>{
  it('fresh defaults resolve to linear',()=>{
    assert.equal(freshProgressionSetup().scheme,'linear');
  });
  it('the engine resolves linear when nothing is stamped anywhere',()=>{
    lin();
    seed([{w:100,r:8,rpe:9}]);
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s);
    assert.equal(s.scheme,'linear');
    assert.ok(/^Linear progression/.test(s.reason));
  });
  it('an explicitly stored rpe scheme is preserved',()=>{
    progressionSetup.scheme='rpe';
    seed([{w:100,r:8,rpe:7}]);
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s);
    assert.equal(s.scheme,'rpe');
    assert.ok(!/^Linear progression/.test(s.reason));
  });
  it('an explicitly stored onerm scheme is preserved',()=>{
    progressionSetup.scheme='onerm';
    progressionSetup.percentOf1RM=75;
    /* 110x8 keeps the prescription (75% of e1RM=143 → 105) off the #79
       no-change line so the card renders and the scheme assertion is
       meaningful. */
    seed([{w:110,r:8,rpe:9}]);
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s);
    assert.equal(s.scheme,'onerm');
    assert.equal(s.nextWeight,105);
  });
  /* User 2026-09-22: %1RM must preserve the latest top-set reps, not drop
     to the range minimum. 270x5 stays 270x5, not 270x1. */
  it('%1RM preserves latest reps (270x5 stays 270x5)',()=>{
    progressionSetup.scheme='onerm';
    progressionSetup.percentOf1RM=90;
    // 270x5 @ RPE 9 → e1RM ≈ 270*(1+6/30)=324; 90% = 291.6 → snaps to 290
    // The key assertion: reps stay 5, not dropped to min (1)
    seed([{w:270,r:5,rpe:9}]);
    const s=progressionForExercise('bench-press',profile({min:1,max:5}),null);
    assert.ok(s);
    assert.equal(s.scheme,'onerm');
    assert.equal(s.nextReps,5);
  });
  it('a program-stamped scheme beats the global default',()=>{
    lin();
    workoutState.activeProgram={progression:{scheme:'rpe',threshold:8}};
    seed([{w:100,r:8,rpe:7}]);
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s);
    assert.equal(s.scheme,'rpe');
  });
});

describe('#578: the All-sets toggle is retired — per-set targets are unconditional (QA batch 2026-09-22)',()=>{
  const twoSets=()=>{seed([{w:100,r:8,rpe:7},{w:90,r:8,rpe:7}]);};
  it('a legacy Settings progressAllSets=true is ignored — targets still per-set',()=>{
    rpe();
    progressionSetup.progressAllSets=true;
    twoSets();
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s&&s.setTargets&&s.setTargets.length===2);
  });
  it('a legacy program progressAllSets=false is ignored — targets still per-set',()=>{
    rpe();
    workoutState.activeProgram={progression:{scheme:'rpe',progressAllSets:false}};
    twoSets();
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s&&s.setTargets&&s.setTargets.length===2);
  });
  it('a legacy program progressAllSets=true is ignored — targets still per-set',()=>{
    rpe();
    workoutState.activeProgram={progression:{scheme:'rpe',progressAllSets:true}};
    twoSets();
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s&&s.setTargets&&s.setTargets.length===2);
  });
  it('linear back-offs take the load step from their own baselines',()=>{
    lin();
    progressionSetup.progressAllSets=true;
    /* No RPEs at all: linear never gates on RPE, so every set moves. */
    seed([{w:100,r:8},{w:90,r:10},{w:80,r:14}]);
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s&&s.setTargets&&s.setTargets.length===3);
    /* Top: 105 × clamped 8. Back-offs: own load + 5, own reps clamped
       into the range (10 stays, 14 → 12) — never a reset to the floor. */
    assert.equal(s.setTargets[0].w,105);
    assert.equal(s.setTargets[0].r,8);
    assert.equal(s.setTargets[1].w,95);
    assert.equal(s.setTargets[1].r,10);
    assert.equal(s.setTargets[2].w,85);
    assert.equal(s.setTargets[2].r,12);
  });
  it('linear back-off load never exceeds the top-set load',()=>{
    lin();
    progressionSetup.progressAllSets=true;
    seed([{w:100,r:8},{w:104,r:8}]);
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s&&s.setTargets);
    for(const t of s.setTargets)if(t)assert.ok(t.w<=s.nextWeight);
  });
});
