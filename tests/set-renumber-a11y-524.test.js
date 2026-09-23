'use strict';
/* #524 follow-up (agent 2026-09-17): deleting a set renumbers the visible
   1..N labels, but the in-place renumber left the screen-reader names
   stale — inputs still announced "Set 3 weight in pounds" on the row now
   labeled 2, and both delete controls still said "Delete set 3". The
   renumber also never touched the real delete hooks (.delete-set-inline /
   .delete-set-swipe) — it targeted a .set-delete-btn class nothing renders.
   renumberWorkoutSetRows drives all of them from the row's DOM position. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {renumberWorkoutSetRows}=loadRole('workout-screen-logic');

function fakeEl(attrs){
  const el={textContent:'',_attrs:Object.assign({},attrs),
    setAttribute(k,v){this._attrs[k]=String(v);},
    getAttribute(k){return this._attrs[k]??null;},
    hasAttribute(k){return Object.prototype.hasOwnProperty.call(this._attrs,k);}};
  return el;
}
/* One fake set row as rendered by liveSetRowHtml for a 1-based number n:
   number button, weight/reps/RPE inputs, inline ×, swipe rail. */
function fakeRow(n){
  const numBtn=fakeEl({'aria-label':`Choose tags for set ${n}`});
  numBtn.textContent=String(n);
  const inputs=[
    fakeEl({'aria-label':`Set ${n} weight in pounds`}),
    fakeEl({'aria-label':`Set ${n} reps; target 8`}),
    fakeEl({'aria-label':`Set ${n} optional RPE`}),
  ];
  const inlineBtn=fakeEl({'aria-label':`Delete set ${n}`});
  const swipeBtn=fakeEl({'aria-label':`Delete set ${n}`});
  const row={
    querySelector(sel){
      if(sel==='.log-set-number')return numBtn;
      if(sel==='.delete-set-inline')return inlineBtn;
      return null;
    },
    querySelectorAll(sel){
      if(sel==='input[aria-label]')return inputs;
      return [];
    },
    closest(){return {querySelector:sel=>sel==='.delete-set-swipe'?swipeBtn:null};},
  };
  row._numBtn=numBtn;row._inputs=inputs;row._inlineBtn=inlineBtn;row._swipeBtn=swipeBtn;
  return row;
}

describe('renumberWorkoutSetRows (set-deletion a11y follow-up)',()=>{
  it('drives every row name from DOM position after a middle deletion',()=>{
    /* Four rows rendered 1..4; the browser deleted set 2, so the card now
       holds the first, third, and fourth rows with their stale names. */
    const rows=[fakeRow(1),fakeRow(3),fakeRow(4)];
    const card={querySelectorAll:sel=>sel==='.log-set'?rows:[]};
    renumberWorkoutSetRows(card);
    const names=rows.map(r=>r._numBtn.textContent);
    assert.deepEqual(names,['1','2','3'],'visible labels become 1,2,3');
    const rows2=rows;
    rows2.forEach((row,i)=>{
      const n=String(i+1);
      assert.equal(row._numBtn.getAttribute('aria-label'),`Choose tags for set ${n}`,`number button names set ${n}`);
      assert.equal(row._inputs[0].getAttribute('aria-label'),`Set ${n} weight in pounds`,`weight input names set ${n}`);
      assert.equal(row._inputs[1].getAttribute('aria-label'),`Set ${n} reps; target 8`,`reps input names set ${n}`);
      assert.equal(row._inputs[2].getAttribute('aria-label'),`Set ${n} optional RPE`,`RPE input names set ${n}`);
      assert.equal(row._inlineBtn.getAttribute('aria-label'),`Delete set ${n}`,`inline × names set ${n}`);
      assert.equal(row._swipeBtn.getAttribute('aria-label'),`Delete set ${n}`,`swipe rail names set ${n}`);
    });
  });
  it('keeps the frozen-set number button as the uncomplete unlock',()=>{
    const row=fakeRow(2);
    row._numBtn._attrs['data-uncomplete']='1';
    row._numBtn.setAttribute('aria-label','Mark set 2 incomplete');
    const card={querySelectorAll:()=>[fakeRow(1),row]};
    renumberWorkoutSetRows(card);
    assert.equal(card.querySelectorAll()[1]._numBtn.getAttribute('aria-label'),'Mark set 2 incomplete','frozen button stays the unlock');
    assert.equal(card.querySelectorAll()[0]._numBtn.getAttribute('aria-label'),'Choose tags for set 1','normal button keeps the tag opener name');
  });
  it('leaves names untouched when there is nothing stale to fix',()=>{
    const rows=[fakeRow(1),fakeRow(2)];
    const card={querySelectorAll:sel=>sel==='.log-set'?rows:[]};
    renumberWorkoutSetRows(card);
    assert.equal(rows[0]._inputs[0].getAttribute('aria-label'),'Set 1 weight in pounds');
    assert.equal(rows[1]._inputs[0].getAttribute('aria-label'),'Set 2 weight in pounds');
  });
});
