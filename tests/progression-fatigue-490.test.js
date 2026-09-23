'use strict';
/* #490 (user 2026-09-16): fatigueForBasis still accounts for accumulated
   fatigue across the basis session's work sets (unit contract below) —
   but the user's follow-up decision the same day reversed the gating:
   the RPE trigger gate and the #387 rep jump now run on the top set's
   RAW RPE, so accumulated fatigue no longer blocks progression. Each
   work set beyond the top set adds 0.25 effective RPE scaled by its own
   RPE (sets with no RPE assume the top set's effort); warm-ups never
   count; the penalty caps at +1.5. The accounting is still reported on
   the suggestion object for basis transparency. %1RM and linear schemes
   have no RPE gate and are untouched.
   #406 (user 2026-09-16): the suggestion row markup contract. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{globals:{exercises:[
  {id:'bench-press',name:'Barbell Bench Press',equipment:'barbell'},
]}});
const {progressionForExercise,fatigueForBasis,topSetForSession,cardSuggestionHtml,
  applyProgressionSuggestion,workoutState,progressionSetup}=role;

const profile=()=>({mode:'reps',min:6,max:12});
const seed=(sets,opts)=>{
  const item=mkItem('bench-press',sets,{progression:{mode:'reps',min:6,max:12},...(opts||{})});
  workoutState.completed=[mkLog('w1','2026-09-10',[item])];
};
beforeEach(()=>{
  /* #577: linear is now the app default; these tests exercise RPE mechanics. */
  progressionSetup.scheme='rpe';
  progressionSetup.threshold=8;
  progressionSetup.progressionOff=false;
  progressionSetup.progressAllSets=false;
  progressionSetup.incrementType='lb';
  progressionSetup.incrementValue=5;
  progressionSetup.timeStep=5;
  workoutState.completed=[];
  workoutState.activeProgram=null;
});

describe('#490: fatigueForBasis unit contract',()=>{
  const basis=(sets)=>{
    const log=mkLog('w1','2026-09-10',[mkItem('bench-press',sets)]);
    const sess={sets:log.exercises[0].sets};
    return {sess,top:topSetForSession(sess)};
  };
  it('one work set → no penalty, effective RPE is the top-set RPE',()=>{
    const {sess,top}=basis([{w:100,r:8,rpe:8}]);
    const f=fatigueForBasis(sess.sets.filter(()=>true),top);
    assert.equal(f.penalty,0);
    assert.equal(f.effectiveRpe,8);
    assert.equal(f.workSets,1);
  });
  it('two sets of 8 @ RPE 8 → +0.2, effective 8.2',()=>{
    const {sess,top}=basis([{w:100,r:8,rpe:8},{w:90,r:8,rpe:8}]);
    const f=fatigueForBasis(sess.sets,top);
    assert.equal(f.penalty,0.2);
    assert.equal(f.effectiveRpe,8.2);
    assert.equal(f.workSets,2);
  });
  it('extra-set effort scales with its own RPE',()=>{
    const {sess,top}=basis([{w:100,r:8,rpe:8},{w:90,r:8,rpe:5}]);
    const f=fatigueForBasis(sess.sets,top);
    assert.equal(f.penalty,0.13,'0.25 * 0.5 = 0.125 → 0.13');
  });
  it('a set with no RPE assumes the top-set effort',()=>{
    const {sess,top}=basis([{w:100,r:8,rpe:8},{w:90,r:8,rpe:null}]);
    const f=fatigueForBasis(sess.sets,top);
    assert.equal(f.penalty,0.2);
  });
  it('warm-up sets never count toward fatigue',()=>{
    const {sess,top}=basis([{w:100,r:8,rpe:8},{w:60,r:5,rpe:6,tags:['warmup']}]);
    const f=fatigueForBasis(sess.sets.filter(s=>!s.tags.includes('warmup')),top);
    assert.equal(f.workSets,1);
    assert.equal(f.penalty,0);
  });
  it('blank rows are not work sets',()=>{
    const {sess,top}=basis([{w:100,r:8,rpe:8},{w:'',r:'',rpe:null}]);
    const f=fatigueForBasis(sess.sets,top);
    assert.equal(f.workSets,1);
    assert.equal(f.penalty,0);
  });
  it('the penalty caps at +1.5',()=>{
    const sets=[{w:100,r:8,rpe:10}];
    for(let i=0;i<9;i++)sets.push({w:100,r:8,rpe:10});
    const {sess,top}=basis(sets);
    const f=fatigueForBasis(sess.sets,top);
    assert.equal(f.penalty,1.5);
    assert.equal(f.effectiveRpe,11.5);
  });
  it('no top-set RPE → no adjustment (null effective RPE)',()=>{
    const {sess,top}=basis([{w:100,r:8,rpe:null},{w:90,r:8,rpe:null}]);
    const f=fatigueForBasis(sess.sets,top);
    assert.equal(f.penalty,0);
    assert.equal(f.effectiveRpe,null);
  });
});

describe('#490: the issue’s example — 1×8@8 vs 2×8@8 (raw-RPE gate)',()=>{
  it('one set of 8 @ RPE 8 → +2 reps (unchanged)',()=>{
    seed([{w:100,r:8,rpe:8}]);
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s);
    assert.equal(s.kind,'reps');
    assert.equal(s.nextReps,10);
    assert.equal(s.fatigue.penalty,0);
    assert.ok(!s.reason.includes('Accumulated fatigue'));
  });
  it('two sets of 8 @ RPE 8 → still +2 reps: raw 8 meets the trigger',()=>{
    seed([{w:100,r:8,rpe:8},{w:90,r:8,rpe:8}]);
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s,'accumulated fatigue no longer blocks progression');
    assert.equal(s.kind,'reps');
    assert.equal(s.nextReps,10,'jump runs on the raw top-set RPE: 10−8=+2');
    assert.ok(!s.reason.includes('Accumulated fatigue'),
      'reasons no longer name the fatigue adjustment: '+s.reason);
  });
  it('three sets of 8 @ RPE 7 → +3 reps, fatigue accounting still reported',()=>{
    seed([{w:100,r:8,rpe:7},{w:90,r:8,rpe:7},{w:80,r:8,rpe:7}]);
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s);
    assert.equal(s.kind,'reps');
    /* Raw top-set RPE 7 → 10−7 = +3 (was +3 off effective 7.4 too). */
    assert.equal(s.nextReps,11);
    assert.equal(s.fatigue.penalty,0.35);
    assert.equal(s.fatigue.effectiveRpe,7.4);
    assert.equal(s.fatigue.workSets,3);
    assert.ok(!s.reason.includes('Accumulated fatigue'),
      'reasons no longer name the fatigue adjustment: '+s.reason);
  });
  it('two sets of 8 @ RPE 7 → still +3',()=>{
    seed([{w:100,r:8,rpe:7},{w:90,r:8,rpe:7}]);
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s);
    assert.equal(s.nextReps,11);
    assert.equal(s.fatigue.penalty,0.18);
    assert.ok(!s.reason.includes('Accumulated fatigue'));
  });
  it('the rebase gate uses raw top-set RPE too (#300)',()=>{
    /* New range 1–5; top 100x8 @8 in the old zone. Raw 8 meets the
       trigger, so the range rebases instead of holding. */
    seed([{w:100,r:8,rpe:8},{w:90,r:8,rpe:8}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:1,max:5},null);
    assert.ok(s,'fatigue no longer holds the rebase');
    assert.equal(s.kind,'range');
  });
  it('linear scheme ignores RPE entirely (no RPE gate by design)',()=>{
    seed([{w:100,r:8,rpe:8},{w:90,r:8,rpe:8}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12,scheme:'linear'},null);
    assert.ok(s);
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,105);
  });
  it('timed work: raw RPE 8 meets the trigger',()=>{
    const item=mkItem('plank',[{w:0,seconds:45,rpe:8},{w:0,seconds:40,rpe:8}],
      {tracking:'time',progression:{mode:'time',timeMin:30,timeMax:60,timeStep:5}});
    workoutState.completed=[mkLog('w1','2026-09-10',[item])];
    const s=progressionForExercise('plank',{mode:'time',timeMin:30,timeMax:60,timeStep:5},null);
    assert.ok(s,'accumulated fatigue no longer blocks timed progression');
    assert.equal(s.kind,'time');
    assert.equal(s.nextSeconds,55,'raw 8 → +2 steps of 5s');
  });
});

describe('#406: cardSuggestionHtml markup contract',()=>{
  const sug=(over)=>({
    exerciseId:'bench-press',mode:'reps',kind:'reps',amrap:false,
    latest:{weight:100,reps:8,rpe:8},nextWeight:100,nextReps:10,
    sourceDate:'2026-09-10',setTargets:null,applied:false,...(over||{}),
  });
  const item={uid:'ex-1',exerciseId:'bench-press'};
  it('renders kind, target, basis, and the tap hook',()=>{
    const html=cardSuggestionHtml(item,sug());
    assert.ok(html.includes('data-card-suggestion="ex-1"'),'tap hook with the item uid');
    assert.ok(html.includes('Add reps'),'kind chip');
    assert.ok(html.includes('10 reps'),'target');
    assert.ok(html.includes('from 100 lb × 8 reps @ RPE 8 · Sep 10, 2026'),'basis names the top set');
    /* QA batch 2026-09-22: per-set targets are the only path — the copy is
       always the per-set variant. */
    assert.ok(html.includes('tap to apply each set’s own target'),'tap copy');
    assert.ok(html.startsWith('<button'),'tappable when not applied');
  });
  it('all-sets copy names the per-set behavior',()=>{
    const html=cardSuggestionHtml(item,sug({setTargets:[{index:0,w:100,r:10,changed:true}]}));
    assert.ok(html.includes('tap to apply each set’s own target'));
  });
  it('the applied row is quiet and untappable',()=>{
    const html=cardSuggestionHtml(item,sug({applied:true}));
    assert.ok(html.startsWith('<div'),'no button when applied');
    assert.ok(html.includes('data-card-suggestion-applied'));
    assert.ok(html.includes('Applied ✓'));
    assert.ok(!html.includes('data-card-suggestion="ex-1"'),'no tap hook when applied');
  });
  it('no history basis (e.g. %1RM training max) still renders the target',()=>{
    const html=cardSuggestionHtml(item,sug({kind:'onerm',latest:null,nextWeight:135,nextReps:6,sourceDate:null}));
    assert.ok(html.includes('%1RM'));
    assert.ok(html.includes('135 lb'));
    assert.ok(!html.includes('from '));
  });
});

describe('#406: tap-to-apply never wipes typed values (#67 headline); #575 fills unchecked sets',()=>{
  it('apply fills unchecked sets but never touches completions',()=>{
    /* Two basis sets so both draft positions have per-set targets (QA batch
       2026-09-22: per-set targets are the only path — a draft position with
       no baseline gets no target, never an invented one). */
    seed([{w:100,r:8,rpe:7},{w:90,r:8,rpe:7}]);
    const s=progressionForExercise('bench-press',profile(),null);
    const draft={exercises:[{uid:'u1',exerciseId:'bench-press',tracking:'reps',sets:[
      {w:'105',r:'9',rpe:'9',complete:true},
      {w:'',r:'',rpe:'',complete:false},
    ]}]};
    applyProgressionSuggestion(draft,s,false);
    const [a,b]=draft.exercises[0].sets;
    assert.deepEqual({w:a.w,r:a.r,rpe:a.rpe,complete:a.complete},
      {w:'105',r:'9',rpe:'9',complete:true},'completed sets are attestations — never touched');
    /* #575: the tap is an explicit apply — the empty unchecked set takes its
       own per-set target (90 × 11) as real values, not just ghosts. */
    assert.deepEqual({w:b.w,r:b.r,rpe:b.rpe,complete:b.complete},
      {w:'90',r:'11',rpe:'',complete:false});
    assert.ok(draft.exercises[0].suggestedTarget,'ghost target written alongside');
    assert.equal(s.applied,true,'the suggestion marks itself applied');
  });
});
