'use strict';
/* #106 (agent 2026-09-14): set-row controls were duplicated in the
   accessibility tree — every row's swipe-delete rail sits behind the row
   content (invisible) but was still announced, so each "Delete set N"
   appeared twice. The rail now starts aria-hidden and joins the a11y tree
   only while its row is swiped open (setSwipeOpen toggles it with the open
   state); the inline × covers the closed state. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');

const ROOT=path.resolve(__dirname,'..');
const {liveSetRowHtml,newSet}=loadRole('workout-screen-logic',{globals:{exercises:[
  {id:'squat',name:'Barbell Squat',equipment:'barbell'},
],getExerciseLogs:()=>[]}});

const item={uid:'ex1',exerciseId:'squat',sets:[],progression:null,suggestedTarget:null};

describe('#106 set-row delete is announced once',()=>{
  it('the rail starts hidden from assistive tech (rows render closed)',()=>{
    const html=liveSetRowHtml(item,newSet(),0);
    const rail=html.match(/<button[^>]*delete-set-swipe[^>]*>/)[0];
    assert.ok(/aria-hidden="true"/.test(rail),'rail carries aria-hidden="true"');
  });
  it('the inline × stays exposed — exactly one Delete control per closed row',()=>{
    const html=liveSetRowHtml(item,newSet(),0);
    const withoutRail=html.replace(/<button[^>]*delete-set-swipe[^>]*>[\s\S]*?<\/button>/,'');
    const labels=(withoutRail.match(/aria-label="Delete set 1"/g)||[]).length;
    assert.equal(labels,1,'one exposed delete control when the rail is closed');
    assert.ok(!/aria-hidden="true"[^>]*delete-set-inline/.test(html),'inline × is not hidden');
  });
  it('one set-number button per row',()=>{
    const html=liveSetRowHtml(item,newSet(),0);
    assert.equal((html.match(/log-set-number/g)||[]).length,1,'no duplicated number control');
  });
  it('setSwipeOpen toggles the rail in the a11y tree with the open state',()=>{
    const src=fs.readFileSync(path.join(ROOT,'assets','js','workout','workout-editor.js'),'utf8');
    const start=src.indexOf('function setSwipeOpen(');
    assert.ok(start>0,'setSwipeOpen exists');
    const fn=src.slice(start,src.indexOf('\n    }\n',start));
    assert.ok(fn.includes("setAttribute('aria-hidden'"),'toggles aria-hidden on the rail');
    assert.ok(/open \? 'false' : 'true'/.test(fn),'rail is exposed only while the row is open');
  });
  it('every swipe-delete rail renders hidden (workout editor, builder, card rows)',()=>{
    for(const f of ['assets/js/workout/workout-editor.js','assets/js/pages/saved-workouts.js','assets/js/pages/programs.js']){
      const src=fs.readFileSync(path.join(ROOT,f),'utf8');
      const rails=[...src.matchAll(/<button[^>]*swipe-delete-action[^>]*>/g)];
      assert.ok(rails.length>0,f+' renders rails');
      for(const r of rails){
        assert.ok(/aria-hidden="true"/.test(r[0]),f+': closed rail hidden -> '+r[0].slice(0,70));
      }
    }
  });
});
