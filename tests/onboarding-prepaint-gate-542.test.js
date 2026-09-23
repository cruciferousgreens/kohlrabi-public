'use strict';
/* #542 (user 2026-09-17 hotfix): fresh-start home flash — the onboarding
   decision in app-bootstrap is async (IndexedDB probe), so the home tab
   could paint before the flow appeared. A pre-paint gate in <head> hides
   the app chrome until the decision resolves. Static assertions pin the
   contract: synchronous flag read, share-boot exclusion, pre-paint
   ordering, the CSS rule, and class removal at the decision point. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'assets','styles.css'),'utf8');
const boot=fs.readFileSync(path.join(ROOT,'assets','js','core','app-bootstrap.js'),'utf8');

describe('#542: pre-paint onboarding gate — home never flashes before the flow',()=>{
  it('the head script gates on the onboarding-done flag before first paint',()=>{
    const head=html.slice(0,html.indexOf('</head>'));
    assert.ok(head.includes("localStorage.getItem('workout-app:onboarding-v2-done')"),'sync flag read pre-paint');
    assert.ok(head.includes("classList.add('ob-pending')"),'ob-pending class added pre-paint');
  });
  it('share boots are excluded from the gate (public fork: no auth callbacks exist)',()=>{
    const head=html.slice(0,html.indexOf('</head>'));
    const at=head.indexOf("classList.add('ob-pending')");
    const gate=head.slice(at-600,at);
    assert.ok(gate.includes("classList.contains('share-boot')"),'share boot excluded');
    assert.ok(!gate.includes('[?&]code='),'magic-link callback check must be gone');
    assert.ok(!gate.includes('_obAuth'),'auth gate variable must be gone');
  });
  it('the gate script runs before the stylesheet link (pre-paint ordering)',()=>{
    const head=html.slice(0,html.indexOf('</head>'));
    assert.ok(head.indexOf("classList.add('ob-pending')")<head.indexOf('rel="stylesheet"'),'gate precedes CSS');
  });
  it('CSS hides the app chrome while the gate is up',()=>{
    const m=css.match(/html\.ob-pending[^{]*\{[^}]*\}/);
    assert.ok(m,'ob-pending rule exists');
    assert.ok(m[0].includes('.app'),'app hidden');
    assert.ok(m[0].includes('.top-bar'),'top bar hidden');
    assert.ok(m[0].includes('.bottom-nav'),'bottom nav hidden');
    assert.ok(m[0].includes('visibility:hidden'),'hidden via visibility (keeps layout, no shift)');
  });
  it('app-bootstrap lifts the gate right after the onboarding decision resolves',()=>{
    const i=boot.indexOf('maybeStartOnboardingV2()');
    assert.ok(i!==-1,'onboarding decision present');
    const after=boot.slice(i,i+1200);
    assert.ok(after.includes("classList.remove('ob-pending')"),'gate removed after the decision resolves');
  });
});
