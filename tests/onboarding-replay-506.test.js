'use strict';
/* #506 (user 2026-09-16): QA-only "Replay onboarding" trigger in Settings →
   About. In the public fork wireOnboardingReplay() unhides the row wherever
   it exists — no hosted-domain allowlist — and clicking the button clears
   the completion marker and restarts the flow from the welcome screen. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

/* One loadRole per process (re-loading re-declares top-level consts). The
   location stub is mutable so each test sets its own hostname. */
const mutableLocation={hostname:'beta.kohlrabi.us',href:'',search:'',pathname:'/',hash:''};
let clickFn=null;
const row={hidden:true};
const btn={addEventListener(ev,fn){if(ev==='click')clickFn=fn;}};
const els={replayOnboardingButton:btn,qaOnboardingRow:row};
const role=loadRole('onboarding-506',{globals:{
  location:mutableLocation,
  document:{
    getElementById(id){return Object.prototype.hasOwnProperty.call(els,id)?els[id]:null;},
    querySelector:()=>null,
    querySelectorAll:()=>[],
    createElement:()=>({setAttribute(){},appendChild(){}}),
    body:{classList:{add(){},remove(){}},appendChild(){}},
  },
}});

function setHost(h){
  mutableLocation.hostname=h;
  mutableLocation.href='http://'+h+'/';
  row.hidden=true;
  clickFn=null;
  try{globalThis.localStorage.clear();}catch(_){}
  role.ofResetState();
}

describe('#506 QA replay trigger visibility',()=>{
  it('shows on the QA host',()=>{
    setHost('beta.kohlrabi.us');
    role.wireOnboardingReplay();
    assert.equal(row.hidden,false);
  });
  it('shows on localhost and pages.dev preview hosts',()=>{
    for(const h of ['localhost','cg-workout-qa.pages.dev']){
      setHost(h);
      role.wireOnboardingReplay();
      assert.equal(row.hidden,false,'visible on '+h);
    }
  });
  it('shows on every host (public fork: no hosted-domain gate)',()=>{
    for(const h of ['kohlrabi.us','www.kohlrabi.us','app.cruciferousgreens.com','beta.kohlrabi.us']) {
      setHost(h);
      role.wireOnboardingReplay();
      assert.equal(row.hidden,false,'visible on '+h);
    }
  });
});

describe('#506 QA replay trigger behavior',()=>{
  it('clicking clears the completion marker and restarts the flow',()=>{
    setHost('beta.kohlrabi.us');
    globalThis.localStorage.setItem(role.ONBOARDING_DONE_KEY,'1');
    role.ofState.screen='done';
    role.wireOnboardingReplay();
    assert.equal(row.hidden,false);
    assert.ok(clickFn,'click handler wired');
    clickFn();
    assert.equal(globalThis.localStorage.getItem(role.ONBOARDING_DONE_KEY),null,
      'completion marker cleared');
    assert.equal(role.ofState.screen,'welcome','flow restarts at welcome');
  });
});
