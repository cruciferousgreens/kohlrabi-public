'use strict';
/* #488 (v1.8): tapping a settings control (Units pills, dumbbell-entry
   pills, Hide-total toggle) scrolled the settings page to the top.
   Mechanism: those handlers re-render the hidden workout view via
   renderWorkoutScreen() -> noteWorkoutSubScreen(). On the first such call
   of the session state.workoutSubScreen is null, so noteWorkoutSubScreen
   treated it as a sub-screen transition and fired window.scrollTo({top:0})
   — yanking the visible settings page. The viewport move belongs to the
   workout view: background re-renders must record the sub-screen without
   touching the scroll. */
const {describe, it, beforeEach} = require('node:test');
const assert = require('node:assert/strict');
const {loadRole} = require('./harness');

/* Full editor chain with stubbed DOM (workout-editor.js owns
   noteWorkoutSubScreen). */
const role = loadRole('warmup-ui');
const {noteWorkoutSubScreen, state} = role;

let scrollCalls;
beforeEach(() => {
  scrollCalls = [];
  role.window.scrollTo = (...args) => { scrollCalls.push(args); };
  /* Fresh-session shape: the user went straight to Settings without ever
     opening the Workout tab. */
  state.activeView = 'settings';
  state.workoutSubScreen = null;
});

describe('#488 settings tap must not move the viewport', () => {
  it('background render (activeView=settings) records the sub-screen without scrolling', () => {
    const moved = noteWorkoutSubScreen('start');
    assert.equal(moved, true);
    assert.equal(state.workoutSubScreen, 'start');
    assert.equal(state.scroll['workout:start'], 0);
    assert.deepEqual(scrollCalls, [], 'no window.scrollTo while the workout view is not active');
  });

  it('repeat background render of the same sub-screen is a no-op', () => {
    noteWorkoutSubScreen('start');
    scrollCalls.length = 0;
    const moved = noteWorkoutSubScreen('start');
    assert.equal(moved, false);
    assert.deepEqual(scrollCalls, []);
  });

  it('workout-view sub-screen transitions still scroll to top', () => {
    state.activeView = 'workout';
    state.workoutSubScreen = 'start';
    const moved = noteWorkoutSubScreen('history');
    assert.equal(moved, true);
    assert.equal(scrollCalls.length, 1, 'the genuine new screen still moves the viewport');
    assert.deepEqual(scrollCalls[0][0], {top: 0, behavior: 'auto'});
  });

  it('no scroll when the workout view is hidden even on a real transition', () => {
    /* e.g. a sync merge re-rendering while the user sits on Stats. */
    state.activeView = 'stats';
    const moved = noteWorkoutSubScreen('editor');
    assert.equal(moved, true);
    assert.equal(state.workoutSubScreen, 'editor');
    assert.deepEqual(scrollCalls, [], 'hidden workout view must not move the visible page');
  });
});
