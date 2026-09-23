'use strict';
/* #237 (user 2026-09-12): the progression ghost must never land on
   warmup-tagged sets — completing a warmup set untouched would otherwise
   log the working weight instead of a warmup weight. Renders the real
   liveSetRowHtml: working rows ghost the suggestion target, warmup rows
   keep their own ladder hint (or nothing when manually tagged), and the
   perf placeholder follows the same split. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {liveSetRowHtml,newSet}=loadRole('workout-screen-logic',{globals:{exercises:[
  {id:'bench-press',name:'Bench Press',equipment:'barbell'},
],getExerciseLogs:()=>[]}});

/* "90 lb x 8 -> 95 lb x 8" tapped: the suggestion writes only to
   suggestedTarget (ghosted placeholders). */
const itemWithTarget=()=>({uid:'ex1',exerciseId:'bench-press',sets:[],
  progression:null,suggestedTarget:{w:'95',r:'8',seconds:''}});

const placeholderWeight=html=>{
  const m=html.match(/data-placeholder-weight="([^"]*)"/);
  assert.ok(m,'row carries data-placeholder-weight');
  return m[1];
};

describe('#237 progression ghost skips warmup-tagged sets',()=>{
  it('working sets ghost the suggestion target',()=>{
    const set=newSet();
    const html=liveSetRowHtml(itemWithTarget(),set,0);
    assert.equal(placeholderWeight(html),'95');
  });
  it('warmup rows keep their ladder hint, not the working-weight ghost',()=>{
    const set=newSet();
    set.tags=['Warmup'];
    set.warmupHint={w:'65',perf:'8'};
    const html=liveSetRowHtml(itemWithTarget(),set,0);
    assert.equal(placeholderWeight(html),'65');
    assert.ok(!html.includes('data-placeholder-weight="95"'),
      'no 95 lb ghost anywhere on the warmup row');
  });
  it('manually warmup-tagged rows (no ladder hint) get no ghost at all',()=>{
    const set=newSet();
    set.tags=['Warmup'];
    const html=liveSetRowHtml(itemWithTarget(),set,0);
    assert.equal(placeholderWeight(html),'');
  });
  it('warmup perf placeholder is the ladder perf, not the suggestion reps',()=>{
    const item=itemWithTarget();
    item.suggestedTarget={w:'95',r:'10',seconds:''}; /* suggestion prescribes 10 reps */
    const warm=newSet(); warm.tags=['Warmup']; warm.warmupHint={w:'65',perf:'8'};
    const work=newSet();
    const warmHtml=liveSetRowHtml(item,warm,0);
    const workHtml=liveSetRowHtml(item,work,1);
    const perf=html=>html.match(/data-placeholder-perf="([^"]*)"/)[1];
    assert.equal(perf(warmHtml),'8','ladder perf, not the suggestion reps');
    assert.equal(perf(workHtml),'10','working row ghosts the suggestion reps');
    assert.equal(placeholderWeight(warmHtml),'65');
    assert.equal(placeholderWeight(workHtml),'95');
  });
});
