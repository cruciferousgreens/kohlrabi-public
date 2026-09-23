'use strict';
/* #407: exercise detail's top-bar title names the page you're on ("Exercises"),
   not the tab you came from ("Stats", "Workout", ...). Back still returns via
   state.exerciseDetailReturn — only the title is canonicalized. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

function makeDoc(){
  const els=new Map();
  const el=()=>({
    _html:'', hidden:false, dataset:{},
    set innerHTML(v){this._html=String(v);},
    get innerHTML(){return this._html;},
    set textContent(v){this._html=String(v);},
    get textContent(){return this._html;},
    setAttribute(){}, getAttribute:()=>null, appendChild(){}, remove(){},
    addEventListener(){}, removeEventListener(){},
    classList:{add(){},remove(){},toggle(){},contains:()=>false},
    style:{},
  });
  return {
    _els:els,
    querySelector(sel){ if(!els.has(sel))els.set(sel,el()); return els.get(sel); },
    querySelectorAll:()=>[], getElementById:()=>null,
    createElement:()=>el(), createTextNode:(t)=>({textContent:String(t)}),
    addEventListener(){}, removeEventListener(){},
    titleText(sel){ return els.get(sel)?els.get(sel)._html:null; },
  };
}

const doc=makeDoc();
const role=loadRole('utilities',{globals:{document:doc,exercises:[]}});
const indirectEval=eval;
const updateTopBar=indirectEval('updateTopBar');
const state=indirectEval('state');

function titleFor(view,returnView){
  state.activeView=view;
  state.workoutSubScreen=null;
  state.programWorkoutUid=null;
  state.exerciseDetailReturn=returnView?{view:returnView}:null;
  updateTopBar(view);
  return doc.titleText('#topBarTitleText');
}

describe('#407 exercise-detail top-bar title',()=>{
  it('says "Exercises" when reached from Stats',()=>{
    assert.equal(titleFor('detail','stats'),'Exercises');
  });
  it('says "Exercises" when reached from a live workout',()=>{
    assert.equal(titleFor('detail','workout'),'Exercises');
  });
  it('says "Exercises" when reached from a program',()=>{
    assert.equal(titleFor('detail','program'),'Exercises');
  });
  it('says "Exercises" with no recorded return',()=>{
    assert.equal(titleFor('detail',null),'Exercises');
  });
  it('leaves other views untouched (Stats still says Stats)',()=>{
    assert.equal(titleFor('stats',null),'Stats');
    assert.equal(titleFor('library',null),'Exercises');
  });
});
