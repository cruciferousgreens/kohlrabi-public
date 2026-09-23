'use strict';
/* Role: exercise-detail-logic — pins the #204 expanded-history layout
   contract (user 2026-09-14): the session head row carries ONLY the date +
   "View workout" (no wrapping estimate text); the best-estimate /
   longest-hold headline lives in its own sub-line; set rows carry no stray
   right-hand dash when a set has no RPE/tags; per-set detail and the
   data-history-workout hook keep working. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {historySessionHtml,historySetRowHtml}=loadRole('exercise-detail-logic');

const repSession=(over={})=>({
  workoutId:'w1',date:'Sep 12, 2026',isoDate:'2026-09-12',dayOrdinal:1,
  tracking:'reps',exerciseTags:[],
  sets:[{w:100,r:8,rpe:8,tags:[]},{w:100,r:6,rpe:null,tags:[]}],
  ...over,
});
const headOf=html=>{
  const start=html.indexOf('<div class="session-head">');
  assert.ok(start>=0,'session-head must exist');
  return html.slice(start,html.indexOf('</div>',start));
};

describe('#204 expanded per-workout history layout',()=>{
  it('head row carries only the date + View workout',()=>{
    const html=historySessionHtml(repSession(),'squat',false);
    const head=headOf(html);
    assert.ok(head.includes('Sep 12, 2026'),'date in head');
    assert.ok(head.includes('data-history-workout="w1"'),'workout hook in head');
    assert.ok(head.includes('>View workout</button>'),'View workout label in head');
    assert.ok(!head.includes('Best estimate'),'estimate must not wrap inside the head row');
  });
  it('best-estimate headline lives in its own sub-line',()=>{
    const html=historySessionHtml(repSession(),'squat',false);
    assert.ok(html.includes('<div class="session-sub">Best estimate'),'sub-line carries the headline');
  });
  it('timed session sub-line shows the longest hold, never a 0-lb estimate',()=>{
    const html=historySessionHtml({
      workoutId:'w2',date:'Sep 11, 2026',isoDate:'2026-09-11',dayOrdinal:1,
      tracking:'time',exerciseTags:[],
      sets:[{w:null,r:null,seconds:60,rpe:null,tags:[]}],
    },'plank',false);
    assert.ok(html.includes('<div class="session-sub">Longest hold 60 sec</div>'));
    assert.ok(html.includes('<strong>60</strong> sec'),'per-set timed detail intact');
  });
  it('no sub-line when there is nothing meaningful to headline',()=>{
    const html=historySessionHtml(repSession({
      sets:[{w:null,r:12,rpe:null,tags:[]}],
    }),'pushup',false);
    assert.ok(!html.includes('session-sub'),'unweighted rep session hides the estimate');
    assert.ok(html.includes('<strong>12</strong> reps'),'rep detail intact');
  });
  it('no stray right-hand dash when a set has no RPE/tags',()=>{
    const html=historySessionHtml(repSession(),'squat',false);
    assert.ok(!html.includes('>—</span>'),'no stray dash in set meta');
    assert.ok(html.includes('<span class="set-meta"></span>'),'empty meta renders empty');
    assert.ok(html.includes('RPE <strong>8</strong>'),'RPE still renders when present');
  });
  it('set tags render as chips in the meta cell',()=>{
    const html=historySetRowHtml({w:100,r:5,rpe:null,tags:['to failure']},0,{tracking:'reps'},'squat',false);
    assert.ok(html.includes('<span class="set-tag">to failure</span>'));
    assert.ok(html.includes('<strong>100</strong>'),'weight detail intact');
  });
  it('exercise tags render in their own row below the head',()=>{
    const html=historySessionHtml(repSession({exerciseTags:['chest day']}),'squat',false);
    assert.ok(html.includes('exercise-tag-row'),'tag row present');
    assert.ok(html.includes('chest day'),'tag text present');
  });
});
