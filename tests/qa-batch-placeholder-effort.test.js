/* QA batch (user 2026-09-21): #3 prefill stability + #8 placeholder stability.
   - #3: set-row placeholders must fall back to the default range when
     item.progression is null (rangePlaceholder(null) returns empty).
   - #8: the rep/seconds placeholder must be stable — suggestion wins, else
     the range. The history ghost (holdPerf) must not override the range. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const editorSrc = fs.readFileSync(__dirname + '/../assets/js/workout/workout-editor.js', 'utf8');

test('#3: range placeholder uses the default-range fallback profile, not item.progression directly', () => {
  // liveSetRowHtml must route through progressionProfileForDraftItem for rp
  assert.match(editorSrc, /progressionProfileForDraftItem\(item\)/);
  // Both placeholder sites (row + card) must use the fallback
  const uses = (editorSrc.match(/rangePlaceholder\(rpProfile\|\|item\.progression/g) || []).length
    + (editorSrc.match(/rangePlaceholder\(rpProfile2\|\|item\.progression/g) || []).length;
  assert.ok(uses >= 2, `expected both placeholder sites to use the fallback profile, found ${uses}`);
});

test('#8: rep/seconds display placeholder is suggestion-then-range (no history ghost)', () => {
  // Row-level: target.seconds || rp.text (no holdPerf), target.r || rp.text
  assert.match(editorSrc, /target\.seconds \|\| rp\.text/);
  assert.match(editorSrc, /target\.r \|\| rp\.text/);
  // The untouched-completion fallback stays in sync (rp.value, not holdPerf)
  assert.match(editorSrc, /target\.r \|\| rp\.value/);
});

test('#8: distance keeps its history ghost (no range concept there)', () => {
  assert.match(editorSrc, /target\.distance \|\| holdPerf \|\| rp\.text/);
});

test('#5: effort toggle lives in Settings Units, not on the column header', () => {
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  const bootstrap = fs.readFileSync(__dirname + '/../assets/js/core/app-bootstrap.js', 'utf8');
  // Settings pills exist
  assert.match(html, /id="settingsEffortPills"/);
  assert.match(html, /data-effort="rpe"/);
  assert.match(html, /data-effort="rir"/);
  // Wired in bootstrap
  assert.match(bootstrap, /syncEffortPills/);
  // Column header is a static label, not a button
  assert.ok(!editorSrc.includes('effort-mode-toggle'), 'column-header toggle button must be gone');
  assert.ok(!editorSrc.includes('wireLiveEffortToggle'), 'wireLiveEffortToggle must be gone');
  const css = fs.readFileSync(__dirname + '/../assets/styles.css', 'utf8');
  assert.ok(!css.includes('.effort-mode-toggle'), 'toggle CSS must be gone');
});
