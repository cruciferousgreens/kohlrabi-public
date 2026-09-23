'use strict';
/* Persona sweep v1.862 — progression-math and suggestion-UX regressions.
   Covers #549 (reason states the actual snapped delta), #550 (tie order
   independence), #551 (distance RPE-0 gate), #552 (%1RM + repsOnly),
   #557 (cross-zone informational notice), #558 (unweighted timed ceiling),
   #565 (missing-RPE informational notice), #568 (plain-language labels).
   #551's RPE-0 gate was reverted per the user 2026-09-19 ("RPE 0 is fine to
   advance on") — the describe below pins the revert. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{
  globals:{exercises:[{id:'bench-press',name:'Bench Press'},{id:'plank',name:'Plank'},{id:'run',name:'Run',metrics:['load','distance']}]},
});
const {progressionForExercise,cardSuggestionHtml,workoutState,progressionSetup}=role;

const CFG=()=>({scheme:'rpe',threshold:8,incrementType:'lb',incrementValue:5,timeStep:5});
beforeEach(()=>{
  /* #577: linear is now the app default; these tests exercise RPE mechanics. */
  progressionSetup.scheme='rpe';workoutState.completed=[];workoutState.activeProgram=null;progressionSetup.units='imperial';});

describe('#549: reason strings state the actual snapped delta, not the nominal increment',()=>{
  it('102 lb + 5 lb nominal snaps to 105 and says "add 3 lb"',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('bench-press',[{w:102,r:8,rpe:8}],{progression:{mode:'reps',min:6,max:12}})])];
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12,scheme:'linear'},CFG());
    assert.equal(s.nextWeight,105);
    assert.ok(s.reason.includes('add 3 lb'),'reason names the actual delta: '+s.reason);
    assert.ok(!s.reason.includes('add 5 lb'),'reason does not overstate the nominal increment');
  });
  it('an exact-grid jump still reads the nominal increment',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('bench-press',[{w:100,r:8,rpe:8}],{progression:{mode:'reps',min:6,max:12}})])];
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12,scheme:'linear'},CFG());
    assert.equal(s.nextWeight,105);
    assert.ok(s.reason.includes('add 5 lb'),s.reason);
  });
});

describe('#550: identical sessions suggest identically regardless of set order',()=>{
  const logged=sets=>mkLog('w1','2026-09-12',[mkItem('bench-press',sets,{progression:{mode:'reps',min:6,max:12}})]);
  it('an exact weight/performance tie breaks toward the lower logged RPE',()=>{
    workoutState.completed=[logged([{w:100,r:8,rpe:9},{w:100,r:8,rpe:7}])];
    const a=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},CFG());
    workoutState.completed=[logged([{w:100,r:8,rpe:7},{w:100,r:8,rpe:9}])];
    const b=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},CFG());
    assert.equal(a.kind,b.kind);
    assert.equal(a.nextWeight,b.nextWeight);
    assert.equal(a.nextReps,b.nextReps);
    /* The lower-RPE set (7) is the top set in both orders — it meets the
       trigger, so both orders progress identically. */
    assert.equal(a.kind,'reps');
    assert.ok(a.nextReps>8,'the RPE-7 top set earned a rep jump');
  });
});

describe('#551 (reverted, user 2026-09-19): distance mode advances on RPE 0',()=>{
  it('RPE 0 prescribes a load jump',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('run',[{w:90,distance:5000,rpe:0}],{progression:{mode:'distance',distanceTarget:5000}})])];
    const s=progressionForExercise('run',{mode:'distance',distanceTarget:5000},CFG());
    /* RPE 0 is fine to advance on: +5 lb on the 90 lb top set. */
    assert.ok(s&&s.kind==='load'&&s.nextWeight===95,'RPE 0 advances in distance mode: '+JSON.stringify(s&&{kind:s.kind,nextWeight:s.nextWeight}));
  });
  it('RPE 8 still progresses on a weighted distance exercise',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('run',[{w:50,distance:5000,rpe:8}],{progression:{mode:'distance',distanceTarget:5000}})])];
    const s=progressionForExercise('run',{mode:'distance',distanceTarget:5000},CFG());
    assert.ok(s&&s.kind==='load'&&s.nextWeight>50,'RPE 8 progresses: '+JSON.stringify(s&&{kind:s.kind,nextWeight:s.nextWeight}));
  });
});

describe('#552: %1RM with repsOnly holds the latest instead of prescribing load',()=>{
  it('never prescribes a %1RM load when reps-only is on',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('bench-press',[{w:100,r:8,rpe:8}],{progression:{mode:'reps',min:6,max:12}})])];
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12,scheme:'onerm',percentOf1RM:85,repsOnly:true},CFG());
    /* The hold equals the latest top set, so #79 suppresses the card — the
       regression is a kind='onerm' load prescription. */
    assert.ok(!s||s.kind!=='onerm','no %1RM prescription under reps-only: '+JSON.stringify(s&&s.kind));
  });
  it('without reps-only the %1RM prescription still fires',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('bench-press',[{w:100,r:8,rpe:8}],{progression:{mode:'reps',min:6,max:12}})])];
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12,scheme:'onerm',percentOf1RM:85},CFG());
    assert.ok(s&&s.kind==='onerm','%1RM prescribes normally: '+JSON.stringify(s&&s.kind));
  });
  it('no history means no suggestion at all',()=>{
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12,scheme:'onerm',percentOf1RM:85,repsOnly:true},CFG());
    assert.equal(s,null);
  });
});

describe('#558: unweighted timed exercise at its time ceiling holds steady',()=>{
  it('does not fabricate a load suggestion',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('plank',[{seconds:60,rpe:7}],{progression:{mode:'time',timeMin:30,timeMax:60}})])];
    const s=progressionForExercise('plank',{mode:'time',timeMin:30,timeMax:60},CFG());
    /* Holding the ceiling is a no-change hold, so #79 suppresses the card.
       The regression is a kind='load' prescription with a fabricated weight. */
    assert.ok(!s||s.kind!=='load','no fabricated load: '+JSON.stringify(s&&s.kind));
    if(s)assert.equal(s.nextWeight,0);
  });
  it('a weighted timed exercise at its ceiling still gets the add-load path',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('plank',[{w:25,seconds:60,rpe:7}],{progression:{mode:'time',timeMin:30,timeMax:60}})])];
    const s=progressionForExercise('plank',{mode:'time',timeMin:30,timeMax:60},CFG());
    assert.ok(s&&s.kind==='load'&&s.nextWeight>25,'weighted ceiling prescribes load: '+JSON.stringify(s&&{kind:s.kind,nextWeight:s.nextWeight}));
  });
});

describe('#557: cross-zone focus switch surfaces an informational notice',()=>{
  it('a range change that cannot rebase keeps a non-tappable row',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('bench-press',[{w:100,r:8,rpe:7}],{progression:{mode:'reps',min:1,max:5}})])];
    const s=progressionForExercise('bench-press',{mode:'reps',min:12,max:20,custom:true},CFG());
    assert.ok(s,'suggestion is not suppressed');
    assert.equal(s.kind,'hold');
    assert.ok(s.notice,'notice present');
    assert.equal(s.notice.title,'New rep range');
  });
  it('the notice renders as a muted div, never a button',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('bench-press',[{w:100,r:8,rpe:7}],{progression:{mode:'reps',min:1,max:5}})])];
    const s=progressionForExercise('bench-press',{mode:'reps',min:12,max:20,custom:true},CFG());
    const html=cardSuggestionHtml({uid:'ex-1',exerciseId:'bench-press'},s);
    assert.ok(html.startsWith('<div'),'not a button: '+html.slice(0,60));
    assert.ok(html.includes('suggestion-inline notice'));
    assert.ok(!html.includes('data-card-suggestion='),'no tap hook');
  });
});

describe('#565: missing RPE surfaces an informational notice, not silence',()=>{
  it('no RPE on the top set keeps an explanatory row',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('bench-press',[{w:100,r:8}],{progression:{mode:'reps',min:6,max:12}})])];
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},CFG());
    assert.ok(s,'suggestion is not suppressed');
    assert.equal(s.kind,'hold');
    assert.ok(s.notice,'notice present');
    assert.equal(s.notice.title,'No RPE logged');
    assert.ok(s.notice.body.includes('optional'),'notice says RPE is optional');
  });
});

describe('#568: suggestion rows use plain language',()=>{
  const sug=(kind,over={})=>({exerciseId:'bench-press',kind,mode:'reps',amrap:false,
    latest:{weight:100,reps:8,rpe:8},nextWeight:kind==='load'?105:100,
    nextReps:kind==='reps'?9:8,nextSeconds:0,
    reason:'test',sourceDate:'2026-09-10',setTargets:null,applied:false,...over});
  const item={uid:'ex-1',exerciseId:'bench-press'};
  it('load/reps/time/range chips read as plain verbs',()=>{
    assert.ok(cardSuggestionHtml(item,sug('load')).includes('Add weight'));
    assert.ok(cardSuggestionHtml(item,sug('reps')).includes('Add reps'));
    assert.ok(cardSuggestionHtml(item,sug('time',{mode:'time',nextSeconds:65})).includes('Add time'));
    assert.ok(cardSuggestionHtml(item,sug('range')).includes('New range'));
    for(const k of ['load','reps','time','range']){
      const html=cardSuggestionHtml(item,sug(k,k==='time'?{mode:'time',nextSeconds:65}:{}));
      assert.ok(!html.includes('Load +')&&!html.includes('Rep +')&&!html.includes('Time +')&&!html.includes('Week range'),'no jargon in '+k);
    }
  });
  it('the applied row says "shown faded", not "ghosted"',()=>{
    const html=cardSuggestionHtml(item,sug('reps',{applied:true}));
    assert.ok(html.includes('shown faded'));
    assert.ok(!html.includes('ghosted'));
  });
});
