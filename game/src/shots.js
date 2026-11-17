// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one
// places the player, the cars and the police at fixed spots in the seeded
// city and leaves the world still, so the frame is a real render of the
// game's own code and the same seed always gives the same frame.

import { CAR, PALETTE } from './config.js';
import { PLACES } from './city.js';
import { MISSIONS } from './missions.js';

function placePlayerInCar(state, car, x, y, angle) {
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = 0;
  car.kind = 'player';
  car.occupied = true;
  car.parked = false;
  state.player.inCar = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  state.camera.x = x;
  state.camera.y = y;
}

function placePlayerOnFoot(state, x, y, angle) {
  state.player.inCar = null;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  state.camera.x = x;
  state.camera.y = y;
}

function firstParkedCar(state) {
  return state.cars.find((car) => car.kind === 'parked');
}

function moveTrafficOntoRoad(state, roadY, xs) {
  const traffic = state.cars.filter((car) => car.kind === 'traffic');
  xs.forEach((x, i) => {
    const car = traffic[i];
    if (!car) return;
    car.axis = 'h';
    car.road = roadY;
    car.x = x;
    car.y = roadY + (i % 2 === 0 ? -26 : 26);
    car.angle = i % 2 === 0 ? 0 : Math.PI;
  });
}

function makeCruiser(x, y, angle) {
  return {
    id: 9000 + Math.round(x),
    kind: 'police',
    x,
    y,
    angle,
    speed: 200,
    color: PALETTE.policeCar,
    occupied: true,
    disabled: false,
    health: 100,
    lostTimer: 0,
    ramCooldown: 0,
  };
}

function clearPolice(state) {
  state.cars = state.cars.filter((car) => car.kind !== 'police');
}

function stageDrive(state) {
  state.mission = MISSIONS[0];
  state.missionIndex = 0;
  state.stepIndex = 0;
  state.cash = 0;
  state.wanted = 0;
  const car = firstParkedCar(state);
  placePlayerInCar(state, car, 1520, 980, 0);
  moveTrafficOntoRoad(state, 980, [1200, 1750, 2050, 2400]);
  // A few pedestrians on the sidewalk so the street reads as alive.
  state.peds.slice(0, 4).forEach((ped, i) => {
    ped.x = 1300 + i * 170;
    ped.y = 980 - 68;
    ped.angle = i % 2 === 0 ? 0 : Math.PI;
    ped.fleeing = false;
  });
  return 'play';
}

function stageChase(state) {
  clearPolice(state);
  state.mission = MISSIONS[1];
  state.missionIndex = 1;
  state.stepIndex = 1;
  state.cash = 300;
  state.wanted = 3;
  state.wantedTimer = 14;
  const comet = state.cars.find((car) => car.kind === 'comet');
  placePlayerInCar(state, comet, 1920, 1340, 0);
  comet.speed = 260;
  moveTrafficOntoRoad(state, 1340, [1500, 2300, 2650]);
  state.cars.push(makeCruiser(1720, 1340, 0));
  state.cars.push(makeCruiser(1780, 1390, 0));
  state.cars.push(makeCruiser(2100, 1290, Math.PI));
  state.peds.slice(0, 2).forEach((ped, i) => {
    ped.x = 1600 + i * 260;
    ped.y = 1340 - 68;
    ped.angle = 0;
    ped.fleeing = true;
  });
  return 'play';
}

function stageMission(state) {
  clearPolice(state);
  state.mission = MISSIONS[1];
  state.missionIndex = 1;
  state.stepIndex = 0;
  state.cash = 300;
  state.wanted = 0;
  const comet = state.cars.find((car) => car.kind === 'comet');
  comet.x = PLACES.dealerLot.x + 40;
  comet.y = PLACES.dealerLot.y + 10;
  placePlayerOnFoot(state, PLACES.dealerLot.x - 30, PLACES.dealerLot.y + 10, 0);
  moveTrafficOntoRoad(state, 260, [900, 1500]);
  state.peds.slice(0, 3).forEach((ped, i) => {
    ped.x = 950 + i * 180;
    ped.y = 260 + 68;
    ped.angle = 0;
    ped.fleeing = false;
  });
  return 'play';
}

function stageStart(state) {
  clearPolice(state);
  state.mission = MISSIONS[0];
  state.missionIndex = 0;
  state.stepIndex = 0;
  state.cash = 0;
  state.wanted = 0;
  placePlayerOnFoot(state, PLACES.startCorner.x, PLACES.startCorner.y, -Math.PI / 2);
  state.camera.x = 1520;
  state.camera.y = 980;
  return 'title';
}

/**
 * Set `state` to the named scene (start, drive, chase or mission; any other
 * name is start) and return the screen to draw over it.
 */
export function stageShot(name, state) {
  if (name === 'drive') return stageDrive(state);
  if (name === 'chase') return stageChase(state);
  if (name === 'mission') return stageMission(state);
  return stageStart(state);
}

export { CAR };
