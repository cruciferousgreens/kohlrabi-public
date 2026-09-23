'use strict';
/* #400 (user 2026-09-14): "All sets" progression toggle — off by default; when
   on, back-off sets progress from their own baselines (cascade when the top
   set progresses, independent RPE-gated evaluation when it stalls). Per-set
   targets ride on suggestion.setTargets[]; missing back-off RPE holds;
   no baseline at a position means no target (never invented); back-off load
   never exceeds the top-set load. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{globals:{exercises:[]}});
const {progressionForExercise,suggestionCardMarkup,applyProgressionSuggestion,
  workoutState,progressionSetup,freshProgressionSetup,normalizeProgression}=role;

const profile=()=>({mode:'reps',min:6,max:12});
const seed=(sets,prog)=>{
  const item=mkItem('bench-press',sets,{progression:prog||{mode:'reps',min:6,max:12}});
  workoutState.completed=[mkLog('w1','2026-09-10',[item])];
};
/* QA batch (user 2026-09-22): the "All sets" toggle is retired — per-set
   targets are the only path. `on()` is a no-op kept so the behavior tests
   below read unchanged; the toggle no longer exists. */
const on=()=>{};
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

describe('#400: toggle retired (QA batch 2026-09-22)',()=>{
  it('progressAllSets is gone from fresh defaults',()=>{
    assert.ok(!('progressAllSets' in freshProgressionSetup()));
  });
  it('normalizeProgression deletes the legacy key',()=>{
    const p=normalizeProgression({progressAllSets:1});
    assert.ok(!('progressAllSets' in p));
    assert.ok(!('progressAllSets' in normalizeProgression({})));
  });
  it('per-set targets are the only path — setTargets always present',()=>{
    /* #490 follow-up: the trigger runs on the raw top-set RPE. */
    seed([{w:100,r:8,rpe:8}]);
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s);
    assert.ok(Array.isArray(s.setTargets));
    assert.equal(s.setTargets.length,1);
    assert.equal(s.nextReps,10);
  });
});

describe('#400: cascade when the top set progresses',()=>{
  it('back-off sets take the same rep step from their own baselines',()=>{
    /* Top 100x8 @7 with two back-offs: raw 7 → 10−7 = +3 cascade. */
    seed([{w:100,r:8,rpe:7},{w:90,r:8,rpe:7},{w:80,r:8,rpe:6}]);
    on();
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s);
    assert.equal(s.setTargets.length,3);
    // top: 100x8 @7 (effective 7.3) → +3 reps
    assert.deepEqual([s.setTargets[0].w,s.setTargets[0].r],[100,11]);
    // back-offs cascade the +3 from their own baselines
    assert.deepEqual([s.setTargets[1].w,s.setTargets[1].r],[90,11]);
    assert.deepEqual([s.setTargets[2].w,s.setTargets[2].r],[80,11]);
    assert.ok(s.setTargets.every(t=>t.changed));
  });
  it('a back-off above the RPE trigger sits out (holds)',()=>{
    /* Top at raw RPE 7 still progresses; the RPE-9 back-off sits out. */
    seed([{w:100,r:8,rpe:7},{w:90,r:8,rpe:9}]);
    on();
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s);
    assert.equal(s.setTargets[0].changed,true);
    assert.equal(s.setTargets[1].changed,false);
    assert.equal(s.setTargets[1].kind,'hold');
    assert.deepEqual([s.setTargets[1].w,s.setTargets[1].r],[90,8]);
  });
  it('top-set load step cascades as load+reset-to-min, capped at the top load',()=>{
    // range 6-8, top at ceiling with headroom → load path: 110x6
    // (RPE-scaled load, user 2026-09-19: RPE 7 → 1.5× → 100 + 7.5 → 110).
    // #490: RPE 7 so the top progresses (effective 7.2); two sets at RPE 8 hold.
    seed([{w:100,r:8,rpe:7},{w:90,r:8,rpe:7}],{mode:'reps',min:6,max:8});
    on();
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:8},null);
    assert.ok(s);
    assert.equal(s.kind,'load');
    assert.deepEqual([s.setTargets[0].w,s.setTargets[0].r],[110,6]);
    assert.deepEqual([s.setTargets[1].w,s.setTargets[1].r],[95,6]);
    assert.ok(s.setTargets[1].w<=s.setTargets[0].w);
  });
  it('timed cascade scales the time step by the same jump',()=>{
    /* #490: RPE 7 → effective 7.2 → +3 jump → 15 s steps. */
    const item=mkItem('plank',[{w:0,seconds:45,rpe:7},{w:0,seconds:40,rpe:7}],
      {tracking:'time',progression:{mode:'time',timeMin:30,timeMax:60,timeStep:5}});
    workoutState.completed=[mkLog('w1','2026-09-10',[item])];
    on();
    const s=progressionForExercise('plank',{mode:'time',timeMin:30,timeMax:60,timeStep:5},null);
    assert.ok(s);
    assert.equal(s.setTargets[0].seconds,60); // 45 + 5*3, capped at 60
    assert.equal(s.setTargets[1].seconds,55); // 40 + 5*3
  });
});

describe('#400: independent evaluation when the top set stalls',()=>{
  it('back-off with headroom progresses on its own while the top holds',()=>{
    seed([{w:100,r:8,rpe:9},{w:90,r:8,rpe:7}]);
    on();
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s,'stall with a progressing back-off still yields a suggestion');
    assert.equal(s.setTargets[0].changed,false);
    assert.equal(s.setTargets[0].kind,'hold');
    // own RPE 7 → +3 from own baseline
    assert.deepEqual([s.setTargets[1].w,s.setTargets[1].r],[90,11]);
    assert.equal(s.setTargets[1].changed,true);
  });
  it('missing back-off RPE holds conservatively — the hold notice still shows (QA batch 2026-09-22)',()=>{
    seed([{w:100,r:8,rpe:9},{w:90,r:8,rpe:null}]);
    on();
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s,'the hold notice card survives the all-sets early return');
    assert.equal(s.notice&&s.notice.title,'Held at RPE 9');
    assert.ok(s.setTargets.every(t=>!t.changed),'back-off holds conservatively');
  });
  it('back-off load never exceeds the top-set load',()=>{
    // top stalls at 100x8 (hold); back-off 98x8 @6, range 6-8 → load path
    // would prescribe 105, capped at the top's 100
    seed([{w:100,r:8,rpe:9},{w:98,r:8,rpe:6}],{mode:'reps',min:6,max:8});
    on();
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:8},null);
    assert.ok(s);
    assert.equal(s.setTargets[1].w,100);
    assert.equal(s.setTargets[1].r,6);
  });
  it('a blank slot at a position gets no target — never invented',()=>{
    seed([{w:100,r:8,rpe:8},{w:'',r:'',rpe:null},{w:80,r:8,rpe:8}]);
    on();
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s);
    assert.equal(s.setTargets[1],null);
    assert.deepEqual([s.setTargets[2].w,s.setTargets[2].r],[80,10]);
  });
  it('everything holds with a hold notice → the notice card survives, not null (QA batch 2026-09-22)',()=>{
    /* Top set RPE 9 > threshold 8: the all-sets early return must not
       swallow the "Held at RPE 9" notice — the card explains the hold. */
    seed([{w:100,r:8,rpe:9},{w:90,r:8,rpe:9},{w:80,r:8,rpe:null}]);
    on();
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s,'suggestion survives the all-sets hold');
    assert.equal(s.notice&&s.notice.title,'Held at RPE 9');
    assert.ok(s.setTargets.every(t=>!t.changed),'every set is a hold target');
  });
  it('all-sets hold with no top-set RPE → "No RPE logged" card, not null (QA batch 2026-09-22)',()=>{
    seed([{w:100,r:8,rpe:null},{w:90,r:8,rpe:null}]);
    on();
    const s=progressionForExercise('bench-press',profile(),null);
    assert.ok(s,'suggestion survives the all-sets hold');
    assert.equal(s.notice&&s.notice.title,'No RPE logged');
  });
  it('everything holds with genuinely nothing to say → null (the #79 rule, per-set edition)',()=>{
    /* repsOnly + every set already at the rep ceiling: kind=hold with no
       notice — still no card. */
    seed([{w:100,r:12,rpe:7},{w:90,r:12,rpe:7}],{mode:'reps',min:6,max:12,repsOnly:true});
    on();
    assert.equal(progressionForExercise('bench-press',{mode:'reps',min:6,max:12,repsOnly:true},null),null);
  });
});

describe('#400: card markup',()=>{
  it('stall card leads with Hold and lines for moving sets',()=>{
    seed([{w:100,r:8,rpe:9},{w:90,r:8,rpe:7}]);
    on();
    const s=progressionForExercise('bench-press',profile(),null);
    const html=suggestionCardMarkup(s,0,false);
    assert.ok(html.includes('Sets +'), 'label is Sets +, got: '+html.slice(0,200));
    assert.ok(html.includes('>Hold<'),'top hold line present');
    assert.ok(html.includes('Set 2'),'moving set line present');
    assert.ok(html.includes('suggestion-sets'),'per-set container present');
  });
  it('cascade card shows one line per moving set',()=>{
    /* RPE 7 so the top progresses (raw top-set RPE meets the trigger). */
    seed([{w:100,r:8,rpe:7},{w:90,r:8,rpe:7}]);
    on();
    const s=progressionForExercise('bench-press',profile(),null);
    const html=suggestionCardMarkup(s,0,false);
    assert.ok(html.includes('Add reps'));
    assert.ok(html.includes('Set 1')&&html.includes('Set 2'));
    assert.ok(!html.includes('>Hold<'));
  });
  it('per-set card shows lines in numeric order (#472)',()=>{
    /* RPE 7 so the top-set card exists (raw top-set RPE meets the trigger).
       The toggle is retired — per-set lines are the only card shape now. */
    seed([{w:100,r:8,rpe:7},{w:90,r:8,rpe:7}]);
    const s=progressionForExercise('bench-press',profile(),null);
    const html=suggestionCardMarkup(s,0,false);
    /* #472 (2026-09-15): the top-set card lists every basis set in numeric
       order, so the single-change layout now only survives for 0–1 basis
       sets. */
    assert.ok(html.includes('suggestion-sets'),'per-set container present');
    assert.ok(!html.includes('suggestion-change'));
    const i1=html.indexOf('Set 1'),i2=html.indexOf('Set 2');
    assert.ok(i1>=0&&i2>=0&&i1<i2,'Set 1 before Set 2');
  });
});

describe('#400: apply writes indexed targets',()=>{
  it('applyProgressionSuggestion writes suggestedTargets[] and keeps the singular fallback',()=>{
    /* #490: RPE 7 so the top progresses (effective 7.2 → +3). */
    seed([{w:100,r:8,rpe:7},{w:90,r:8,rpe:7}]);
    on();
    const s=progressionForExercise('bench-press',profile(),null);
    const draft={exercises:[{uid:'u1',exerciseId:'bench-press',tracking:'reps',sets:[{},{ }]}]};
    applyProgressionSuggestion(draft,s,false);
    const item=draft.exercises[0];
    assert.ok(Array.isArray(item.suggestedTargets));
    assert.equal(item.suggestedTargets.length,2);
    assert.deepEqual([item.suggestedTargets[0].w,item.suggestedTargets[0].r],['100','11']);
    assert.deepEqual([item.suggestedTargets[1].w,item.suggestedTargets[1].r],['90','11']);
    assert.ok(item.suggestedTarget,'singular fallback kept');
  });
  it('apply without setTargets clears a stale array',()=>{
    /* A hand-built suggestion with no setTargets (the engine always emits
       setTargets now, but the apply path keeps the defensive branch) must
       still clear a stale per-set array instead of leaving it. */
    const s={exerciseId:'bench-press',mode:'reps',kind:'reps',nextWeight:100,nextReps:10,setTargets:null};
    const draft={exercises:[{uid:'u1',exerciseId:'bench-press',tracking:'reps',sets:[],suggestedTargets:[{w:'1'}]}]};
    applyProgressionSuggestion(draft,s,false);
    assert.equal(draft.exercises[0].suggestedTargets,undefined);
  });
});
