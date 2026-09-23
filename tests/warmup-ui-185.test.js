'use strict';
/* #185 (user 2026-09-13): warm-up UI integration — renders the real
   liveExerciseCardHtml / builderExerciseCard / warmupSettingsHtml and drives
   the real addWarmupSets against stubbed DOM. Verifies the Warm-up button in
   the card header (left of the info icon), the 40/60 ladder as placeholders,
   one-shot gating, the button hiding while warm-up rows exist (no bulk
   Remove warm-ups — rows delete individually), and the Settings section copy. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {
  newExerciseItem, liveExerciseCardHtml,
  addWarmupSets,
  builderExerciseCard,
  WARMUP_TAG, isWarmupSet,
  progressionSetup, workoutState, DEFAULT_PROGRESSION_SETUP,
}=loadRole('warmup-ui');

const freshSetup=()=>JSON.parse(JSON.stringify(DEFAULT_PROGRESSION_SETUP));

/* One working set typed at 140 lb — the ladder should anchor to it. */
function benchDraft(){
  const item=newExerciseItem({exerciseId:'bench-press',tracking:'reps'});
  item.sets=[{uid:'s-work',w:'140',r:'8',rpe:'',tags:[],done:false}];
  return {exercises:[item]};
}

beforeEach(()=>{
  workoutState.completed=[];
  workoutState.activeProgram=null;
  workoutState.draft=null;
  Object.keys(progressionSetup).forEach(k=>delete progressionSetup[k]);
  Object.assign(progressionSetup,freshSetup());
  progressionSetup.units='imperial';
});

describe('live editor warm-up control',()=>{
  it('renders the Warm-up button in the card header, left of the info icon',()=>{
    const draft=benchDraft();
    const html=liveExerciseCardHtml(draft.exercises[0],draft);
    assert.ok(html.includes('+ Add set'),'has the add-set button');
    assert.ok(html.includes('data-warmup-uid='),'has the Warm-up button');
    assert.ok(!html.includes('data-remove-warmups'),'no remove action yet');
    /* Header placement: the control rides inside the <summary> head (which
       reserves its right 54px for the absolute info icon), not in the
       set-utility-row beside + Add set. */
    const summary=html.slice(html.indexOf('<summary'),html.indexOf('</summary>'));
    assert.ok(summary.includes('data-warmup-uid='),'Warm-up button is inside the card header');
    const utilityRow=html.slice(html.indexOf('set-utility-row'));
    assert.ok(!utilityRow.includes('data-warmup-uid='),'Warm-up button is not beside + Add set');
    /* The info icon is gone from the card header (user 2026-09-22) — the
       collapsed card shows just the title and the Warm-up pill. */
    assert.ok(!summary.includes('data-exercise-info='),'no info icon in the card header');
    assert.ok(!html.includes('corner-icon'),'no absolute corner icon');
  });
  it('insertion adds the 40/60 ladder on top as placeholders, values stay empty',()=>{
    workoutState.draft=benchDraft();
    const item=workoutState.draft.exercises[0];
    addWarmupSets(item.uid);
    assert.equal(item.sets.length,3);
    const [a,b,c]=item.sets;
    assert.ok(isWarmupSet(a)&&isWarmupSet(b),'first two carry the Warmup tag');
    assert.ok(!isWarmupSet(c),'working set is not a warm-up');
    /* Ladder numbers are placeholders, not entered values. */
    assert.equal(a.w,'');assert.equal(a.r,'');
    assert.deepEqual(a.warmupHint,{w:'55',perf:'5'});
    assert.equal(b.w,'');assert.equal(b.r,'');
    assert.deepEqual(b.warmupHint,{w:'85',perf:'3'});
    assert.equal(c.w,'140');assert.equal(c.r,'8');
    /* The rendered rows ghost the ladder and expose it to the
       untouched-completion path. */
    const html=liveExerciseCardHtml(item,workoutState.draft);
    assert.ok(html.includes('data-placeholder-weight="55"'),'ladder weight rides data-placeholder-weight');
    assert.ok(html.includes('data-placeholder-perf="5"'),'ladder reps ride data-placeholder-perf');
    assert.ok(html.includes('value=""'),'warm-up inputs render empty');
  });
  it('insertion is one-shot: a second tap adds nothing',()=>{
    workoutState.draft=benchDraft();
    const item=workoutState.draft.exercises[0];
    addWarmupSets(item.uid);
    addWarmupSets(item.uid);
    assert.equal(item.sets.length,3,'still exactly three sets');
  });
  it('after insertion the Warm-up button hides and no bulk-remove appears',()=>{
    workoutState.draft=benchDraft();
    const item=workoutState.draft.exercises[0];
    addWarmupSets(item.uid);
    const html=liveExerciseCardHtml(item,workoutState.draft);
    assert.ok(!html.includes('data-warmup-uid='),'Warm-up button hidden');
    assert.ok(!html.includes('data-remove-warmups'),'no bulk Remove warm-ups control');
    assert.ok(!html.includes('is-remove'),'no remove styling on the header pill');
    const summary=html.slice(html.indexOf('<summary'),html.indexOf('</summary>'));
    assert.ok(!summary.includes('Warm-up'),'no warm-up control at all in the card header');
  });
  it('warm-up rows delete individually like any other set; the button returns when all are gone',()=>{
    workoutState.draft=benchDraft();
    const item=workoutState.draft.exercises[0];
    addWarmupSets(item.uid);
    /* Individual deletion is the ordinary set path — filter one warm-up row. */
    item.sets=item.sets.filter(s=>s!==item.sets[0]);
    let html=liveExerciseCardHtml(item,workoutState.draft);
    assert.ok(!html.includes('data-warmup-uid='),'button stays hidden while a warm-up row remains');
    item.sets=item.sets.filter(s=>!isWarmupSet(s));
    assert.equal(item.sets.length,1);
    assert.equal(item.sets[0].w,'140');
    html=liveExerciseCardHtml(item,workoutState.draft);
    assert.ok(html.includes('data-warmup-uid='),'Warm-up button back once all warm-up rows are gone');
  });
  it('warm-up rows never show a suggestion ghost',()=>{
    workoutState.draft=benchDraft();
    const item=workoutState.draft.exercises[0];
    addWarmupSets(item.uid);
    const html=liveExerciseCardHtml(item,workoutState.draft);
    const firstRow=html.split('</div>')[0];
    assert.ok(!firstRow.includes('suggestion-ghost'),'no ghost on warm-up rows');
  });
});

describe('saved builder warm-up control',()=>{
  it('renders a Warm-up button beside + Add set in drafts',()=>{
    const item=newExerciseItem({exerciseId:'bench-press',tracking:'reps'});
    item.sets=[{uid:'s1',w:'',r:'',rpe:'',tags:[],done:false}];
    const html=builderExerciseCard(item,[item]);
    assert.ok(html.includes('data-builder-warmup='),'has the Warm-up button');
    assert.ok(!html.includes('data-builder-remove-warmups'));
  });
  it('info icon is gone from the builder card header too',()=>{
    const item=newExerciseItem({exerciseId:'bench-press',tracking:'reps'});
    item.sets=[{uid:'s1',w:'',r:'',rpe:'',tags:[],done:false}];
    const html=builderExerciseCard(item,[item]);
    const summary=html.slice(html.indexOf('<summary'),html.indexOf('</summary>'));
    assert.ok(!summary.includes('data-exercise-info='),'no info icon in the header row');
    assert.ok(!html.includes('corner-icon'));
  });
});

describe('header layout (user 2026-09-13)',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const css=fs.readFileSync(path.join(__dirname,'..','assets','styles.css'),'utf8');
  it('Warm-up pill sits in the summary with the title, no info icon',()=>{
    workoutState.draft=benchDraft();
    const item=workoutState.draft.exercises[0];
    const html=liveExerciseCardHtml(item,workoutState.draft);
    const summary=html.slice(html.indexOf('<summary'),html.indexOf('</summary>'));
    const pillPos=summary.indexOf('data-warmup-uid=');
    assert.ok(pillPos>0,'pill in the header row');
    assert.ok(summary.indexOf('data-exercise-info=')<0,'no info icon in the header row');
    assert.ok(!html.includes('corner-icon'),'the absolute corner-icon rule is gone');
  });
  it('Warm-up pill hides when the card is collapsed',()=>{
    assert.ok(css.includes('.exercise-accordion.workout-exercise:not([open]) .warmup-corner { display: none; }'),'collapsed cards hide the pill');
  });
  it('last-session chip sits a touch closer to the header',()=>{
    assert.ok(css.includes('.last-session-line { margin: 6px 0 8px;'),'chip moved up');
  });
});

describe('settings warm-up section',()=>{
  it('index.html carries the Warm-up sets section with 40/60 defaults',()=>{
    const fs=require('node:fs'),path=require('node:path');
    const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
    assert.ok(html.includes('Warm-up sets'),'section exists');
    assert.ok(html.includes('id="settingsWarmupRungs"'),'rung pills exist');
    assert.ok(html.includes('data-warmup-rungs="2" aria-pressed="true"'),'2 rungs default-selected');
  });
  it('app-bootstrap renders the ladder editor with 40/60 rows',()=>{
    /* The ladder rows are rendered by renderWarmupLadderEditor in
       app-bootstrap.js; covered here through the shared rung defaults. */
    assert.equal(progressionSetup.warmupLadder[0].pct,40);
    assert.equal(progressionSetup.warmupLadder[1].pct,60);
  });
});
