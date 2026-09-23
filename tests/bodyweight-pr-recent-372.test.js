'use strict';
/* Role: stats-math — pins #372 for the Stats "Recent PRs" list:
   recentPRRows surfaces a Best rep set PR row for bodyweight work.
   Also pins #356's pure week-strip gesture helpers (a drifted tap must not
   be swallowed by pointer capture) and that the strip wires capture through
   them. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole,REPO_ROOT}=require('./harness');

const catalog=[
  {id:'pullup',name:'Pull-Up',equipment:'body only',tracking:'reps',primary:['back'],secondary:[]},
  {id:'squat',name:'Barbell Squat',equipment:'barbell',tracking:'reps',primary:['quads'],secondary:[]},
];

const {recentPRRows,weekStripCaptureAt,weekStripSwipeDirection,workoutState}
  =loadRole('stats-math',{globals:{exercises:catalog}});

const bwLog=(id,date,sets)=>({id,date,isoDate:date,completedAt:`${date}T12:00:00.000Z`,name:'Workout',
  exercises:[{exerciseId:'pullup',tracking:'reps',
    sets:sets.map(s=>({w:s.w??'',r:s.r??'',seconds:'',rpe:'',tags:[],complete:true}))}]});

beforeEach(()=>{workoutState.completed=[];});

describe('recentPRRows — #372 bodyweight PRs in Stats Recent PRs',()=>{
  it('bodyweight best beats prior → Best rep set PR row',()=>{
    const prior=bwLog('w1','2026-09-10',[{w:'',r:'10'}]);
    const cur=bwLog('w2','2026-09-11',[{w:'',r:'12'}]);
    workoutState.completed=[cur,prior];
    const rows=recentPRRows([cur]);
    assert.equal(rows.length,1);
    assert.equal(rows[0].kind,'Best rep set PR');
    assert.equal(rows[0].value,'12 reps');
  });
  it('no improvement → no row',()=>{
    const prior=bwLog('w1','2026-09-10',[{w:'',r:'10'}]);
    const cur=bwLog('w2','2026-09-11',[{w:'',r:'9'}]);
    workoutState.completed=[cur,prior];
    assert.deepEqual(recentPRRows([cur]),[]);
  });
  it('first bodyweight session → no row',()=>{
    const cur=bwLog('w2','2026-09-11',[{w:'',r:'12'}]);
    workoutState.completed=[cur];
    assert.deepEqual(recentPRRows([cur]),[]);
  });
});

describe('week-strip gesture thresholds — #356 drifted taps register',()=>{
  it('capture only engages at a real swipe distance (>45px)',()=>{
    assert.equal(weekStripCaptureAt(12),false);  // the old threshold: a drifted tap
    assert.equal(weekStripCaptureAt(44),false);
    assert.equal(weekStripCaptureAt(46),true);
    assert.equal(weekStripCaptureAt(-50),true);
  });
  it('swipe direction needs the threshold AND a horizontal majority',()=>{
    assert.equal(weekStripSwipeDirection(60,10),1);
    assert.equal(weekStripSwipeDirection(-60,10),-1);
    assert.equal(weekStripSwipeDirection(30,5),0);   // drifted tap: no swipe
    assert.equal(weekStripSwipeDirection(60,70),0);  // vertical scroll: no swipe
  });
  it('the strip wires pointer capture through weekStripCaptureAt (no hardcoded 12px)',()=>{
    const src=fs.readFileSync(path.join(REPO_ROOT,'assets','js','pages','dashboard-stats.js'),'utf8');
    const moveLine=src.split('\n').find(l=>l.includes('onpointermove')&&l.includes('setPointerCapture'));
    assert.ok(moveLine,'pointer-capture wiring exists');
    assert.ok(moveLine.includes('weekStripCaptureAt'),'capture goes through the threshold helper');
    assert.ok(!moveLine.includes('>12')&&!moveLine.includes('> 12'),'no hardcoded 12px capture threshold remains');
  });
});
