'use strict';
/* Persona QA 2026-09-16 (techie pass): reloading while on #program with an
   active program popped the "Start a new program?" deep-link dialog
   unprompted. That modal exists for EXTERNAL deep links (#445) — a reload
   is not a deep link, so maybeOfferNewProgramForDeepLink stays quiet when
   the navigation type is 'reload'. Role: progression-logic (loads
   programs.js); performance is stubbed per-test. */
const {describe,it,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const role=loadRole('progression-logic',{globals:{exercises:[]}});
const {isReloadNavigation}=role;

const realPerformance=globalThis.performance;
afterEach(()=>{globalThis.performance=realPerformance;});

describe('program deep-link modal skips reloads',()=>{
  it('detects a reload navigation',()=>{
    globalThis.performance={getEntriesByType:()=>[{type:'reload'}]};
    assert.equal(isReloadNavigation(),true);
  });
  it('stays quiet on fresh navigations',()=>{
    globalThis.performance={getEntriesByType:()=>[{type:'navigate'}]};
    assert.equal(isReloadNavigation(),false);
  });
  it('stays quiet when the navigation type is unavailable',()=>{
    globalThis.performance={getEntriesByType:()=>[]};
    assert.equal(isReloadNavigation(),false);
    globalThis.performance={};
    assert.equal(isReloadNavigation(),false);
  });
});
