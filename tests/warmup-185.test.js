'use strict';
/* #185 (user 2026-09-13): manual warm-up ladder beta.
   Pins: Warmup tag identity, ladder default shape + migration, rung math
   (40/60 defaults, 5 lb grid / 5 s rounding), anchor precedence
   (in-exercise heaviest → suggestion target → blank; #399: never a PR),
   and the progression-trigger exclusion (warm-up sets never trigger). */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const {
  isWarmupSet, WARMUP_TAG,
  topSetForSession,
  warmupLadderRows, warmupAnchorLb,
  normalizeProgression, DEFAULT_PROGRESSION_SETUP,
  progressionSetup, workoutState,
}=loadRole('progression-logic');

const freshSetup=()=>JSON.parse(JSON.stringify(DEFAULT_PROGRESSION_SETUP));

beforeEach(()=>{
  workoutState.completed=[];
  workoutState.activeProgram=null;
  Object.keys(progressionSetup).forEach(k=>delete progressionSetup[k]);
  Object.assign(progressionSetup,freshSetup());
  progressionSetup.units='imperial';
});

describe('isWarmupSet',()=>{
  it('matches the Warmup tag only',()=>{
    assert.equal(WARMUP_TAG,'Warmup');
    assert.equal(isWarmupSet({tags:['Warmup']}),true);
    assert.equal(isWarmupSet({tags:['Paused','Warmup']}),true);
    assert.equal(isWarmupSet({tags:['Paused']}),false);
    assert.equal(isWarmupSet({tags:[]}),false);
    assert.equal(isWarmupSet(null),false);
    assert.equal(isWarmupSet({}),false);
  });
});

describe('normalizeProgression warm-up migration',()=>{
  it('stamps defaults on a pre-#185 blob',()=>{
    const p=normalizeProgression({threshold:8});
    assert.equal(p.warmupRungs,2);
    assert.deepEqual(p.warmupLadder,[{pct:40,reps:5},{pct:60,reps:3},{pct:80,reps:2}]);
  });
  it('sanitizes garbage without dropping valid rungs',()=>{
    const p=normalizeProgression({warmupRungs:9,warmupLadder:[{pct:0,reps:-3},{pct:'abc'}]});
    assert.equal(p.warmupRungs,3);
    assert.deepEqual(p.warmupLadder[0],{pct:40,reps:1}); /* 0 → default pct; -3 clamps to min 1 rep */
    assert.deepEqual(p.warmupLadder[1],{pct:60,reps:3});
    assert.deepEqual(p.warmupLadder[2],{pct:80,reps:2});
  });
  it('keeps a valid custom ladder intact',()=>{
    const p=normalizeProgression({warmupRungs:1,warmupLadder:[{pct:50,reps:8},{pct:70,reps:5},{pct:90,reps:3}]});
    assert.equal(p.warmupRungs,1);
    assert.deepEqual(p.warmupLadder[0],{pct:50,reps:8});
  });
});

describe('warmupLadderRows',()=>{
  it('defaults: 40%x5 and 60%x3 off a 140 anchor, snapped to the 5 lb grid',()=>{
    const rows=warmupLadderRows(140,'reps');
    assert.equal(rows.length,2);
    assert.equal(rows[0].w,'55');   /* 56 → 55 */
    assert.equal(rows[0].reps,'5');
    assert.equal(rows[1].w,'85');   /* 84 → 85 */
    assert.equal(rows[1].reps,'3');
  });
  it('snaps to the 5 lb grid, not plates (143x40% = 57.2 → 55; 143x60% = 85.8 → 85)',()=>{
    const rows=warmupLadderRows(143,'reps');
    assert.equal(rows[0].w,'55');
    assert.equal(rows[1].w,'85');
  });
  it('metric snaps to the 2.5 kg grid (#473: the kg-equivalent of the 5 lb grid)',()=>{
    progressionSetup.units='metric';
    const rows=warmupLadderRows(140,'reps');
    // 56 lb → 25 kg, 84 lb → 37.5 kg (canonical lb carries float dust; the
    // display layer rounds to 1 decimal kg).
    const kg=w=>Number(w)*0.45359237;
    assert.ok(Math.abs(kg(rows[0].w)-25)<1e-9,`25 kg, got ${rows[0].w}`);
    assert.ok(Math.abs(kg(rows[1].w)-37.5)<1e-9,`37.5 kg, got ${rows[1].w}`);
  });
  it('no anchor → blank editable weight, reps still ladder',()=>{
    const rows=warmupLadderRows(0,'reps');
    assert.equal(rows[0].w,'');
    assert.equal(rows[0].reps,'5');
    assert.equal(rows[1].w,'');
  });
  it('rung count follows the stepper (1 and 3)',()=>{
    progressionSetup.warmupRungs=1;
    assert.equal(warmupLadderRows(140,'reps').length,1);
    progressionSetup.warmupRungs=3;
    const rows=warmupLadderRows(140,'reps');
    assert.equal(rows.length,3);
    assert.equal(rows[2].w,'110'); /* 112 → 110 on the 5 lb grid */
    assert.equal(rows[2].reps,'2');
  });
  it("timed exercises ladder seconds snapped to 5 s (user's 5sec rule)",()=>{
    progressionSetup.warmupLadder=[{pct:40,reps:12},{pct:60,reps:17}];
    const rows=warmupLadderRows(0,'time');
    assert.equal(rows[0].seconds,'10');
    assert.equal(rows[1].seconds,'15');
    assert.equal(rows[0].reps,null);
  });
});

describe('warmupAnchorLb',()=>{
  const EX='bench-press';
  it('heaviest entered weight in the exercise wins',()=>{
    const item={exerciseId:EX,sets:[{w:'135',r:'8',tags:[]},{w:'200',r:'3',tags:['Warmup']},{w:'',r:'',tags:[]}]};
    assert.equal(warmupAnchorLb(item),135);
  });
  it('warm-up rows never count as the anchor',()=>{
    const item={exerciseId:EX,sets:[{w:'200',r:'3',tags:['Warmup']}]};
    assert.equal(warmupAnchorLb(item),0);
  });
  it('falls back to the suggestion target',()=>{
    const item={exerciseId:EX,suggestedTarget:{w:150},sets:[{w:'',r:'',tags:[]}]};
    assert.equal(warmupAnchorLb(item),150);
  });
  it("#399: never falls back to last session's top set — a PR is a ceiling, not the day's load",()=>{
    workoutState.completed=[
      mkLog('w1','2026-09-10',[mkItem(EX,[{w:120,r:8},{w:130,r:5},{w:95,r:5,tags:['Warmup']}])]),
    ];
    const item={exerciseId:EX,sets:[{w:'',r:'',tags:[]}]};
    assert.equal(warmupAnchorLb(item),0);
  });
  it('ignores warm-up-only history → blank rows',()=>{
    workoutState.completed=[
      mkLog('w1','2026-09-10',[mkItem(EX,[{w:95,r:5,tags:['Warmup']}])]),
    ];
    const item={exerciseId:EX,sets:[{w:'',r:'',tags:[]}]};
    assert.equal(warmupAnchorLb(item),0);
  });
  it('no history at all → 0',()=>{
    assert.equal(warmupAnchorLb({exerciseId:EX,sets:[]}),0);
  });
});

describe('topSetForSession warm-up exclusion (#185)',()=>{
  it('a heavier warm-up set never wins the top-set race',()=>{
    const top=topSetForSession({tracking:'reps',sets:[
      {w:200,r:3,tags:['Warmup']},
      {w:135,r:8,tags:[]},
    ]});
    assert.equal(top.weight,135);
    assert.equal(top.reps,8);
  });
  it('warm-up-only session → null (no suggestion trigger)',()=>{
    assert.equal(topSetForSession({tracking:'reps',sets:[{w:95,r:5,tags:['Warmup']}]}),null);
  });
  it('technique tags stay label-only: all non-warmup sets compete equally',()=>{
    const top=topSetForSession({tracking:'reps',sets:[
      {w:140,r:5,tags:['Paused']},
      {w:140,r:8,tags:['To failure']},
    ]});
    assert.equal(top.reps,8);
  });
  it('time mode: warm-up seconds excluded too',()=>{
    const top=topSetForSession({tracking:'time',sets:[
      {w:'',seconds:60,tags:['Warmup']},
      {w:'',seconds:40,tags:[]},
    ]});
    assert.equal(top.seconds,40);
  });
});
