'use strict';
/* QA batch (user 2026-09-22): four progression-engine hardening fixes from
   the phone-QA report — 50×6@10 → "51×5", 125×8 → "136×5", 15/db×12 →
   "18/db", and the "Add weight · 1 rep" card off a 0-lb basis. Root cause
   was config (a 1-lb/0-lb increment resolving through), not the formula:
   prod/main/local progression.js are byte-identical. These tests pin the
   four invariants:
     1. a resolved increment ≤ 0 floors to the 5-lb default (never a
        degenerate grid that leaks raw e1RM math onto the card);
     2. the range-change rebase gates on the RAW top-set RPE — a max-effort
        set holds even under "Advance on completion";
     3. a 0-lb basis never produces an "Add weight" suggestion;
     4. per-dumbbell rebase outputs stay on the 2×-increment canonical grid
        so each hand is a real dumbbell. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{
  globals:{exercises:[
    {id:'face-pull',name:'Face Pull'},
    {id:'band-pull-apart',name:'Band Pull Apart'},
    {id:'db-lateral-raise',name:'DB Lateral Raise',equipment:'dumbbell'},
  ]},
});
const {progressionForExercise,workoutState,progressionSetup}=role;

const CFG=(inc)=>({scheme:'rpe',threshold:8,incrementType:'lb',incrementValue:inc,timeStep:5});
const ON=(inc)=>({...CFG(inc==null?5:inc),advanceOnCompletion:true});
const OLD_RANGE={mode:'reps',min:6,max:12};
const NEW_RANGE={mode:'reps',min:1,max:5,custom:true};
beforeEach(()=>{
  /* #577: linear is now the app default; these tests exercise RPE mechanics. */
  progressionSetup.scheme='rpe';
  workoutState.completed=[];
  workoutState.activeProgram=null;
  workoutState.draft=null;
  progressionSetup.units='imperial';
});

describe('QA batch 2026-09-22 (1): increment floor',()=>{
  it('increment 0 floors to the 5-lb grid on the rebase path',()=>{
    // e1RM: 50×(1+8/30)=63.33 → 5-rep target 54.29 → 5-lb grid → 55.
    // Without the floor, snapToIncrement falls back to whole-pound
    // rounding and the card reads 54 (the reported "51" was the same
    // leak with a 1-lb grid: 51.43 → 51).
    workoutState.completed=[mkLog('w1','2026-09-12',[
      mkItem('face-pull',[{w:50,r:6,rpe:8}],{progression:OLD_RANGE})])];
    const s=progressionForExercise('face-pull',NEW_RANGE,CFG(0));
    assert.ok(s&&s.kind==='range','rebase runs: '+JSON.stringify(s&&s.kind));
    assert.equal(s.nextWeight,55,'0-lb increment floors to the 5-lb grid');
    assert.equal(s.nextReps,5);
  });
  it('a 1-lb increment stays legal (only non-positive values floor)',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[
      mkItem('face-pull',[{w:50,r:6,rpe:8}],{progression:OLD_RANGE})])];
    const s=progressionForExercise('face-pull',NEW_RANGE,CFG(1));
    assert.ok(s&&s.kind==='range');
    assert.equal(s.nextWeight,54,'1-lb grid: 54.29 snaps to 54');
  });
  it('negative and NaN increments floor to 5',()=>{
    for(const bad of [-3,NaN]){
      workoutState.completed=[mkLog('w1','2026-09-12',[
        mkItem('face-pull',[{w:50,r:6,rpe:8}],{progression:OLD_RANGE})])];
      const s=progressionForExercise('face-pull',NEW_RANGE,CFG(bad));
      assert.ok(s&&s.kind==='range');
      assert.equal(s.nextWeight,55,`increment ${String(bad)} floors to 5`);
    }
  });
});

describe('QA batch 2026-09-22 (2): rebase respects raw RPE under completion',()=>{
  it('a max-effort set holds on a range change even when completion drives',()=>{
    // The reported card: 50×6@10 → "51×5". Under "Advance on completion"
    // the effective gate read as the trigger itself, so the max set rebased
    // into the new range. Raw RPE 10 > 8 → hold.
    workoutState.completed=[mkLog('w1','2026-09-12',[
      mkItem('face-pull',[{w:50,r:6,rpe:10}],{progression:OLD_RANGE})])];
    const s=progressionForExercise('face-pull',NEW_RANGE,ON(5));
    assert.ok(s,'a hold with a notice survives #79 suppression');
    assert.equal(s.kind,'hold','max-effort set is not rebased');
    assert.equal(s.nextWeight,50,'load is not touched');
    assert.equal(s.nextReps,6,'reps are not regressed to 5');
    assert.ok(s.notice&&s.notice.title==='Held at RPE 10','the hold explains itself');
  });
  it('a sub-max set still rebases when completion drives',()=>{
    // RPE 8 is not above the trigger — completion advancement is intact
    // for sets that earned it.
    workoutState.completed=[mkLog('w1','2026-09-12',[
      mkItem('face-pull',[{w:50,r:6,rpe:8}],{progression:OLD_RANGE})])];
    const s=progressionForExercise('face-pull',NEW_RANGE,ON(5));
    assert.ok(s&&s.kind==='range','sub-max set rebases: '+JSON.stringify(s&&s.kind));
    assert.equal(s.nextWeight,55);
    assert.equal(s.nextReps,5);
  });
});

describe('QA batch 2026-09-22 (3): zero-load basis never suggests "Add weight"',()=>{
  it('a 0-lb exercise at its rep ceiling holds instead of fabricating load',()=>{
    // The reported card: Band Pull Apart 0×10@10 → "Add weight · 1 rep".
    // The range change cannot rebase a weightless basis (latest.weight>0
    // guard), and the fall-through add-load-and-reset path must not invent
    // a load step off 0 lb.
    workoutState.completed=[mkLog('w1','2026-09-12',[
      mkItem('band-pull-apart',[{w:0,r:10,rpe:10}],{progression:OLD_RANGE})])];
    const s=progressionForExercise('band-pull-apart',NEW_RANGE,ON(0));
    assert.ok(s,'the hold carries its notice instead of vanishing');
    assert.equal(s.kind,'hold','no load is prescribed off a 0-lb basis');
    assert.equal(s.nextWeight,0,'weight stays 0 — never a phantom "Add weight"');
    assert.ok(!/add/i.test(s.reason)||/no load/i.test(s.reason),'reason does not promise added load: '+s.reason);
  });
  it('a 0-lb exercise below its ceiling still adds reps',()=>{
    // Bodyweight rep progression is legitimate — only the load step is
    // forbidden.
    workoutState.completed=[mkLog('w1','2026-09-12',[
      mkItem('band-pull-apart',[{w:0,r:8,rpe:7}],{progression:{mode:'reps',min:1,max:12}})])];
    const s=progressionForExercise('band-pull-apart',
      {mode:'reps',min:1,max:12,custom:true},CFG(5));
    assert.ok(s&&s.kind==='reps','reps advance off a weightless basis: '+JSON.stringify(s&&s.kind));
    assert.equal(s.nextWeight,0);
  });
});

describe('QA batch 2026-09-22 (4): per-dumbbell rebase stays on the 2× grid',()=>{
  it('the canonical total is always a multiple of 2× the increment',()=>{
    // 30 canonical (15/db) ×12@8, rebase 6–12 → 1–5, 5-lb increment:
    // e1RM 44 → 5-rep target 37.71 → doubled 10-lb grid → 40 canonical
    // (20/db). An odd canonical total would halve into a phantom 18.5/db.
    workoutState.completed=[mkLog('w1','2026-09-12',[
      mkItem('db-lateral-raise',[{w:30,r:12,rpe:8}],{progression:OLD_RANGE})])];
    const s=progressionForExercise('db-lateral-raise',NEW_RANGE,CFG(5));
    assert.ok(s&&s.kind==='range','rebase runs: '+JSON.stringify(s&&s.kind));
    assert.equal(s.nextWeight,40,'doubled grid: 37.71 → 40, never 35/37');
    assert.equal(s.nextWeight%10,0,'canonical total is a multiple of 2× increment');
    assert.equal(s.nextWeight/2,20,'per-hand load is a real dumbbell');
  });
});
