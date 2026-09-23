'use strict';
/* Role: progression-logic — the app's brain. Pins top-set selection,
   increment rounding, the RPE-gated double progression, linear mode,
   time mode, AMRAP/open-top, the #79 no-op suppression, freestyle
   follow-the-lifter, same-zone history selection, and the v1.001 %1RM +
   scheduled-deload additions. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const {
  topSetForSession, roundedIncrement,
  clampPct1RM, clampDeloadPct,
  programPctForWeek, isDeloadWeek,
  progressionForExercise, workoutState, progressionSetup,
  normalizeProgression,
}=loadRole('progression-logic');

const CFG=()=>({scheme:'rpe',threshold:8,incrementType:'lb',incrementValue:5,timeStep:5});
const PROF=()=>({mode:'reps',min:6,max:12});

beforeEach(()=>{
  /* #577: linear is now the app default; these tests exercise RPE mechanics. */
  progressionSetup.scheme='rpe';
  workoutState.completed=[];
  workoutState.activeProgram=null;
  progressionSetup.units='imperial';
});

describe('topSetForSession',()=>{
  it('heaviest weight wins',()=>{
    const top=topSetForSession({tracking:'reps',sets:[{w:135,r:8},{w:140,r:5}]});
    assert.equal(top.weight,140);
    assert.equal(top.reps,5);
  });
  it('ties break by reps',()=>{
    const top=topSetForSession({tracking:'reps',sets:[{w:140,r:5},{w:140,r:8}]});
    assert.equal(top.reps,8);
    assert.equal(top.index,1);
  });
  it('detects time mode and picks most seconds',()=>{
    const top=topSetForSession({tracking:'time',sets:[{w:'',seconds:40},{w:'',seconds:45}]});
    assert.equal(top.mode,'time');
    assert.equal(top.seconds,45);
  });
  it('set tags never influence selection (documented invariant)',()=>{
    const top=topSetForSession({tracking:'reps',sets:[
      {w:140,r:5,tags:['To failure']},
      {w:140,r:8,tags:[]},
    ]});
    assert.equal(top.reps,8);
  });
  it('empty or missing sets → null',()=>{
    assert.equal(topSetForSession({tracking:'reps',sets:[]}),null);
    assert.equal(topSetForSession({tracking:'reps'}),null);
    assert.equal(topSetForSession(null),null);
  });
  it("blank RPE ('') means no RPE logged, never RPE 0 (#370)",()=>{
    const top=topSetForSession({tracking:'reps',sets:[{w:140,r:8,rpe:''}]});
    assert.equal(top.rpe,null);
    const ws=topSetForSession({tracking:'reps',sets:[{w:140,r:8,rpe:'   '}]});
    assert.equal(ws.rpe,null);
    const n=topSetForSession({tracking:'reps',sets:[{w:140,r:8,rpe:null}]});
    assert.equal(n.rpe,null);
    const v=topSetForSession({tracking:'reps',sets:[{w:140,r:8,rpe:7}]});
    assert.equal(v.rpe,7);
  });
});

describe('roundedIncrement',()=>{
  it('#246/#473: percent compounds and snaps to the 5 lb grid',()=>{
    assert.equal(roundedIncrement(100,'percent',5),105);
    assert.equal(roundedIncrement(97.3,'percent',5),100); // 102.165 → 100
  });
  it('#246: lb adds and snaps to the increment grid',()=>{
    assert.equal(roundedIncrement(97.3,'lb',5),100); // 102.3 → the 5-lb grid
    assert.equal(roundedIncrement(100,'lb',2.5),102.5);
    assert.equal(roundedIncrement(100,'lb',5),105);
  });
});

describe('progressionForExercise — double progression',()=>{
  it('RPE at/below threshold + reps below max → add headroom-scaled reps (#387)',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:8,rpe:7},{w:140,r:6,rpe:8}])])];
    const s=progressionForExercise('bench-press',PROF(),CFG());
    assert.equal(s.kind,'reps');
    assert.equal(s.nextReps,11);
    assert.equal(s.nextWeight,140);
  });
  it('rep ceiling reached → add load, reset to min',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:12,rpe:7}])])];
    const s=progressionForExercise('bench-press',PROF(),CFG());
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,150,'140 + 1.5×5 lb RPE-scaled step, snapped to the 5 lb grid');
    assert.equal(s.nextReps,6);
  });
  it('RPE above threshold → informational hold notice, not a vanished card (#79, QA batch)',()=>{
    /* QA batch (user 2026-09-21): a top set above the trigger used to vanish
       through the #79 no-change check — the user read the missing card as
       broken progression. Now it surfaces a non-tappable notice naming the
       cause, like the missing-RPE case. */
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:8,rpe:9}])])];
    const s=progressionForExercise('bench-press',PROF(),CFG());
    assert.ok(s,'notice suggestion exists');
    assert.equal(s.kind,'hold');
    assert.ok(s.notice,'the notice flag is set');
    assert.equal(s.notice.title,'Held at RPE 9');
  });
  it('null RPE → informational notice, not a no-op hold card (#79, #565)',()=>{
    /* #565: a missing RPE used to vanish through the #79 no-change check —
       beginners saw no suggestion and no explanation. Now it surfaces a
       non-tappable notice naming the cause. */
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:8,rpe:null}])])];
    const s=progressionForExercise('bench-press',PROF(),CFG());
    assert.ok(s,'notice suggestion exists');
    assert.equal(s.kind,'hold');
    assert.ok(s.notice,'the notice flag is set');
    assert.equal(s.notice.title,'No RPE logged');
    assert.ok(s.reason.includes('No RPE'),s.reason);
  });
  /* QA batch (user 2026-09-21, #11): progression suggestions were missing
     when a top set hit RPE 10 — the high-RPE hold vanished through the #79
     no-change check. Now it survives as an informational notice. */
  it('single top set at RPE 10 → "Held at RPE 10" notice',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:8,rpe:10}])])];
    const s=progressionForExercise('bench-press',PROF(),CFG());
    assert.ok(s,'notice suggestion exists');
    assert.equal(s.kind,'hold');
    assert.ok(s.notice,'the notice flag is set');
    assert.equal(s.notice.title,'Held at RPE 10');
    assert.ok(s.notice.body.includes('above the RPE 8 trigger'),s.notice.body);
  });
  it('lower-RPE set followed by a qualifying RPE-10 top set → notice',()=>{
    /* The later RPE-10 set has more reps at the same load, so topSetForSession
       picks it as the basis — the card must explain the hold, not vanish. */
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:6,rpe:7},{w:140,r:8,rpe:10}])])];
    const s=progressionForExercise('bench-press',PROF(),CFG());
    assert.ok(s,'notice suggestion exists');
    assert.equal(s.kind,'hold');
    assert.equal(s.notice?.title,'Held at RPE 10');
  });
  it('exact-tie sets keep the lower RPE as the basis (no hold notice)',()=>{
    /* Same load and reps — topSetForSession prefers the lower RPE regardless
       of order, so the RPE-7 set drives a normal rep progression. */
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:8,rpe:7},{w:140,r:8,rpe:10}])])];
    const s=progressionForExercise('bench-press',PROF(),CFG());
    assert.ok(s,'suggestion exists');
    assert.equal(s.kind,'reps');
    assert.equal(s.notice,null,'no hold notice — the RPE-7 set is the basis');
  });
  it('245x2 @ RPE 7 in 6–12 is untouched by the hold-notice change',()=>{
    /* Accepted 2026-09-20 example: below the range floor, the engine holds
       rather than prescribing 250x6 — and no RPE notice fires at RPE 7. */
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:245,r:2,rpe:7}])])];
    const s=progressionForExercise('bench-press',PROF(),CFG());
    assert.ok(s,'suggestion exists');
    assert.equal(s.kind,'hold');
    assert.equal(s.nextWeight,245);
    assert.ok(!s.notice||s.notice.title!=='Held at RPE 7','no RPE hold notice — RPE 7 is at/below the trigger');
  });
  it("blank RPE ('') → informational notice, never a progression trigger (#370, #565)",()=>{
    /* #370: Number('')===0 let a blank RPE slip through the RPE<=threshold
       gate and fire a suggestion with no RPE logged. Blank behaves like
       null: the engine holds — and #565 explains why. */
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:8,rpe:''}])])];
    const s=progressionForExercise('bench-press',PROF(),CFG());
    assert.ok(s,'notice suggestion exists');
    assert.equal(s.kind,'hold');
    assert.ok(s.notice,'the notice flag is set');
  });
  it("blank RPE ('') must not inflate the %1RM auto training-max basis (#370)",()=>{
    /* 315x5 with no RPE: correct Epley is 367.5. The buggy path fed rpe 0
       into estimate1RM (rir = 10-0 = 10) and produced 472.5, corrupting the
       auto training max and evading the #250 no-regression guard. */
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:315,r:5,rpe:''}])])];
    const s=progressionForExercise('bench-press',
      {...PROF(),min:5,max:8,scheme:'onerm'},CFG());
    assert.equal(s.kind,'onerm');
    assert.ok(Math.abs(s.estimated1RM-367.5)<0.001,
      `auto training-max basis should be 367.5, got ${s.estimated1RM}`);
  });
  it('repsOnly at the ceiling → null, not a no-op hold card (#79)',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:12,rpe:7}])])];
    assert.equal(
      progressionForExercise('bench-press',{...PROF(),repsOnly:true},CFG()),null);
  });
  it("linear scheme adds the increment every session even when reps were missed (user's 2026-09-11 call)",()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:6,rpe:10}])])];
    const s=progressionForExercise('bench-press',{...PROF(),scheme:'linear'},CFG());
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,145);
    assert.equal(s.nextReps,6);
  });
  it('no history → null',()=>{
    assert.equal(progressionForExercise('bench-press',PROF(),CFG()),null);
  });
  it('time mode below ceiling → add RPE-scaled seconds (#387)',()=>{
    // #387: the time step scales by the RPE jump — top set 45s @ RPE 8
    // earns +2 steps (5s each), not a flat +5s.
    // #490 follow-up: the trigger runs on the raw top-set RPE, so a
    // single-set basis is all this needs.
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{seconds:45,rpe:8}],{tracking:'time'})])];
    const s=progressionForExercise('bench-press',
      {mode:'time',timeMin:30,timeMax:60,timeStep:5},CFG());
    assert.equal(s.kind,'time');
    assert.equal(s.nextSeconds,55);
  });
  it('time ceiling reached → add load, reset seconds',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:100,seconds:60,rpe:7}],{tracking:'time'})])];
    const s=progressionForExercise('bench-press',
      {mode:'time',timeMin:30,timeMax:60,timeStep:5},CFG());
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,110,'100 + 1.5×5 lb RPE-scaled step, snapped to the 5 lb grid');
    assert.equal(s.nextSeconds,30);
  });
  it('openTop → +3 reps at RPE 7, no ceiling load-jump (#387)',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:18,rpe:7}])])];
    const s=progressionForExercise('bench-press',
      {mode:'reps',min:15,openTop:true},CFG());
    assert.equal(s.kind,'reps');
    assert.equal(s.nextReps,21);
    assert.equal(s.nextWeight,140);
  });
  it('#79: a suggestion identical to the latest top set returns null (AMRAP collapses to a no-op)',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:10,rpe:7}])])];
    assert.equal(
      progressionForExercise('bench-press',{...PROF(),amrap:true,min:1,max:null},CFG()),
      null);
  });
  it('#79: linear + repsOnly is a no-op → null, not a hold card',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:8,rpe:7}])])];
    assert.equal(
      progressionForExercise('bench-press',{...PROF(),scheme:'linear',repsOnly:true},CFG()),
      null);
  });
  it('suggests from the most recent SAME-ZONE log, not the newest log',()=>{
    workoutState.completed=[
      mkLog('w2','2026-09-10',[mkItem('bench-press',[{w:140,r:4,rpe:7}])]),
      mkLog('w1','2026-09-08',[mkItem('bench-press',[{w:130,r:8,rpe:7}])]),
    ];
    const s=progressionForExercise('bench-press',PROF(),CFG());
    assert.equal(s.kind,'reps');
    assert.equal(s.nextWeight,130);
    assert.equal(s.nextReps,11);
  });
  it('freestyle freeform follows the lifter’s latest zone instead of rebasing into defaults',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:4,rpe:7}])])];
    const s=progressionForExercise('bench-press',
      {mode:'reps',min:6,max:12},{...CFG(),freeform:true});
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,150,'140 + 1.5×5 lb RPE-scaled step, snapped to the 5 lb grid');
    assert.equal(s.nextReps,4);
    assert.deepEqual(s.range,[4,4]);
  });
});

describe('progressionForExercise — %1RM prescription (v1.001)',()=>{
  it('entered training max needs no history (TM-first basis)',()=>{
    const s=progressionForExercise('bench-press',
      {scheme:'onerm',trainingMax:200,percentOf1RM:80,min:6,max:12},CFG());
    assert.equal(s.kind,'onerm');
    assert.equal(s.pct,80);
    assert.equal(s.tmSource,'manual');
    assert.equal(s.nextWeight,160);
    assert.equal(s.nextReps,6);
    assert.match(s.reason,/training max/);
  });
  it('no training max → basis is the best same-zone top-set e1RM',()=>{
    workoutState.completed=[
      mkLog('w2','2026-09-10',[mkItem('bench-press',[{w:180,r:10,rpe:7}])]), // e1RM 258
      mkLog('w1','2026-09-08',[mkItem('bench-press',[{w:200,r:5,rpe:9}])]),  // e1RM 240
    ];
    const s=progressionForExercise('bench-press',
      {scheme:'onerm',min:6,max:12},CFG());
    assert.equal(s.kind,'onerm');
    assert.equal(s.tmSource,'auto');
    assert.equal(s.pct,75); // program default
    assert.equal(s.nextWeight,195); // 258×0.75=193.5 → plate-snapped to 195
    assert.match(s.reason,/auto training max/);
  });
  it('percent is clamped to 1–100 (unset/invalid → 75)',()=>{
    assert.equal(clampPct1RM(150),100);
    assert.equal(clampPct1RM(0),75);
    assert.equal(clampPct1RM(-5),75);
    assert.equal(clampPct1RM(''),75);
    assert.equal(clampPct1RM(80),80);
    const s=progressionForExercise('bench-press',
      {scheme:'onerm',trainingMax:200,percentOf1RM:150,min:6,max:12},CFG());
    assert.equal(s.pct,100);
    assert.equal(s.nextWeight,200);
  });
  it('v1.878 restructure: snapPlateLoad deleted (plate snap reversed per #246); its tests removed.',()=>{
    assert.equal(typeof snapPlateLoad,'undefined');
  });
  it('onerm with no basis at all → null (no card)',()=>{
    assert.equal(
      progressionForExercise('bench-press',{scheme:'onerm',min:6,max:12},CFG()),
      null);
  });
});

describe('progressionForExercise — scheduled deloads (v1.001)',()=>{
  const DELOAD_LOGS=()=>[mkLog('w1','2026-09-10',[
    mkItem('bench-press',[{w:140,r:8,rpe:7}])])];
  it('deload week (wave flag) → reduced load, kind deload',()=>{
    workoutState.completed=DELOAD_LOGS();
    const s=progressionForExercise('bench-press',PROF(),
      {...CFG(),currentWeek:4,pctWave:true,weeklyDeloads:[false,false,false,true],deloadPct:60});
    assert.equal(s.kind,'deload');
    assert.equal(s.nextWeight,85); // 140×0.6=84 → snapped to 85
    assert.match(s.reason,/Week 4 is a scheduled deload/);
  });
  it('deloads are never inferred: a non-scheduled week follows the normal path',()=>{
    workoutState.completed=DELOAD_LOGS();
    const s=progressionForExercise('bench-press',PROF(),
      {...CFG(),currentWeek:3,pctWave:true,weeklyDeloads:[false,false,false,true]});
    assert.equal(s.kind,'reps');
  });
  it('weeklyDeloads flags mark scheduled weeks only while the wave is on (#478)',()=>{
    workoutState.completed=DELOAD_LOGS();
    const s=progressionForExercise('bench-press',PROF(),
      {...CFG(),currentWeek:2,pctWave:true,weeklyDeloads:[false,true]});
    assert.equal(s.kind,'deload');
    assert.equal(isDeloadWeek({pctWave:true,weeklyDeloads:[false,true]},1),false);
  });
  it('deload skips the linear increment (deload wins)',()=>{
    workoutState.completed=DELOAD_LOGS();
    const s=progressionForExercise('bench-press',{...PROF(),scheme:'linear'},
      {...CFG(),currentWeek:4,pctWave:true,weeklyDeloads:[false,false,false,true],deloadPct:60});
    assert.equal(s.kind,'deload');
    assert.equal(s.nextWeight,85); // reduced, NOT 145
  });
  it('onerm deload: the reduced load still targets the range minimum',()=>{
    const s=progressionForExercise('bench-press',
      {scheme:'onerm',trainingMax:200,percentOf1RM:80,min:6,max:12},
      {...CFG(),currentWeek:4,pctWave:true,weeklyDeloads:[false,false,false,true],deloadPct:60});
    assert.equal(s.kind,'deload');
    assert.equal(s.nextWeight,95); // 160×0.6=96 → snapped to 95
    assert.equal(s.nextReps,6);
  });
  it('deload pct clamps to 40–80 (unset/invalid → 60)',()=>{
    assert.equal(clampDeloadPct(60),60);
    assert.equal(clampDeloadPct(10),40);
    assert.equal(clampDeloadPct(90),80);
    assert.equal(clampDeloadPct(0),60);
  });
});

describe('programPctForWeek / isDeloadWeek',()=>{
  it('weekly % wave: explicit entries beat the flat percent',()=>{
    assert.equal(programPctForWeek({pctWave:true,weeklyPcts:[70,75,80]},2),75);
  });
  it('the wave loops across the program length',()=>{
    assert.equal(programPctForWeek({pctWave:true,weeklyPcts:[70,75,80]},4),70);
  });
  it('disabled wave leaves stale weeklyPcts inert → null',()=>{
    assert.equal(programPctForWeek({pctWave:false,weeklyPcts:[70]},1),null);
    assert.equal(programPctForWeek({},1),null);
  });
  it('isDeloadWeek: flag panel only, never inferred (#478: flags need the wave)',()=>{
    assert.equal(isDeloadWeek({pctWave:true,weeklyDeloads:[false,false,false,true]},4),true);
    assert.equal(isDeloadWeek({pctWave:true,weeklyDeloads:[false,false,false,true]},3),false);
    assert.equal(isDeloadWeek({pctWave:true,weeklyDeloads:[false,true]},2),true);
    assert.equal(isDeloadWeek({pctWave:false,weeklyDeloads:[false,true]},2),false);
    assert.equal(isDeloadWeek({},2),false);
    assert.equal(isDeloadWeek({pctWave:true,weeklyDeloads:[false,true]},0),false);
  });
  it('isDeloadWeek: per-week flags go inert when the wave is off (#478)',()=>{
    assert.equal(isDeloadWeek({weeklyDeloads:[false,true]},2),false);
    assert.equal(isDeloadWeek({pctWave:true,weeklyDeloads:[false,true]},2),true);
  });
});

describe('normalizeProgression — Auto Deload removal (QA batch 2026-09-22)',()=>{
  it('stored autoDeload/deloadEvery keys are deleted',()=>{
    const p={autoDeload:true,deloadEvery:4,threshold:8};
    normalizeProgression(p);
    assert.ok(!('autoDeload' in p),'autoDeload key gone');
    assert.ok(!('deloadEvery' in p),'deloadEvery key gone');
    assert.equal(p.threshold,8,'other keys untouched');
  });
  it('deloadPct survives (it sizes the manual wave-panel deload flags)',()=>{
    const p={autoDeload:false,deloadPct:55};
    normalizeProgression(p);
    assert.equal(p.deloadPct,55,'deloadPct preserved');
  });
  it('defaults ship with no auto-deload keys',()=>{
    assert.ok(!('autoDeload' in progressionSetup),'autoDeload not in defaults');
    assert.ok(!('deloadEvery' in progressionSetup),'deloadEvery not in defaults');
  });
});

describe('progressionForExercise — #300: the RPE trigger gates the range rebase',()=>{
  it('RPE-10 top set 405x3 rebased into 1–3 → hold notice, never 405x1',()=>{
    // #300's exact repro: previous zone 3–6, the lifter starts a 1–3 strength
    // block. e1RM = 405×(1+3/30) = 445.5 → raw rebase 445.5/(1+3/30) = 405,
    // exactly the top-set weight, so the #250 weight floor can't fire — but
    // nextReps would still collapse 3 → 1. A true-max top set earns no
    // progression; the QA batch (user 2026-09-21, #11) surfaces a "Held at
    // RPE 10" notice instead of a rep-regressed card or silence.
    workoutState.completed=[
      mkLog('w2','2026-09-09',[mkItem('barbell-deadlift',[{w:405,r:4,rpe:10}],
        {progression:{mode:'reps',min:3,max:6}})]),
      mkLog('w1','2026-09-01',[mkItem('barbell-deadlift',[{w:405,r:3,rpe:10}],
        {progression:{mode:'reps',min:3,max:6}})]),
    ];
    const s=progressionForExercise('barbell-deadlift',
      {mode:'reps',min:1,max:3,custom:true},CFG());
    assert.ok(s,'a hold notice is produced');
    assert.equal(s.kind,'hold');
    assert.equal(s.notice?.title,'Held at RPE 10');
    assert.ok(s.nextReps!==1||s.nextWeight!==405,'never a 405x1 regression card');
  });
  it('RPE 9 on a range change → "Held at RPE 9" notice via the RPE gate (#250 case, new mechanism)',()=>{
    // 245x1 @ RPE 9 rebased 6–12 → 1–5. The #250 floor would also catch this
    // (224 < 245), but the RPE gate must fire first: above the trigger, no
    // rebase happens at all. QA batch (user 2026-09-21, #11): the gate now
    // surfaces a hold notice instead of silence.
    workoutState.completed=[mkLog('w1','2026-09-11',[
      mkItem('barbell-deadlift',[{w:245,r:1,rpe:9}],
        {progression:{mode:'reps',min:6,max:12}})])];
    const s=progressionForExercise('barbell-deadlift',
      {mode:'reps',min:1,max:5,custom:true},CFG());
    assert.ok(s,'a hold notice is produced');
    assert.equal(s.kind,'hold');
    assert.equal(s.notice?.title,'Held at RPE 9');
  });
  it('at/below-trigger top set on a range change still earns progression (gate is not a ceiling)',()=>{
    // 405x3 @ RPE 8 → 1–3 block. #381: the top set already sits at the top of
    // the new range, so there is nothing to rebase — the standard double
    // progression handles it (rep ceiling → +5 lb, back to the range
    // minimum), the same card as if the range had never changed.
    workoutState.completed=[mkLog('w1','2026-09-09',[
      mkItem('barbell-deadlift',[{w:405,r:3,rpe:8}],
        {progression:{mode:'reps',min:3,max:6}})])];
    const s=progressionForExercise('barbell-deadlift',
      {mode:'reps',min:1,max:3,custom:true},CFG());
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,410);
    assert.equal(s.nextReps,1);
  });
  it('#381: in-zone top set on a range change never mints a rep-regression card',()=>{
    // The user's exact scenario: 110x10 @ RPE 8, previous zone 1–5, new zone
    // 6–12 (focus pill tap). The old code rebased to 110x6 at the same load —
    // a regression. Now the set is already in the new range, so double
    // progression applies: 110x10 → 110x12 (#387: rep steps are ≥ 2).
    workoutState.completed=[mkLog('w1','2026-09-11',[
      mkItem('dumbbell-bench-press',[{w:110,r:10,rpe:8}],
        {progression:{mode:'reps',min:1,max:5}})])];
    const s=progressionForExercise('dumbbell-bench-press',
      {mode:'reps',min:6,max:12,custom:true},CFG());
    assert.equal(s.kind,'reps');
    assert.equal(s.nextWeight,110);
    assert.equal(s.nextReps,12);
  });
  it('#381/#428: a genuinely out-of-zone top set still earns a rebase card',()=>{
    // 110x10 @ RPE 8, previous zone 6–12, new strength zone 1–5: the set is
    // outside the new range, so the e1RM rebase runs — e1RM = 154 →
    // 154/(1+5/30) = 132 → 5-lb snap (the #394 plate-snapping rule) → 130.
    // #428: the load was computed for 5 reps, so the card prescribes 5 reps
    // (130x5) — never the old 1-rep max-test card (130x1).
    workoutState.completed=[mkLog('w1','2026-09-11',[
      mkItem('dumbbell-bench-press',[{w:110,r:10,rpe:8}],
        {progression:{mode:'reps',min:6,max:12}})])];
    const s=progressionForExercise('dumbbell-bench-press',
      {mode:'reps',min:1,max:5,custom:true},CFG());
    assert.equal(s.kind,'range');
    assert.equal(s.nextWeight,130);
    assert.equal(s.nextReps,5);
  });
  it('#246: range rebase snaps to the increment grid — never decimals',()=>{
    // The user's 15+ report: 7.5x12 @ RPE 8 rebased into 15+ showed 7.7 lb.
    // #246 (user 2026-09-14): the increment setting is what it's there for,
    // not a plate snap — the rebased load snaps to the 5-lb grid. The raw
    // rebase is ~7.33; snapping down to 5 would regress below the 7.5 top
    // set, so it rounds UP to the next grid multiple: 10x15.
    workoutState.completed=[mkLog('w1','2026-09-11',[
      mkItem('cable-external-rotation',[{w:7.5,r:12,rpe:8}],
        {progression:{mode:'reps',min:6,max:12}})])];
    const s=progressionForExercise('cable-external-rotation',
      {mode:'reps',min:15,openTop:true,custom:true},CFG());
    assert.equal(s.kind,'range');
    assert.equal(s.nextWeight,10);
    assert.equal(s.nextReps,15);
  });
  it('#394/#428: range rebase snaps to 5 lb like the other formula-derived prescriptions',()=>{
    // The user's lat-pulldown report: 100x8 (no RPE) rebased into Strength
    // 1–5 showed 108.5 — 0.5-granular but reading unrounded next to the
    // 5-lb-snapped %1RM/deload/warm-up prescriptions. e1RM = 100×(1+8/30) =
    // 126.67 → 126.67/(1+5/30) = 108.57 → snaps to 110, prescribed at the
    // load's own 5 reps (#428: never the old 110x1).
    workoutState.completed=[mkLog('w1','2026-09-11',[
      mkItem('dumbbell-bench-press',[{w:100,r:8}],
        {progression:{mode:'reps',min:6,max:12}})])];
    const s=progressionForExercise('dumbbell-bench-press',
      {mode:'reps',min:1,max:5,custom:true},CFG());
    assert.equal(s.kind,'range');
    assert.equal(s.nextWeight,110);
    assert.equal(s.nextReps,5);
  });
  it('#246: the increment snap never drops below the top set — rounds up',()=>{
    // 7.5x12 @ RPE 8 into 15+: the raw rebase is ~7.33, whose 5-lb snap (5)
    // would regress below the 7.5 top set — so it rounds UP to the next
    // increment multiple (10) instead of dropping to a finer grain. The
    // #250 guard never has to kill the card.
    workoutState.completed=[mkLog('w1','2026-09-11',[
      mkItem('cable-external-rotation',[{w:7.5,r:12,rpe:8}],
        {progression:{mode:'reps',min:6,max:12}})])];
    const s=progressionForExercise('cable-external-rotation',
      {mode:'reps',min:15,openTop:true,custom:true},CFG());
    assert.equal(s.kind,'range');
    assert.equal(s.nextWeight,10);
    assert.equal(s.nextReps,15);
  });
  it('rebase respects reps-only: an informational hold, not a load change (#557)',()=>{
    // 110x10 @ RPE 8, previous zone 6–12, new zone 1–5, reps-only on: the
    // rebase would prescribe 130x5 — a load change the user ruled out.
    // Hold the top set instead; #557 surfaces a "New rep range" notice so
    // the cross-zone switch doesn't read as the engine going silent.
    workoutState.completed=[mkLog('w1','2026-09-11',[
      mkItem('dumbbell-bench-press',[{w:110,r:10,rpe:8}],
        {progression:{mode:'reps',min:6,max:12}})])];
    const s=progressionForExercise('dumbbell-bench-press',
      {mode:'reps',min:1,max:5,custom:true,repsOnly:true},CFG());
    assert.ok(s,'notice suggestion exists');
    assert.equal(s.kind,'hold');
    assert.ok(s.notice,'the notice flag is set');
    assert.equal(s.notice.title,'New rep range');
  });
});

describe('progressionForExercise — #250: rebased targets never regress below the top set',()=>{
  it('top set 245x1 @ RPE 9 rebased into 1–5 → no regressing card (224 lb would be a step back)',()=>{
    // The user's exact scenario: previous zone 6–12, new strength zone 1–5.
    // e1RM = 245×(1+(1+1)/30) ≈ 261 → raw rebase 261/(1+5/30) = 224 < 245.
    workoutState.completed=[mkLog('w1','2026-09-11',[
      mkItem('barbell-deadlift',[
        {w:95,r:4,rpe:1},{w:145,r:4,rpe:6},{w:245,r:1,rpe:9},
      ],{progression:{mode:'reps',min:6,max:12}})])];
    const s=progressionForExercise('barbell-deadlift',
      {mode:'reps',min:1,max:5,custom:true},CFG());
    // The floor holds the top set; the QA batch (user 2026-09-21, #11) keeps
    // the card as a "Held at RPE 9" notice instead of #79 silence.
    assert.ok(s,'a hold notice is produced');
    assert.ok(s.nextWeight>=245,
      '#250: the engine must never suggest below the 245 lb top set');
    assert.equal(s.notice?.title,'Held at RPE 9');
  });
  it('#381: in-zone range change never dips below the top set — double progression applies',()=>{
    // 200x8 @ RPE 7, previous zone 6–8, new zone 6–12: the set already sits
    // inside the new range, so no e1RM rebase runs at all — the old code
    // rebased to 195 (below the top set) and then held/suppressed. Now the
    // standard path suggests 200x10 directly (#387: rep steps are ≥ 2).
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:200,r:8,rpe:7}],
        {progression:{mode:'reps',min:6,max:8}})])];
    const s=progressionForExercise('bench-press',
      {mode:'reps',min:6,max:12,custom:true},CFG());
    assert.ok(!s||s.nextWeight>=200,
      '#250: the engine must never suggest below the 200 lb top set');
    assert.equal(s.kind,'reps');
    assert.equal(s.nextWeight,200);
    assert.equal(s.nextReps,11);
  });
  it('#381: in-zone top set on a range change uses double progression, not a rebase',()=>{
    // 200x8 @ RPE 7, previous zone 6–8, new zone 6–12: the set already sits
    // inside the new range, so the e1RM rebase is skipped — standard double
    // progression (200x8 → 200x11, #387) instead of a 205x6 remap.
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:200,r:8,rpe:7}],
        {progression:{mode:'reps',min:6,max:8}})])];
    const s=progressionForExercise('bench-press',
      {mode:'reps',min:6,max:12,custom:true},CFG());
    assert.equal(s.kind,'reps');
    assert.equal(s.nextWeight,200);
    assert.equal(s.nextReps,11);
  });
});

describe('progressionForExercise — same-zone fallback (user 2026-09-13)',()=>{
  it('RPE-gated same-zone history falls back to the most recent log',()=>{
    // The user's exact symptom: an older 1–5 session topped out at RPE 10,
    // so the same-zone basis held and suppressed — while newer 110x10 @ RPE 8
    // history (6–12 zone) sat unused and the UI said "not enough valid data".
    // Now the engine rebases from the most recent log instead of going silent.
    workoutState.completed=[
      mkLog('w2','2026-09-03',[
        mkItem('dumbbell-bench-press',[{w:110,r:10,rpe:8}],
          {progression:{mode:'reps',min:6,max:12}})]),
      mkLog('w1','2026-08-01',[
        mkItem('dumbbell-bench-press',[{w:100,r:5,rpe:10}],
          {progression:{mode:'reps',min:1,max:5}})]),
    ];
    const s=progressionForExercise('dumbbell-bench-press',
      {mode:'reps',min:1,max:5,custom:true},CFG(),true);
    assert.ok(s,'a card is produced from the recent history');
    assert.equal(s.kind,'range');
    assert.equal(s.nextWeight,130); // 132 raw → 5-lb snap (#394)
    assert.equal(s.nextReps,5); // #428: the rebase load's own rep count, never 1
    assert.equal(s.sourceDate,'2026-09-03');
  });
  it('no fallback when the same-zone basis already earns a suggestion',()=>{
    // 100x5 @ RPE 8 in-zone → standard double progression; the newer
    // out-of-zone log must not hijack the basis.
    workoutState.completed=[
      mkLog('w2','2026-09-03',[
        mkItem('dumbbell-bench-press',[{w:110,r:10,rpe:8}],
          {progression:{mode:'reps',min:6,max:12}})]),
      mkLog('w1','2026-08-01',[
        mkItem('dumbbell-bench-press',[{w:100,r:5,rpe:8}],
          {progression:{mode:'reps',min:1,max:5}})]),
    ];
    const s=progressionForExercise('dumbbell-bench-press',
      {mode:'reps',min:1,max:5,custom:true},CFG(),true);
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,105);
    assert.equal(s.nextReps,1);
    assert.equal(s.sourceDate,'2026-08-01');
  });
  it('no fallback when there is no newer out-of-zone history',()=>{
    // Only the gated in-zone session exists — the QA batch (user 2026-09-21,
    // #11) surfaces a "Held at RPE 10" notice instead of silence.
    workoutState.completed=[mkLog('w1','2026-08-01',[
      mkItem('dumbbell-bench-press',[{w:100,r:5,rpe:10}],
        {progression:{mode:'reps',min:1,max:5}})])];
    const s=progressionForExercise('dumbbell-bench-press',
      {mode:'reps',min:1,max:5,custom:true},CFG(),true);
    assert.ok(s,'a hold notice is produced');
    assert.equal(s.kind,'hold');
    assert.equal(s.notice?.title,'Held at RPE 10');
  });
});

describe('#387: rep jumps scale with RPE headroom, never a token +1',()=>{
  it('mid-range top set gets a +3 jump at RPE 7',()=>{
    workoutState.completed=[mkLog('w1','2026-09-13',[
      mkItem('bench-press',[{w:115,r:8,rpe:7}])])];
    const s=progressionForExercise('bench-press',PROF(),CFG());
    assert.equal(s.kind,'reps');
    assert.equal(s.nextReps,11,'8 → 11, not 9');
    assert.match(s.reason,/3 reps/);
  });
  it('a top set one rep below max advances load instead of overshooting (#387)',()=>{
    // 11 of 12: +3 would prescribe 14, outside the range — so the engine
    // takes the load path (user call), never faking the jump down to +1.
    workoutState.completed=[mkLog('w1','2026-09-13',[
      mkItem('bench-press',[{w:115,r:11,rpe:7}])])];
    const s=progressionForExercise('bench-press',PROF(),CFG());
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,125,'115 + 1.5×5 lb RPE-scaled step, snapped to the 5 lb grid');
    assert.equal(s.nextReps,6,'resets to range bottom');
    assert.match(s.reason,/exceed the 6–12 range/);
  });
  it('reps-only at max-1 → null, not an overshooting card (#387 + #79)',()=>{
    // Load progression is off and +3 would leave the range; the hold is a
    // no-op, so #79 suppresses the card entirely (same as ceiling holds).
    workoutState.completed=[mkLog('w1','2026-09-13',[
      mkItem('bench-press',[{w:115,r:11,rpe:7}])])];
    assert.equal(
      progressionForExercise('bench-press',
        {mode:'reps',min:6,max:12,repsOnly:true},CFG()),
      null);
  });
  it('open-top top set gets a +3 jump at RPE 7',()=>{
    workoutState.completed=[mkLog('w1','2026-09-13',[
      mkItem('bench-press',[{w:115,r:20,rpe:7}])])];
    const s=progressionForExercise('bench-press',
      {mode:'reps',min:15,openTop:true},CFG());
    assert.equal(s.kind,'reps');
    assert.equal(s.nextReps,23,'20 → 23, not 21');
  });
});
