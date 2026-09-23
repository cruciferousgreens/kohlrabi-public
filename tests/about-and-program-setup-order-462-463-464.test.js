'use strict';
/* #462/#463/#464 (user 2026-09-15): Settings → About and program-setup
   ordering fixes. Structural pins on index.html markup (plus the
   build-stamp wiring in app-bootstrap.js):
   - #462: the program progression section keeps its order; the "All sets"
     toggle was retired in the QA batch of 2026-09-22 (per-set targets are
     the only path now). (Auto Deload, which used to sit above it, was also
     removed in that batch.)
   - #463: the About version line is a link to the release notes, and the
     build stamp writes the version text into that anchor (not the plain
     line, which would wipe the link).
   - #464: the "Last updated" stamp reads directly under the "Check for
     updates" button. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const bootstrap=fs.readFileSync(path.join(ROOT,'assets/js/core/app-bootstrap.js'),'utf8');

describe('program setup + About ordering (#462/#463/#464)',()=>{
  it('#462: the All-sets toggle is retired — no All sets row in the progression section',()=>{
    /* QA batch (user 2026-09-22): per-set targets are the only path, so the
       toggle is gone from both the program form and Settings. */
    assert.ok(html.indexOf('id="programAllSetsRow"')===-1,'programAllSetsRow is gone');
    assert.ok(html.indexOf('id="allSetsRow"')===-1,'allSetsRow is gone');
    assert.ok(html.indexOf('id="programAllSetsToggle"')===-1,'programAllSetsToggle is gone');
    assert.ok(html.indexOf('id="allSetsToggle"')===-1,'allSetsToggle is gone');
    assert.ok(html.indexOf('id="autoDeloadPanel"')===-1,'autoDeloadPanel is gone');
  });
  it('#463: version line is a link to the release notes',()=>{
    assert.match(html,/<p class="section-note" id="appVersionLine"><a[^>]*id="appVersionLink"[^>]*href="https:\/\/cruciferousgreens\.com\/release-notes"[^>]*>/,'appVersionLine wraps an anchor to the release notes');
    assert.ok(html.includes('target="_blank"')&&html.includes('id="appVersionLink"'),'release-notes link opens in a new tab');
    assert.match(bootstrap,/\$\('#appVersionLink'\)\|\|\$\('#appVersionLine'\)/,'build stamp targets the anchor first (falls back to the plain line)');
  });
  it('#464: Last updated sits under the Check for updates button',()=>{
    const stamp=html.indexOf('id="buildUpdatedLine"');
    const check=html.indexOf('id="checkUpdatesButton"');
    assert.ok(stamp>-1&&check>-1,'both About rows exist');
    assert.ok(stamp>check,'Last updated renders after (under) the Check for updates button');
  });
});
