// Save and continue: the player's cash, story progress and position live in
// localStorage, so quitting to the title screen and coming back resumes the
// same run. Nothing leaves the browser.

import { SAVE_KEY } from './config.js';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save !== 'object' || save === null) return null;
    if (typeof save.cash !== 'number' || typeof save.missionIndex !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: there is then nothing to clear.
  }
}
