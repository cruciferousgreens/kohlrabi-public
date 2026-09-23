'use strict';
/* QA batch (user 2026-09-21, #11): "Back into range" — generalized,
   literature-backed out-of-range guard for linear progression.

   When a linear top set lands BELOW the rep-range floor, the engine must not
   mint "add the increment and clamp the reps" (245×2 → 250×6): the range
   would be decorative. Instead the rep deficit (min − reps) is converted
   into a load adjustment through the published load↔reps relationships,
   targeting the mid-range rep count at the same RPE:

     Epley (1985): 1RM = w(1 + r/30), inverted for the target load.
       Epley, B. Poundage chart. Boyd Epley Workout. 1985.
     RPE/RIR (Zourdos et al., JSCR 2016): the RPE scale is anchored so
       RPE 10 = 0 reps in reserve and each point ≈ 1 RIR — RIR = 10 − RPE
       folds the set's RPE into the e1RM estimate.
       Zourdos, M.C. et al. Novel resistance training–specific rating of
       perceived exertion scale measuring repetitions in reserve.
       J. Strength Cond. Res. 30(1):267–275.
     NSCA %1RM-by-reps table (Essentials of Strength Training and
       Conditioning) as cross-check: Epley lands within ~1.5% of the table
       (5 reps: 85.7% vs 87%; 9 reps: 76.9% vs ~77%; 12 reps: 71.4% vs 70%).
     Brzycki (1993) converges on the same loads (within a rep); Epley is
       the primary because the app's estimate1RM already implements it.
       Brzycki, M. Strength testing—predicting a one-rep max from
       reps-to-fatigue. JOPERD 64(1):88–90.

   The RPE reveals the lifter's true rep capacity at the load (reps + RIR):
   capacity ≥ floor → the load is right for the range, hold it and build reps
   toward the top; capacity < floor → the load is too heavy, rebase from the
   RPE-adjusted e1RM onto mid-range at the same effort. The cut scales with
   the range by construction — no hardcoded hypertrophy special-case.

   The RPE-10 half of the batch: a top set at RPE 10 (or an RPE-10 set
   winning the top-set race) must still surface a card — an informational
   hold notice, never silence. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{globals:{exercises:[]}});
const {progressionForExercise,workoutState,progressionSetup}=role;

const linProfile=(over)=>Object.assign({mode:'reps',min:6,max:12,scheme:'linear'},over);
const rpeProfile=(over)=>Object.assign({mode:'reps',min:6,max:12,scheme:'rpe'},over);

beforeEach(()=>{
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

describe('#11: back into range (linear, top set below the range)',()=>{
  it('hypertrophy anchor: 245x2 @7 in 6-12 suggests Back into range 205x9',()=>{
    /* Worked: RIR = 10−7 = 3 → e1RM = 245(1+5/30) = 285.8 (Epley 1985);
       target 9 @7 (same effort) → 285.8/(1+12/30) = 204.2 → 205 on the
       5-lb grid. The literature formula lands on the anchor — no tuned
       constants. */
    workoutState.completed=[
      mkLog('w1','2026-09-19',[mkItem('squat',[{w:245,r:2,rpe:7}],{progression:linProfile()})]),
    ];
    const s=progressionForExercise('squat',linProfile());
    assert.ok(s,'a suggestion is produced');
    assert.equal(s.kind,'backrange');
    assert.equal(s.nextWeight,205,'RPE-adjusted Epley onto mid-range, snapped on the grid');
    assert.equal(s.nextReps,9,'middle of the 6-12 range');
    assert.match(s.reason,/Back into range/);
  });
  it('strength anchor: 245x2 @7 in 3-5 holds 245 and builds to 245x5 (no weight drop)',()=>{
    /* Capacity = 2 + 3 RIR = 5 ≥ floor 3: the load is right for the range,
       the set just ended early — hold and build reps, no correction, no
       "Back into range" label. */
    const strength=linProfile({min:3,max:5});
    workoutState.completed=[
      mkLog('w1','2026-09-19',[mkItem('squat',[{w:245,r:2,rpe:7}],{progression:strength})]),
    ];
    const s=progressionForExercise('squat',strength);
    assert.ok(s,'a suggestion is produced');
    assert.notEqual(s.kind,'backrange','no back-into-range rebase when capacity covers the floor');
    assert.equal(s.nextWeight,245,'weight is held, not cut');
    assert.equal(s.nextReps,5,'reps build toward the top of the range');
    assert.ok(!/Back into range/.test(s.reason),'no back-into-range label without a correction');
  });
  it('linear out-of-range never mints the blind increment',()=>{
    /* The regression that started the batch: 245×2 below 6–12 must not
       become 250×6. */
    workoutState.completed=[
      mkLog('w1','2026-09-19',[mkItem('squat',[{w:245,r:2,rpe:7}],{progression:linProfile()})]),
    ];
    const s=progressionForExercise('squat',linProfile());
    assert.ok(s);
    assert.notEqual(s.kind,'load','no increment kind below the floor');
    assert.ok(s.nextWeight<245,'the correction cuts or holds — never adds');
  });
  it('strength focus with a real deficit still corrects — and keeps the label',()=>{
    /* 245×1 @9 in 3–5: capacity = 1 + 1 = 2 < 3 → correction fires.
       e1RM = 245(1+2/30) = 261.3; target 4 @9 → 261.3/(1+5/30) = 224 → 225.
       Small cut, "Back into range" label kept — the label fires whenever
       the correction fires, whatever the focus. */
    const strength=linProfile({min:3,max:5});
    workoutState.completed=[
      mkLog('w1','2026-09-19',[mkItem('squat',[{w:245,r:1,rpe:9}],{progression:strength})]),
    ];
    const s=progressionForExercise('squat',strength);
    assert.ok(s);
    assert.equal(s.kind,'backrange');
    assert.equal(s.nextWeight,225,'small cut for a narrow low range');
    assert.equal(s.nextReps,4,'middle of the 3-5 range');
    assert.match(s.reason,/Back into range/);
  });
  it('endurance range yields a larger cut',()=>{
    /* 100×8 @8 in 12–20: capacity = 8 + 2 = 10 < 12 → correction.
       e1RM = 100(1+10/30) = 133.3; target 16 @8 → 133.3/(1+18/30) = 83.3
       → 85. High ranges correct harder than narrow low ones. */
    const endurance=linProfile({min:12,max:20});
    workoutState.completed=[
      mkLog('w1','2026-09-19',[mkItem('squat',[{w:100,r:8,rpe:8}],{progression:endurance})]),
    ];
    const s=progressionForExercise('squat',endurance);
    assert.ok(s);
    assert.equal(s.kind,'backrange');
    assert.equal(s.nextWeight,85,'larger cut for a high range');
    assert.equal(s.nextReps,16,'middle of the 12-20 range');
    assert.match(s.reason,/Back into range/);
  });
  it('a small deficit covered by RIR holds the load and builds reps',()=>{
    /* 200×5 @8 in 6–12: capacity = 5 + 2 = 7 ≥ 6 — the lifter basically
       had it; no cut, just double progression toward the top. */
    workoutState.completed=[
      mkLog('w1','2026-09-19',[mkItem('squat',[{w:200,r:5,rpe:8}],{progression:linProfile()})]),
    ];
    const s=progressionForExercise('squat',linProfile());
    assert.ok(s);
    assert.notEqual(s.kind,'backrange');
    assert.equal(s.nextWeight,200,'load held');
    assert.equal(s.nextReps,12,'reps build toward the top');
  });
  it('a below-floor set with no RPE still corrects via plain Epley',()=>{
    /* Missing RPE → RIR 0 → capacity 2 < 6 → correction from the
       unadjusted Epley 1RM (245(1+2/30) = 261.3): 261.3/1.3 = 201 →
       the #394 grid guard rounds up to 205. Never silent, never 250×6. */
    workoutState.completed=[
      mkLog('w1','2026-09-19',[mkItem('squat',[{w:245,r:2}],{progression:linProfile()})]),
    ];
    const s=progressionForExercise('squat',linProfile());
    assert.ok(s);
    assert.equal(s.kind,'backrange');
    assert.equal(s.nextWeight,205);
    assert.equal(s.nextReps,9);
    assert.match(s.reason,/Back into range/);
  });
  it('an in-range top set still takes the plain linear increment',()=>{
    workoutState.completed=[
      mkLog('w1','2026-09-19',[mkItem('squat',[{w:150,r:8,rpe:7}],{progression:linProfile()})]),
    ];
    const s=progressionForExercise('squat',linProfile());
    assert.ok(s);
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,155);
    assert.equal(s.nextReps,8);
  });
  it('a top set above the range keeps the clamp-into-range behavior',()=>{
    workoutState.completed=[
      mkLog('w1','2026-09-19',[mkItem('squat',[{w:100,r:15,rpe:7}],{progression:linProfile()})]),
    ];
    const s=progressionForExercise('squat',linProfile());
    assert.ok(s);
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,105);
    assert.equal(s.nextReps,12,'reps clamp to the range top');
  });
});

describe('#11: RPE-10 top sets still surface a card',()=>{
  it('a lone RPE-10 top set yields an informational hold notice, not null',()=>{
    workoutState.completed=[
      mkLog('w1','2026-09-19',[mkItem('bench-press',[{w:200,r:8,rpe:10}],{progression:rpeProfile()})]),
    ];
    const s=progressionForExercise('bench-press',rpeProfile());
    assert.ok(s,'the card explains itself instead of disappearing');
    assert.equal(s.kind,'hold');
    assert.ok(s.notice,'carries an informational notice');
    assert.equal(s.notice.title,'Held at RPE 10');
  });
  it('a lower-RPE set followed by an RPE-10 set at identical load/reps uses the better RPE',()=>{
    workoutState.completed=[
      mkLog('w1','2026-09-19',[mkItem('bench-press',[{w:225,r:6,rpe:8},{w:225,r:6,rpe:10}],{progression:rpeProfile()})]),
    ];
    const s=progressionForExercise('bench-press',rpeProfile());
    assert.ok(s,'the @8 set wins the top-set tie-break');
    assert.equal(s.kind,'reps','RPE 8 is at the trigger: reps advance');
  });
  it('an RPE-10 set that wins the top-set race still surfaces the hold notice',()=>{
    workoutState.completed=[
      mkLog('w1','2026-09-19',[mkItem('bench-press',[{w:225,r:6,rpe:8},{w:225,r:8,rpe:10}],{progression:rpeProfile()})]),
    ];
    const s=progressionForExercise('bench-press',rpeProfile());
    assert.ok(s,'no silent card');
    assert.equal(s.kind,'hold');
    assert.ok(s.notice);
    assert.equal(s.notice.title,'Held at RPE 10');
  });
});
