'use strict';
/* v1.877 (user 2026-09-21): Home hydration gate — Home must never render
   cards from unhydrated state. Pins: (1) state.js declares the session-only
   homeHydrated flag (false at boot); (2) renderDashboard() early-returns to
   the skeleton while !homeHydrated; (3) the boot paints the skeleton before
   restorePersisted() and sets homeHydrated=true only after it resolves;
   (4) a paintHomeSkeleton() painter exists using the shared .skel shimmer. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const stateJs=fs.readFileSync(path.join(ROOT,'assets/js/core/state.js'),'utf8');
const dashJs=fs.readFileSync(path.join(ROOT,'assets/js/pages/dashboard-stats.js'),'utf8');
const bootJs=fs.readFileSync(path.join(ROOT,'assets/js/core/app-bootstrap.js'),'utf8');

describe('v1.877 Home hydration gate',()=>{
  it('state.js declares session-only homeHydrated:false',()=>{
    assert.ok(stateJs.includes('homeHydrated:false'),'homeHydrated flag missing from freshNavState');
  });
  it('renderDashboard() gates on homeHydrated and paints the skeleton',()=>{
    const fn=dashJs.slice(dashJs.indexOf('function renderDashboard()'));
    const head=fn.slice(0,600);
    assert.ok(head.includes('!state.homeHydrated'),'renderDashboard must check state.homeHydrated');
    assert.ok(head.includes('paintHomeSkeleton()'),'renderDashboard must paint the skeleton while unhydrated');
    assert.ok(/return null;/.test(head),'renderDashboard must return before rendering cards while unhydrated');
  });
  it('paintHomeSkeleton() uses the shared .skel shimmer (no card content)',()=>{
    const fn=dashJs.slice(dashJs.indexOf('function paintHomeSkeleton()'));
    const body=fn.slice(0,1200);
    assert.ok(body.includes('class="skel'),'skeleton must use the .skel shimmer classes');
    assert.ok(!body.includes('workoutState.completed'),'skeleton must not read workout data');
  });
  it('boot paints skeleton before restore, sets homeHydrated after',()=>{
    const boot=bootJs.slice(bootJs.indexOf('(async function(){'));
    const paintAt=boot.indexOf('paintHomeSkeleton()');
    const restoreAt=boot.indexOf('await restorePersisted()');
    const flagAt=boot.indexOf('state.homeHydrated=true');
    assert.ok(paintAt>=0&&restoreAt>=0&&flagAt>=0,'boot skeleton/restore/flag wiring missing');
    assert.ok(paintAt<restoreAt,'skeleton must paint BEFORE await restorePersisted()');
    assert.ok(flagAt>restoreAt,'homeHydrated must be set only AFTER restore resolves');
  });
});
