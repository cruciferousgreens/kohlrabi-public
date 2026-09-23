'use strict';
/* #497 (agent): RPE 0 is valid to log. Pins the set-completion RPE gate
   (validLoggedRpe) and the RPE field's min attribute in the set row. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {validLoggedRpe,liveSetRowHtml,newSet}=loadRole('workout-screen-logic',{globals:{exercises:[
  {id:'squat',name:'Barbell Squat',equipment:'barbell'},
],getExerciseLogs:()=>[]}});

describe('#497: RPE 0 is accepted by validation',()=>{
  it('validLoggedRpe accepts 0 and the full 0–10 scale',()=>{
    assert.equal(validLoggedRpe(0),true,'numeric 0');
    assert.equal(validLoggedRpe('0'),true,'string "0" from the input');
    assert.equal(validLoggedRpe(7.5),true,'half steps');
    assert.equal(validLoggedRpe(10),true,'top of the scale');
    assert.equal(validLoggedRpe(''),true,'blank stays "no RPE"');
  });
  it('validLoggedRpe still rejects out-of-scale and non-numeric RPE',()=>{
    assert.equal(validLoggedRpe(-0.5),false,'negative RPE');
    assert.equal(validLoggedRpe(10.5),false,'above 10');
    assert.equal(validLoggedRpe('garbage'),false,'non-numeric');
  });
  it('the RPE input allows 0',()=>{
    const item={uid:'ex1',exerciseId:'squat',sets:[],progression:null,suggestedTarget:null};
    const html=liveSetRowHtml(item,newSet(),0);
    assert.ok(/class="log-input rpe-input"[^>]*min="0"/.test(html),'RPE input carries min="0"');
    assert.ok(!/class="log-input rpe-input"[^>]*min="1"/.test(html),'no lingering min="1" on the RPE input');
  });
});
