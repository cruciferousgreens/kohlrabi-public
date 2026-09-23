'use strict';
/* #420 (user 2026-09-13): the actual ask — a DEFAULT toggle for the %1RM wave
   in Settings → progression defaults, exactly like the existing "vary rep
   ranges" default toggle. New programs inherit progressionSetup, so flipping
   the default flows to them. Regression pins:
   - the Settings markup for #settingsPctWaveDefaultToggle exists (switch role,
     correct copy, default off);
   - the click handler flips progressionSetup.pctWave, syncs aria-pressed /
     aria-label, and persists;
   - the settings render syncs the toggle from progressionSetup.pctWave;
   - pctWave defaults to false in DEFAULT_PROGRESSION_SETUP;
   - new program drafts seed from progressionSetup (inheritance path).
   #417 (user 2026-09-13): the highlight ring moved OFF the Workout tab program
   button (reverted) and ONTO the Home page quick-start button (#startDashboardNext). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');
const bootstrap=fs.readFileSync(path.join(ROOT,'assets/js/core/app-bootstrap.js'),'utf8');
const state=fs.readFileSync(path.join(ROOT,'assets/js/core/state.js'),'utf8');
const programs=fs.readFileSync(path.join(ROOT,'assets/js/pages/programs.js'),'utf8');

describe('#420 default %1RM wave toggle',()=>{
  it('Settings has the default toggle markup, mirroring vary-rep-ranges',()=>{
    assert.ok(/id="settingsPctWaveDefaultToggle"/.test(html),'toggle exists in Settings');
    const m=html.match(/<button[^>]*id="settingsPctWaveDefaultToggle"[^>]*>/);
    assert.ok(m,'toggle button markup found');
    assert.ok(/role="switch"/.test(m[0]),'toggle is a switch');
    assert.ok(/aria-pressed="false"/.test(m[0]),'toggle starts off');
    assert.ok(/Vary % of 1RM by week/.test(html.slice(html.indexOf('settingsPctWaveDefaultToggle')-400,html.indexOf('settingsPctWaveDefaultToggle'))),
      'toggle copy mirrors the undulating default');
  });
  it('the toggle flips progressionSetup.pctWave and persists',()=>{
    const line=bootstrap.split('\n').find(l=>l.includes("$('#settingsPctWaveDefaultToggle')")&&l.includes('addEventListener'));
    assert.ok(line,'click wiring exists');
    assert.ok(line.includes('progressionSetup.pctWave=!progressionSetup.pctWave'),'flips the default');
    assert.ok(/aria-pressed/.test(line)&&/aria-label/.test(line),'syncs aria state');
    assert.ok(line.includes('schedulePersist()'),'persists the new default');
    assert.ok(!line.includes('syncSettingsPeriodization'),'no undulating coupling');
  });
  it('the settings render syncs the toggle from the stored default',()=>{
    assert.ok(/\$\('#settingsPctWaveDefaultToggle'\)/.test(bootstrap),'render references the toggle');
    assert.ok(/progressionSetup\.pctWave\?'on':'off'/.test(bootstrap),'label reflects on/off state');
  });
  it('pctWave defaults to false in DEFAULT_PROGRESSION_SETUP',()=>{
    const m=state.match(/DEFAULT_PROGRESSION_SETUP=\{([^}]*)\}/);
    assert.ok(m,'DEFAULT_PROGRESSION_SETUP found');
    assert.ok(/pctWave:false/.test(m[1]),'pctWave default is off');
  });
  it('new program drafts inherit progressionSetup (including the pctWave default)',()=>{
    assert.ok(/programDraftProgression=cloneProgression\(fromProgram\?\.progression\|\|progressionSetup\)/.test(programs),
      'new programs seed the draft from progressionSetup');
  });
  it('the OFF direction survives: discarding drops the draft so the next new-program form re-seeds from defaults',()=>{
    /* #420 (user 2026-09-13, v1.645): with the default OFF, a stale draft
       (e.g. wave toggled ON then discarded) leaked into the next new-program
       form via renderProgram()'s `else syncProgramForm()` branch, showing
       the wave despite the default. cancelProgramEdit must null the draft. */
    const m=programs.match(/function cancelProgramEdit\(\)\{([\s\S]*?)\n    \}/);
    assert.ok(m,'cancelProgramEdit found');
    assert.ok(/programDraftProgression=null/.test(m[1]),
      'discard nulls the draft — no stale wave leaking into the next new program');
    assert.ok(/if\(!programDraftProgression\)seedProgramForm\(null\)/.test(programs),
      'renderProgram re-seeds the new-program form from progressionSetup when no draft exists');
  });
  it('the Settings wave section only displays when the default toggle is ON',()=>{
    /* #420 (user 2026-09-13, v1.646): "do not display the wave in settings
       unless vary is toggled on as a default in settings". The active
       program's wave rows gate on progressionSetup.pctWave, not on the
       program's own flag. */
    const m=bootstrap.match(/function renderSettingsPctWave\(\)\{([\s\S]*?)\n    \}\n/);
    assert.ok(m,'renderSettingsPctWave found');
    const body=m[1];
    assert.ok(/if\(!progressionSetup\.pctWave\)\{\s*wrap\.hidden=true;/.test(body),
      'default OFF hides the wave section before any program check');
    assert.ok(body.indexOf('if(!progressionSetup.pctWave)')<body.indexOf('workoutState&&workoutState.activeProgram'),
      'the default gate runs before the active-program lookup');
  });
  it('flipping the default toggle immediately shows/hides the wave section',()=>{
    const line=bootstrap.split('\n').find(l=>l.includes("$('#settingsPctWaveDefaultToggle')")&&l.includes('addEventListener'));
    assert.ok(line,'click wiring exists');
    assert.ok(line.includes('renderSettingsPctWave()'),
      'toggle re-renders the wave section — no reload needed to show/hide it');
  });
});

describe('#436 home quick-start matches the Workout tab program button',()=>{
  it('the Workout tab program button carries no ring',()=>{
    assert.ok(!/\.workout-start-options\s+\.program-next-main\s*\{[^}]*outline:/.test(css),
      'ring reverted off .workout-start-options .program-next-main');
  });
  it('the #417 ring is retired — the card carries its own green border',()=>{
    assert.ok(!/#startDashboardNext\s*\{[^}]*outline:/.test(css),
      '#startDashboardNext outline ring removed');
  });
});
