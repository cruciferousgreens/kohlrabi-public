'use strict';
/* Persona-4 finding 4 (user 2026-09-15): the #445 deep-link modal only fired
   at boot; a #program hash change mid-session (e.g. the marketing site's
   "Create program" CTA with the app already open) silently did nothing. The
   hashchange listener now routes mid-session #program through the same
   boot path: showProgram(false) (no double history entry, #265) plus
   maybeOfferNewProgramForDeepLink(). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const boot=fs.readFileSync(path.join(ROOT,'assets/js/core/app-bootstrap.js'),'utf8');

describe('persona-4 finding 4: mid-session #program deep link',()=>{
  const listener=boot.match(/window\.addEventListener\('hashchange',\(\)=>\{([\s\S]*?)\n\}\);/);
  it('the hashchange listener exists',()=>{
    assert.ok(listener,'hashchange listener found');
  });
  it('routes mid-session #program to the Program tab + deep-link modal',()=>{
    const body=listener[1];
    /* #562: the listener reads the hash through the malformed-hash guard. */
    assert.ok(body.includes(`safeDecodeHash()==='program'`),
      'listener detects the #program hash');
    assert.ok(body.includes('showProgram(false)'),'routes to the Program tab without pushing (#265)');
    assert.ok(body.includes('maybeOfferNewProgramForDeepLink()'),
      'offers the same new-program modal as the boot path');
  });
  it('still handles #share= links first, with the #program branch after',()=>{
    const body=listener[1];
    assert.ok(body.includes("if(/^#share=/.test(location.hash||'')){"),
      '#share= branch still first');
    assert.ok(body.includes('parseShareHash()'),'share decode path intact');
    assert.ok(body.indexOf("if(/^#share=/.test(location.hash||'')){")
      < body.indexOf("safeDecodeHash()==='program'"),
      '#share= branch precedes the #program branch');
  });
  it('the boot path is unchanged apart from the #504 form-open flag',()=>{
    assert.ok(boot.includes("else if (initialId === 'program') { if(!workoutState.activeProgram)state.programSetupOpen=true; showProgram(false); maybeOfferNewProgramForDeepLink(); }"),
      'boot #program handling untouched apart from #504');
  });
});
