'use strict';
/* Overnight batch 2026-09-15 (user: "synchronize glossary and code, fix major
   bugs and most submitted recently before morning"):
   - #478: per-week Deload flags go inert when the %1RM wave toggle is off
   - #479: similar-exercise scoring counts force (push/pull) and category
   - #480: (removed) program setup mirrored the #420 wave-vs-Auto-Deload rule —
     deleted with Auto Deload in the QA batch of 2026-09-22
   - #481: a stale suggestion card can never revert a Reps<->Seconds switch
   - #484: CSV template uses the canonical "Failure" tag (+ "To failure" alias) */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const ROOT=path.resolve(__dirname,'..');
const role=loadRole('progression-logic',{globals:{exercises:[]}});
const {progressionForExercise,isDeloadWeek,similarity,applyProgressionSuggestion,workoutState,progressionSetup}=role;

beforeEach(()=>{
  progressionSetup.threshold=8;
  progressionSetup.progressionOff=false;
  progressionSetup.incrementType='lb';
  progressionSetup.incrementValue=5;
  progressionSetup.timeStep=5;
  progressionSetup.progressAllSets=false;
  workoutState.completed=[];
  workoutState.activeProgram=null;
});

describe('#478: per-week Deload flags go inert with the wave off',()=>{
  it('a flagged week is not a deload week when pctWave is off',()=>{
    const cfg={pctWave:false,weeklyDeloads:[false,false,false,true]};
    assert.equal(isDeloadWeek(cfg,4),false,'hidden flag cannot deload');
  });
  it('the same flag counts when the wave is on',()=>{
    const cfg={pctWave:true,weeklyDeloads:[false,false,false,true]};
    assert.equal(isDeloadWeek(cfg,4),true);
    assert.equal(isDeloadWeek(cfg,3),false,'unflagged week stays normal');
  });
});

describe('#479: similar-exercise scoring counts force and category',()=>{
  const bench={primary:['chest'],secondary:['shoulders','triceps'],equipment:'barbell',force:'push',category:'strength'};
  const press={primary:['chest'],secondary:['shoulders','triceps'],equipment:'barbell',force:'push',category:'strength'};
  const row={primary:['chest'],secondary:['shoulders','triceps'],equipment:'barbell',force:'pull',category:'strength'};
  it('a push variant outranks a pull variant when muscles tie',()=>{
    assert.ok(similarity(bench,press)>similarity(bench,row),'press beats row: '+similarity(bench,press)+' vs '+similarity(bench,row));
    assert.equal(similarity(bench,press)-similarity(bench,row),2,'force match is worth 2');
  });
  it('category adds a point when it matches',()=>{
    const otherCat={...press,category:'powerlifting'};
    assert.equal(similarity(bench,press)-similarity(bench,otherCat),1,'category match is worth 1');
  });
  it('two equipment-less exercises still match on equipment',()=>{
    const bw1={primary:['chest'],secondary:[],equipment:'',force:'push',category:'strength'};
    const bw2={primary:['chest'],secondary:[],force:'push',category:'strength'};
    const geared={primary:['chest'],secondary:[],equipment:'barbell',force:'push',category:'strength'};
    assert.ok(similarity(bw1,bw2)>similarity(bw1,geared),'equipment-less pair keeps the bonus');
  });
  it('missing force/category never throws and never matches',()=>{
    const bare={primary:['chest'],secondary:[],equipment:'barbell'};
    assert.doesNotThrow(()=>similarity(bare,bench));
    assert.equal(similarity(bare,bare),3+2,'3 primary + 2 equipment, no phantom force/category points');
  });
});

/* QA batch (user 2026-09-22): Auto Deload removed — the #480 wave-vs-
   Auto-Deload tests were deleted with it. */

describe('#481: a stale suggestion card never reverts a Reps<->Seconds switch',()=>{
  const mkDraft=()=>({
    exercises:[{exerciseId:'plank',uid:'u1',tracking:'time',
      progression:{mode:'time',timeMin:30,timeMax:90},sets:[],suggestedTarget:null}],
    progressionSuggestions:[],
  });
  it('tapping a reps-mode card after switching to Seconds leaves tracking alone',()=>{
    const draft=mkDraft();
    const stale={exerciseId:'plank',mode:'reps',nextWeight:0,nextReps:10,nextSeconds:0};
    applyProgressionSuggestion(draft,stale,false);
    const item=draft.exercises[0];
    assert.equal(item.tracking,'time','tracking switch is not reverted');
    assert.equal(item.suggestedTarget,null,'no stale target is written');
    assert.equal(stale.applied,undefined,'stale card is not marked applied');
  });
  it('a current-mode card still applies normally',()=>{
    const draft=mkDraft();
    const fresh={exerciseId:'plank',mode:'time',nextWeight:0,nextReps:0,nextSeconds:70};
    applyProgressionSuggestion(draft,fresh,false);
    const item=draft.exercises[0];
    assert.equal(item.tracking,'time');
    assert.equal(item.suggestedTarget.seconds,'70','fresh seconds target applied');
    assert.equal(fresh.applied,true);
  });
});

describe('#484: CSV template uses the canonical Failure tag',()=>{
  const csvRole=loadRole('csv-import');
  it('"To failure" resolves to the canonical "Failure" tag',()=>{
    assert.equal(csvRole.obCanonicalCsvTag('To failure'),'Failure','pre-#383 alias accepted');
    assert.equal(csvRole.obCanonicalCsvTag('Failure'),'Failure');
    assert.equal(csvRole.obCanonicalCsvTag('failure'),'Failure','case-insensitive');
  });
  it('the shipped template no longer uses the renamed tag',()=>{
    const tpl=fs.readFileSync(path.join(ROOT,'assets/workout-history-template.csv'),'utf8');
    assert.ok(!/To failure/.test(tpl),'template carries the canonical tag');
    assert.ok(/,Failure,/.test(tpl),'example row uses Failure');
  });
});
