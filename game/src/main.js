// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between four screens: title, play, paused and busted.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission stages that scene
// instead of running the loop, paints it and sets window.__shotReady for a
// screenshot.
import { STEP, WORLD } from './config.js';
import { createWorld, applySave, makeSave, respawnAfterBust, shootAt, tryEnterCar, updateWorld } from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_ENTER,
  ACTION_PAUSE,
  ACTION_SHOOT,
  createInput,
} from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';
import { clearSave, readSave, writeSave } from './save.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const screen = stageShot(name, state);
  const save = readSave();
  let painted = 0;
  function paint() {
    renderer.draw(state, screen, Boolean(save));
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();

  function mouseWorld() {
    const mouse = input.mouse();
    const size = renderer.viewSize();
    const viewX = Math.min(Math.max(state.camera.x - size.width / 2, 0), Math.max(0, WORLD.width - size.width));
    const viewY = Math.min(Math.max(state.camera.y - size.height / 2, 0), Math.max(0, WORLD.height - size.height));
    return { x: mouse.x + viewX, y: mouse.y + viewY, screenX: mouse.x, screenY: mouse.y };
  }

  function startNewGame() {
    clearSave();
    const fresh = createWorld(seed);
    Object.assign(state, fresh);
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    save = null;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startEngine();
    announce('New game. Job 1: pick up the package at the Docks Warehouse.');
  }

  function continueGame() {
    const saved = readSave();
    if (!saved) return;
    applySave(state, saved);
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startEngine();
    announce(`Welcome back, Rae. Cash $${state.cash}.`);
  }

  function quitToTitle() {
    writeSave(makeSave(state));
    save = readSave();
    screen = SCREEN_TITLE;
    audio.stopEngine();
    announce('Saved. Title screen.');
  }

  function drainSfx() {
    for (const name of state.sfx) {
      if (name === 'click') audio.click();
      else if (name === 'pickup') audio.pickup();
      else if (name === 'missionDone') audio.missionDone();
      else if (name === 'crash') audio.crash();
      else if (name === 'shoot') audio.shoot();
      else if (name === 'denied') audio.denied();
      else if (name === 'wantedUp') audio.wantedUp();
    }
    state.sfx.length = 0;
    const playerCar = state.player.inCar;
    const speedFraction = playerCar ? Math.abs(playerCar.speed) / 430 : 0;
    audio.setEngine(speedFraction, Boolean(playerCar) && screen === SCREEN_PLAY);
    const policeNear = state.cars.some((car) => car.kind === 'police' && !car.disabled
      && Math.hypot(car.x - state.player.x, car.y - state.player.y) < 700);
    audio.setSiren(state.wanted > 0 && policeNear, state.time);
  }

  function handleTitleInput() {
    const actions = input.takeActions();
    const mouse = mouseWorld();
    if (actions & ACTION_CONFIRM) {
      if (save) continueGame();
      else startNewGame();
      return;
    }
    if (actions & ACTION_SHOOT) {
      const menu = renderer.titleMenu(Boolean(save));
      const inRect = (rect) => rect && mouse.screenX >= rect.x && mouse.screenX <= rect.x + rect.w
        && mouse.screenY >= rect.y && mouse.screenY <= rect.y + rect.h;
      if (inRect(menu.newGame)) startNewGame();
      else if (inRect(menu.continueGame)) continueGame();
    }
  }

  function handlePlayInput() {
    const actions = input.takeActions();
    if (actions & ACTION_ENTER) tryEnterCar(state);
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      audio.stopEngine();
      announce('Paused.');
      return;
    }
    if (actions & ACTION_SHOOT) {
      const target = mouseWorld();
      shootAt(state, target.x, target.y);
    }
  }

  function handlePausedInput() {
    const actions = input.takeActions();
    if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
      screen = SCREEN_PLAY;
      audio.startEngine();
      announce('Playing.');
    }
  }

  function handleBustedInput() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      respawnAfterBust(state);
      screen = SCREEN_PLAY;
      audio.startEngine();
      announce('You wake up at St. Coral Hospital.');
    }
  }

  // Menu keys the input module does not own: 1 new game, 2 continue, S save+quit.
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (screen === SCREEN_TITLE && event.code === 'Digit1') startNewGame();
    else if (screen === SCREEN_TITLE && event.code === 'Digit2' && save) continueGame();
    else if (screen === SCREEN_PAUSED && event.code === 'KeyS') quitToTitle();
  });

  function step() {
    if (screen !== SCREEN_PLAY) return;
    if (input.takeMute()) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    handlePlayInput();
    const mouse = mouseWorld();
    updateWorld(state, STEP, input, mouse);
    if (state.saveNow) {
      state.saveNow = false;
      writeSave(makeSave(state));
      save = readSave();
    }
    if (state.busted) {
      screen = SCREEN_BUSTED;
      audio.stopEngine();
      announce('Busted by the Marisol Bay PD.');
    }
    drainSfx();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (screen === SCREEN_TITLE) handleTitleInput();
    else if (screen === SCREEN_PAUSED) handlePausedInput();
    else if (screen === SCREEN_BUSTED) handleBustedInput();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(state, screen, Boolean(save));
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.stopEngine();
      announce('Paused.');
    }
  });

  announce('Sunset Keys. Press 1 for a new game, 2 to continue.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
