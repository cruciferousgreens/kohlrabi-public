'use strict';
/* Role: post-prod batch 1 pins (#330, #333).
   #330 (user 2026-09-13): logs opened from Stats' completed-workouts card
   inherit Home's last-selected date range — the Stats card must set logPeriod
   from statsPeriod the way the dashboard card sets it from dashboardPeriod.
   #333 (user 2026-09-13): the swap-exercise picker ranks similar exercises
   first, reusing the similarity() scorer from exercise-detail.js. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');

const REPO_ROOT=path.join(__dirname,'..');

describe('stats completed-workouts card (#330: logs inherit the Stats period)',()=>{
  const src=fs.readFileSync(path.join(REPO_ROOT,'assets','js','pages','dashboard-stats.js'),'utf8');
  it('sets logPeriod from statsPeriod before opening the logs',()=>{
    const start=src.indexOf("$('#statsCompletedWorkouts').onclick");
    assert.ok(start>0,'stats completed-workouts handler exists');
    const fn=src.slice(start,src.indexOf('};',start)+2);
    assert.ok(fn.includes("state.logPeriod=state.statsPeriod||'week'"),'logPeriod mirrors statsPeriod');
    assert.ok(fn.includes('showWorkoutHistory()'),'then opens the logs');
  });
  it('mirrors the dashboard card, which sets logPeriod from dashboardPeriod',()=>{
    assert.ok(src.includes("state.logPeriod=state.dashboardPeriod||'week'"),'dashboard card is the reference behavior');
  });
});

describe('similarity() scorer (#333: the ranking the swap picker reuses)',()=>{
  const {similarity}=loadRole('exercise-detail-logic');
  const bench={id:'bench',name:'Bench',primary:['chest'],secondary:['triceps','front delts'],equipment:'barbell'};
  it('weights shared primary muscles 3x',()=>{
    const incline={id:'incline',name:'Incline',primary:['chest'],secondary:[],equipment:'dumbbell'};
    assert.equal(similarity(bench,incline),3);
  });
  it('counts same equipment 2x and shared secondary muscles 1x',()=>{
    const dip={id:'dip',name:'Dip',primary:['shoulders'],secondary:['triceps'],equipment:'barbell'};
    /* 1 shared secondary (triceps) + same equipment (barbell) = 1 + 2. */
    assert.equal(similarity(bench,dip),3);
  });
  it('scores zero for unrelated exercises',()=>{
    const curl={id:'curl',name:'Curl',primary:['biceps'],secondary:[],equipment:'dumbbell'};
    assert.equal(similarity(bench,curl),0);
  });
});

describe('swap picker ranking (#333: similar exercises first)',()=>{
  const src=fs.readFileSync(path.join(REPO_ROOT,'assets','js','workout','workout-builder.js'),'utf8');
  it('uses similarity() in swap mode with an empty search',()=>{
    assert.ok(src.includes('if (swapMode && !q && swapFromEx'), 'similarity ranking only with no search text');
    assert.ok(src.includes('similarity(swapFromEx,ex)'),'reuses the exercise-detail scorer');
    assert.ok(src.includes('.slice(0,8)'),'caps the similar section at eight');
  });
  it('puts the SIMILAR section first and shows recents in empty swap mode (user 2026-09-21, #2)',()=>{
    assert.ok(src.includes("sectionBreaks.push([0, '<span>SIMILAR</span>'])"),'SIMILAR section heads the list');
    assert.ok(src.includes('const rows = [...similarRows, ...favRows,'),'similar rows come before favorites');
    assert.ok(src.includes('const favRows = (q||swapMode) ? [] :'),'favorites yield in swap mode');
    /* QA batch (user 2026-09-21, #2): empty unfiltered swap now shows recents
       between Similar and All — the swapMode suppression was removed. */
    assert.ok(!src.includes('||swapMode) ? [] : recentExerciseIds()'),
      'recents are no longer suppressed in swap mode');
  });
  it('excludes the exercise being replaced from its own similar list',()=>{
    assert.ok(src.includes('.filter(ex=>ex.id!==swapFromId)'),'the current exercise never ranks against itself');
  });
});
