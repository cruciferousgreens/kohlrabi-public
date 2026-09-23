'use strict';
/* #448 (user 2026-09-14): the exercise reorder dialog renders ONE row per
   superset block — the row the user sees is the unit that moves. A group
   shows its Superset N tag plus member names with a single arrow pair, not
   one row (with its own arrows) per member. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const R=loadRole('warmup-ui');
const {renderReorderList,newExerciseItem,workoutState}=R;

let listEl, buttons;
function fakeButton(attrs){
  const b={attrs,listeners:{},focused:false,
    addEventListener(t,fn){this.listeners[t]=fn;},
    focus(){this.focused=true;}};
  Object.assign(b,attrs);
  return b;
}
function fakeListEl(){
  return {
    innerHTML:'', listeners:{},
    querySelectorAll(sel){
      if(sel!=='.reorder-arrow')return [];
      /* Build one fake button per .reorder-arrow in the rendered HTML. */
      buttons=[];
      const re=/<button class="reorder-arrow"([^>]*)>/g;
      let m;
      while((m=re.exec(this.innerHTML))){
        const attrs={};
        const dm=m[1].match(/data-move="([^"]*)"/); if(dm)attrs.move=dm[1];
        const db=m[1].match(/data-block="([^"]*)"/); if(db)attrs.block=db[1];
        const dis=/disabled/.test(m[1]);
        buttons.push(fakeButton({dataset:attrs,disabled:dis}));
      }
      return buttons;
    },
    querySelector(sel){
      const m=sel.match(/\.reorder-arrow\[data-block="(\d+)"\]\[data-move="([a-z]+)"\]/);
      if(!m)return null;
      return (buttons||[]).find(b=>b.dataset.block===m[1]&&b.dataset.move===m[2])||null;
    },
  };
}
function names(){return workoutState.draft.exercises.map(e=>e.exerciseId);}
beforeEach(()=>{
  listEl=fakeListEl(); buttons=[];
  globalThis.document.querySelector=(sel)=>sel==='#reorderExercisesList'?listEl:null;
  globalThis.document.querySelectorAll=()=>[];
  R.exercises.push({id:'ex-a',name:'Bench Press'},{id:'ex-b',name:'Barbell Row'},{id:'ex-c',name:'Overhead Press'});
  const a=newExerciseItem({exerciseId:'ex-a'}); a.supersetId='ss1';
  const b=newExerciseItem({exerciseId:'ex-b'}); b.supersetId='ss1';
  const c=newExerciseItem({exerciseId:'ex-c'});
  workoutState.draft={exercises:[a,b,c]};
  globalThis.markDraftSaved=()=>{};
});
function rows(){return listEl.innerHTML.split('<div class="reorder-row"').slice(1);}

describe('#448 reorder dialog: one row per superset block',()=>{
  it('renders a group as a single row with one arrow pair',()=>{
    renderReorderList();
    const r=rows();
    assert.equal(r.length,2,'expected 2 rows for [group, single], got '+r.length);
    assert.ok(r[0].includes('Superset 1'),'group row missing Superset tag');
    assert.ok(r[0].includes('Bench Press'),'group row missing member A');
    assert.ok(r[0].includes('Barbell Row'),'group row missing member B');
    assert.equal((r[0].match(/data-move="up"/g)||[]).length,1,'group row should have one up arrow');
    assert.equal((r[0].match(/data-move="down"/g)||[]).length,1,'group row should have one down arrow');
    assert.ok(r[1].includes('Overhead Press'),'single row missing name');
  });
  it('first block: up disabled; last block: down disabled',()=>{
    renderReorderList();
    const r=rows();
    assert.ok(/data-move="up"[^>]*disabled/.test(r[0])||/disabled[^>]*data-move="up"/.test(r[0]),'first block up should be disabled');
    assert.ok(!/disabled/.test(r[0].match(/data-move="down"[^>]*>/)[0].replace('disabled','x')),'first block down should be enabled');
    const downLast=r[1].match(/data-move="down"[^>]*>/)[0];
    assert.ok(/disabled/.test(downLast),'last block down should be disabled');
  });
  it('moving the group down moves the whole block as one unit',()=>{
    renderReorderList();
    const downBtn=buttons.find(b=>b.dataset.block==='0'&&b.dataset.move==='down');
    assert.ok(downBtn,'group down button not found');
    downBtn.listeners.click();
    assert.deepEqual(names(),['ex-c','ex-a','ex-b'],'group did not move as one block');
    assert.equal(rows().length,2,'row count changed after move');
  });
  it('moving the single up swaps it past the whole group',()=>{
    renderReorderList();
    const upBtn=buttons.find(b=>b.dataset.block==='1'&&b.dataset.move==='up');
    assert.ok(upBtn,'single up button not found');
    upBtn.listeners.click();
    assert.deepEqual(names(),['ex-c','ex-a','ex-b'],'single did not move past the group');
  });
  it('no group: every exercise is its own row (unchanged behavior)',()=>{
    workoutState.draft.exercises.forEach(e=>{e.supersetId=null;});
    renderReorderList();
    assert.equal(rows().length,3,'expected 3 rows with no groups');
  });
});
