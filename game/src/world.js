// The simulation of Marisol Bay: the player on foot and in cars, traffic,
// pedestrians, police, wanted level, combat and the mission steps. Rendering
// reads this state; it never changes it.

import {
  CAR,
  ON_FOOT,
  PALETTE,
  PEDS,
  PLAYER,
  ROADS_X,
  ROADS_Y,
  ROAD_WIDTH,
  STEP,
  TRAFFIC,
  WANTED,
  WORLD,
} from './config.js';
import { buildCity, isOnRoad, nearestRoadPoint, PLACES } from './city.js';
import { makeRng, pickFrom, range, rangeInt } from './random.js';
import { COURIER_RUN, MISSIONS } from './missions.js';

let nextCarId = 1;
let nextPedId = 1;

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function turnToward(angle, target, maxTurn) {
  let diff = target - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return angle + clamp(diff, -maxTurn, maxTurn);
}

function circleHitsBuilding(buildings, x, y, radius) {
  for (const b of buildings) {
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    if (dist(x, y, cx, cy) < radius) return b;
  }
  return null;
}

function pushOutOfBuildings(buildings, entity, radius) {
  for (const b of buildings) {
    const cx = clamp(entity.x, b.x, b.x + b.w);
    const cy = clamp(entity.y, b.y, b.y + b.h);
    const d = dist(entity.x, entity.y, cx, cy);
    if (d < radius && d > 0.001) {
      const push = (radius - d) / d;
      entity.x += (entity.x - cx) * push;
      entity.y += (entity.y - cy) * push;
      return true;
    }
    if (d <= 0.001) {
      entity.y = b.y - radius - 1;
      return true;
    }
  }
  return false;
}

function makeTrafficCar(rng) {
  const vertical = rng() < 0.5;
  if (vertical) {
    const road = pickFrom(rng, ROADS_X);
    return {
      id: nextCarId,
      kind: 'traffic',
      x: road + (rng() < 0.5 ? -26 : 26),
      y: range(rng, 80, WORLD.sandY - 80),
      angle: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2,
      speed: TRAFFIC.speed + range(rng, -TRAFFIC.speedJitter, TRAFFIC.speedJitter),
      color: pickFrom(rng, PALETTE.trafficColours),
      occupied: true,
      disabled: false,
      health: 100,
      axis: 'v',
      road,
    };
  }
  const road = pickFrom(rng, ROADS_Y);
  return {
    id: nextCarId,
    kind: 'traffic',
    x: range(rng, 80, WORLD.width - 80),
    y: road + (rng() < 0.5 ? -26 : 26),
    angle: rng() < 0.5 ? 0 : Math.PI,
    speed: TRAFFIC.speed + range(rng, -TRAFFIC.speedJitter, TRAFFIC.speedJitter),
    color: pickFrom(rng, PALETTE.trafficColours),
    occupied: true,
    disabled: false,
    health: 100,
    axis: 'h',
    road,
  };
}

function makePed(rng) {
  const vertical = rng() < 0.5;
  let x;
  let y;
  let angle;
  if (vertical) {
    const road = pickFrom(rng, ROADS_X);
    x = road + (rng() < 0.5 ? -68 : 68);
    y = range(rng, 80, WORLD.sandY - 80);
    angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    const road = pickFrom(rng, ROADS_Y);
    x = range(rng, 80, WORLD.width - 80);
    y = road + (rng() < 0.5 ? -68 : 68);
    angle = rng() < 0.5 ? 0 : Math.PI;
  }
  return {
    id: nextPedId,
    x,
    y,
    angle,
    speed: PEDS.speed + range(rng, -15, 20),
    color: pickFrom(rng, PALETTE.pedColours),
    fleeing: false,
    wanderTimer: range(rng, 2, 6),
  };
}

function makeCometCar() {
  return {
    id: nextCarId,
    kind: 'comet',
    model: 'comet',
    x: PLACES.dealerLot.x + 40,
    y: PLACES.dealerLot.y + 10,
    angle: Math.PI / 2,
    speed: 0,
    color: '#ffd23f',
    occupied: false,
    disabled: false,
    health: 100,
    parked: true,
  };
}

function makePoliceCar(x, y) {
  return {
    id: nextCarId,
    kind: 'police',
    x,
    y,
    angle: 0,
    speed: 0,
    color: PALETTE.policeCar,
    occupied: true,
    disabled: false,
    health: 100,
    lostTimer: 0,
    ramCooldown: 0,
  };
}

export function createWorld(seed) {
  const rng = makeRng(seed);
  const city = buildCity(seed);
  const state = {
    seed,
    rng,
    city,
    time: 0,
    player: {
      x: PLACES.startCorner.x,
      y: PLACES.startCorner.y,
      angle: -Math.PI / 2,
      health: PLAYER.maxHealth,
      inCar: null,
      fireCooldown: 0,
      crashCooldown: 0,
      hurtCooldown: 0,
      bustTimer: 0,
    },
    cars: [],
    peds: [],
    bullets: [],
    particles: [],
    toasts: [],
    sfx: [],
    wanted: 0,
    wantedTimer: WANTED.decayDelaySeconds,
    cash: 0,
    missionIndex: 0,
    stepIndex: 0,
    mission: MISSIONS[0],
    courierCount: 0,
    storyDone: false,
    busted: false,
    camera: { x: PLACES.startCorner.x, y: PLACES.startCorner.y },
    saveNow: false,
  };

  for (const parked of city.parkedCars) {
    state.cars.push({
      id: nextCarId,
      kind: 'parked',
      x: parked.x,
      y: parked.y,
      angle: parked.angle,
      speed: 0,
      color: pickFrom(rng, PALETTE.trafficColours),
      occupied: false,
      disabled: false,
      health: 100,
      parked: true,
    });
  }
  state.cars.push(makeCometCar());
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    nextCarId += 1;
    state.cars.push(makeTrafficCar(rng));
  }
  for (let i = 0; i < PEDS.count; i += 1) {
    nextPedId += 1;
    state.peds.push(makePed(rng));
  }
  return state;
}

export function addToast(state, text, seconds = 4) {
  state.toasts.push({ text, ttl: seconds });
  if (state.toasts.length > 3) state.toasts.shift();
}

export function addWanted(state, amount) {
  const before = state.wanted;
  state.wanted = clamp(state.wanted + amount, 0, WANTED.max);
  if (state.wanted > before) {
    state.sfx.push('wantedUp');
    addToast(state, `WANTED LEVEL ${state.wanted} — the Marisol Bay PD is on you!`, 3);
  }
  state.wantedTimer = WANTED.decayDelaySeconds;
}

function spawnParticles(state, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const angle = state.rng() * Math.PI * 2;
    const velocity = range(state.rng, speed * 0.3, speed);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: range(state.rng, 0.3, 0.8),
      maxLife: 0.8,
      color,
      size: range(state.rng, 2, 5),
    });
  }
}

function nearestCar(state, x, y, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of state.cars) {
    if (car.disabled) continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

export function tryEnterCar(state) {
  const player = state.player;
  if (player.inCar) {
    // Step out: place the player beside the car and leave the car parked.
    const car = player.inCar;
    car.speed = 0;
    car.kind = car.model === 'comet' ? 'comet' : 'parked';
    car.occupied = false;
    car.parked = true;
    const side = car.angle + Math.PI / 2;
    player.x = car.x + Math.cos(side) * 34;
    player.y = car.y + Math.sin(side) * 34;
    pushOutOfBuildings(state.city.buildings, player, ON_FOOT.radius);
    player.inCar = null;
    state.sfx.push('click');
    return;
  }
  const car = nearestCar(state, player.x, player.y, 64);
  if (!car) {
    addToast(state, 'No car close enough — walk up to one and press E.', 2);
    return;
  }
  if (car.kind === 'traffic' && car.occupied) {
    // Carjacking: the driver bails out and runs, and the law notices.
    const driver = makePed(state.rng);
    driver.x = car.x + 30;
    driver.y = car.y + 30;
    driver.fleeing = true;
    state.peds.push(driver);
    car.occupied = false;
    addWanted(state, 1);
    addToast(state, 'CAR STOLEN! The driver ran — drive before the cops arrive.', 3);
    state.sfx.push('crash');
  }
  car.kind = 'player';
  car.occupied = true;
  car.parked = false;
  player.inCar = car;
  player.x = car.x;
  player.y = car.y;
  state.sfx.push('click');
  checkMissionStep(state, 'enteredCar', car);
}

function playerWorldPos(state) {
  const player = state.player;
  return player.inCar ? { x: player.inCar.x, y: player.inCar.y } : { x: player.x, y: player.y };
}

function currentStep(state) {
  if (!state.mission) return null;
  return state.mission.steps[state.stepIndex] || null;
}

function advanceStep(state) {
  const step = currentStep(state);
  if (step && step.onArrive) addToast(state, step.onArrive, 4);
  state.sfx.push('pickup');
  state.stepIndex += 1;
  if (state.stepIndex >= state.mission.steps.length) {
    completeMission(state);
  }
}

function completeMission(state) {
  const mission = state.mission;
  state.cash += mission.payout;
  addToast(state, `${mission.title} COMPLETE — +$${mission.payout}`, 5);
  state.sfx.push('missionDone');
  state.saveNow = true;
  if (state.missionIndex < MISSIONS.length) {
    state.missionIndex += 1;
  }
  if (state.missionIndex >= MISSIONS.length) {
    state.storyDone = true;
    startCourierRun(state);
  } else {
    state.mission = MISSIONS[state.missionIndex];
    state.stepIndex = 0;
    addToast(state, `New job: ${state.mission.title} — ${state.mission.briefing}`, 6);
  }
}

function startCourierRun(state) {
  const places = Object.values(PLACES).filter((p) => p !== PLACES.hospital);
  const pickup = pickFrom(state.rng, places);
  let drop = pickFrom(state.rng, places);
  let guard = 0;
  while (drop === pickup && guard < 10) {
    drop = pickFrom(state.rng, places);
    guard += 1;
  }
  state.courierCount += 1;
  state.mission = {
    id: `courier-${state.courierCount}`,
    title: `Courier Run #${state.courierCount}`,
    briefing: COURIER_RUN.briefing,
    payout: COURIER_RUN.payout,
    steps: [
      { kind: 'goto', place: pickup, text: `Pick up the parcel at ${pickup.name}`, radius: 70 },
      { kind: 'goto', place: drop, text: `Deliver the parcel to ${drop.name}`, radius: 70, onArrive: 'Delivered. Mara wires $150.' },
    ],
  };
  state.stepIndex = 0;
  addToast(state, `New job: Courier Run #${state.courierCount} — pick up at ${pickup.name}.`, 5);
}

function checkMissionStep(state, event, car) {
  const step = currentStep(state);
  if (!step) return;
  if (step.kind === 'steal' && event === 'enteredCar') {
    // kind is already 'player' by now, so the Comet is recognised by model.
    if (car && car.model === 'comet') {
      addWanted(state, 1);
      advanceStep(state);
    }
  }
}

function updateMission(state, dt) {
  const step = currentStep(state);
  if (!step) return;
  const pos = playerWorldPos(state);
  if (step.kind === 'goto' || step.kind === 'deliver') {
    if (step.kind === 'deliver' && step.needsCar) {
      const car = state.player.inCar;
      if (!car || car.model !== step.needsCar) return;
    }
    if (dist(pos.x, pos.y, step.place.x, step.place.y) < step.radius) {
      advanceStep(state);
    }
  } else if (step.kind === 'escape') {
    if (state.wanted === 0 && dist(pos.x, pos.y, step.place.x, step.place.y) < step.radius) {
      advanceStep(state);
    }
  }
  void dt;
}

function updatePlayerOnFoot(state, dt, input, mouseWorld) {
  const player = state.player;
  const speed = input.sprint() ? ON_FOOT.sprintSpeed : ON_FOOT.walkSpeed;
  const moveX = input.steer();
  const moveY = input.throttle() * -1;
  const length = Math.hypot(moveX, moveY);
  if (length > 0) {
    player.x += (moveX / length) * speed * dt;
    player.y += (moveY / length) * speed * dt;
    player.angle = Math.atan2(moveY, moveX);
  }
  player.x = clamp(player.x, 20, WORLD.width - 20);
  player.y = clamp(player.y, 20, WORLD.height - 20);
  pushOutOfBuildings(state.city.buildings, player, ON_FOOT.radius);
  if (mouseWorld) {
    player.angle = angleTo(player.x, player.y, mouseWorld.x, mouseWorld.y);
  }
  player.fireCooldown -= dt;
  player.crashCooldown -= dt;
  player.hurtCooldown -= dt;
}

function updatePlayerCar(state, dt, input) {
  const player = state.player;
  const car = player.inCar;
  if (!car) return;
  const throttle = input.throttle();
  const steer = input.steer();
  // Off-road (sand, grass, blocks) drags the car down; roads are fastest.
  const maxSpeed = isOnRoad(car.x, car.y) ? CAR.maxSpeed : CAR.maxSpeed * 0.55;
  if (throttle > 0) car.speed += CAR.accel * dt;
  else if (throttle < 0) car.speed -= (car.speed > 0 ? CAR.accel * 0.9 : CAR.reverseAccel) * dt;
  else car.speed *= Math.pow(0.4, dt);
  car.speed = clamp(car.speed, -CAR.maxReverse, maxSpeed);
  const speedFraction = Math.abs(car.speed) / CAR.maxSpeed;
  if (Math.abs(car.speed) > 12) {
    car.angle += steer * CAR.turnRate * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 140) * dt;
  }
  const prevX = car.x;
  const prevY = car.y;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 20, WORLD.width - 20);
  car.y = clamp(car.y, 20, WORLD.height - 20);
  if (circleHitsBuilding(state.city.buildings, car.x, car.y, CAR.radius)) {
    const impactSpeed = Math.abs(car.speed);
    const hardHit = impactSpeed > 300 && player.crashCooldown <= 0;
    car.x = prevX;
    car.y = prevY;
    car.speed *= -0.25;
    if (hardHit) {
      player.health -= Math.round((impactSpeed - 300) / 18);
      player.crashCooldown = 0.6;
      state.sfx.push('crash');
      spawnParticles(state, car.x, car.y, '#f5d76e', 10, 160);
      addToast(state, 'Crash! Watch the buildings.', 2);
    }
  }
  // Skid smoke when turning hard at speed.
  if (Math.abs(steer) > 0 && speedFraction > 0.55 && state.rng() < 0.35) {
    state.particles.push({
      x: car.x - Math.cos(car.angle) * 22,
      y: car.y - Math.sin(car.angle) * 22,
      vx: 0,
      vy: 0,
      life: 0.5,
      maxLife: 0.5,
      color: '#ffffff55',
      size: 5,
    });
  }
  // Hitting a pedestrian with the car.
  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    const ped = state.peds[i];
    if (dist(car.x, car.y, ped.x, ped.y) < CAR.radius + 10 && Math.abs(car.speed) > 120) {
      state.peds.splice(i, 1);
      spawnParticles(state, ped.x, ped.y, '#ff6b6b', 12, 200);
      addWanted(state, 1);
      state.sfx.push('crash');
    }
  }
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.fireCooldown -= dt;
  player.crashCooldown -= dt;
  player.hurtCooldown -= dt;
}

function updateTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.kind !== 'traffic' || car.disabled) continue;
    // Slow down for a car ahead on the same road and lane.
    let blocked = false;
    for (const other of state.cars) {
      if (other === car || other.kind !== 'traffic') continue;
      if (other.road !== car.road || other.axis !== car.axis) continue;
      const ahead = car.axis === 'v'
        ? (other.y - car.y) * (car.angle > 0 ? 1 : -1)
        : (other.x - car.x) * (car.angle === 0 ? 1 : -1);
      const lateral = car.axis === 'v' ? Math.abs(other.x - car.x) : Math.abs(other.y - car.y);
      if (ahead > 0 && ahead < 95 && lateral < 34) {
        blocked = true;
        break;
      }
    }
    const speed = blocked ? car.speed * 0.4 : car.speed;
    car.x += Math.cos(car.angle) * speed * dt;
    car.y += Math.sin(car.angle) * speed * dt;
    if (car.axis === 'v') {
      if (car.y < 40) car.y = WORLD.sandY - 60;
      if (car.y > WORLD.sandY - 40) car.y = 60;
    } else {
      if (car.x < 40) car.x = WORLD.width - 60;
      if (car.x > WORLD.width - 40) car.x = 60;
    }
  }
}

function updatePeds(state, dt) {
  const pos = playerWorldPos(state);
  const playerCar = state.player.inCar;
  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    const ped = state.peds[i];
    const dPlayer = dist(ped.x, ped.y, pos.x, pos.y);
    if (!ped.fleeing && playerCar && dPlayer < 110 && Math.abs(playerCar.speed) > 90) {
      ped.fleeing = true;
    }
    if (ped.fleeing) {
      const away = angleTo(pos.x, pos.y, ped.x, ped.y);
      ped.angle = away;
      ped.x += Math.cos(away) * ped.speed * 1.7 * dt;
      ped.y += Math.sin(away) * ped.speed * 1.7 * dt;
      if (dPlayer > 260) ped.fleeing = false;
    } else {
      ped.wanderTimer -= dt;
      if (ped.wanderTimer <= 0) {
        ped.wanderTimer = range(state.rng, 3, 8);
        if (state.rng() < 0.4) ped.angle += Math.PI;
        else if (state.rng() < 0.5) ped.angle += Math.PI / 2;
        else ped.angle -= Math.PI / 2;
      }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    ped.x = clamp(ped.x, 20, WORLD.width - 20);
    ped.y = clamp(ped.y, 20, WORLD.sandY - 20);
    pushOutOfBuildings(state.city.buildings, ped, 12);
    void i;
  }
  // Fresh pedestrians wander in slowly to keep the streets alive.
  if (state.rng() < 0.004 && state.peds.length < PEDS.count + 8) {
    nextPedId += 1;
    state.peds.push(makePed(state.rng));
  }
}

function policeSpawnPoint(state) {
  const pos = playerWorldPos(state);
  const angle = state.rng() * Math.PI * 2;
  const spawn = {
    x: clamp(pos.x + Math.cos(angle) * range(state.rng, 650, 900), 60, WORLD.width - 60),
    y: clamp(pos.y + Math.sin(angle) * range(state.rng, 650, 900), 60, WORLD.sandY - 60),
  };
  return nearestRoadPoint(spawn.x, spawn.y);
}

function updatePolice(state, dt) {
  const pos = playerWorldPos(state);
  const police = state.cars.filter((c) => c.kind === 'police');
  const wantedPolice = state.wanted * WANTED.policePerStar;
  if (state.wanted > 0 && police.length < wantedPolice) {
    const spawn = policeSpawnPoint(state);
    nextCarId += 1;
    const cruiser = makePoliceCar(spawn.x, spawn.y);
    cruiser.id = nextCarId;
    state.cars.push(cruiser);
  }
  let nearestPoliceDist = Infinity;
  for (const cruiser of police) {
    const d = dist(cruiser.x, cruiser.y, pos.x, pos.y);
    nearestPoliceDist = Math.min(nearestPoliceDist, d);
    if (cruiser.disabled) {
      if (state.rng() < 0.3) {
        state.particles.push({
          x: cruiser.x,
          y: cruiser.y - 10,
          vx: range(state.rng, -12, 12),
          vy: -30,
          life: 0.8,
          maxLife: 0.8,
          color: '#555555',
          size: 6,
        });
      }
      continue;
    }
    if (d > 800) {
      cruiser.lostTimer += dt;
      if (cruiser.lostTimer > 4) {
        cruiser.kind = 'gone';
        continue;
      }
    } else {
      cruiser.lostTimer = 0;
    }
    const targetAngle = angleTo(cruiser.x, cruiser.y, pos.x, pos.y);
    cruiser.angle = turnToward(cruiser.angle, targetAngle, 2.4 * dt);
    const targetSpeed = 360 + state.wanted * 18;
    cruiser.speed += (targetSpeed - cruiser.speed) * Math.min(1, dt * 1.2);
    const prevX = cruiser.x;
    const prevY = cruiser.y;
    cruiser.x += Math.cos(cruiser.angle) * cruiser.speed * dt;
    cruiser.y += Math.sin(cruiser.angle) * cruiser.speed * dt;
    if (circleHitsBuilding(state.city.buildings, cruiser.x, cruiser.y, CAR.radius)) {
      cruiser.x = prevX;
      cruiser.y = prevY;
      cruiser.speed *= 0.4;
      cruiser.angle += 0.6;
    }
    cruiser.ramCooldown -= dt;
    const playerCar = state.player.inCar;
    if (playerCar && d < CAR.radius * 2 + 6 && cruiser.ramCooldown <= 0) {
      cruiser.ramCooldown = WANTED.ramCooldownSeconds;
      state.player.health -= WANTED.ramDamage;
      playerCar.speed *= 0.55;
      state.sfx.push('crash');
      spawnParticles(state, cruiser.x, cruiser.y, '#f5d76e', 10, 180);
      addToast(state, 'Police ram! Your car is taking damage.', 2);
    }
    if (!playerCar && d < WANTED.bustRadius) {
      state.player.bustTimer += dt;
      if (state.player.bustTimer > 1.4) {
        state.busted = true;
      }
    }
  }
  state.cars = state.cars.filter((c) => c.kind !== 'gone');
  // Wanted decays once no cruiser is close.
  if (state.wanted > 0) {
    if (nearestPoliceDist > 500) {
      state.wantedTimer -= dt;
      if (state.wantedTimer <= 0) {
        state.wanted -= 1;
        state.wantedTimer = WANTED.decayDelaySeconds;
        addToast(state, state.wanted === 0 ? 'You lost them. The heat is off.' : `Heat dropping — wanted level ${state.wanted}.`, 3);
      }
    } else {
      state.wantedTimer = WANTED.decayDelaySeconds;
    }
  }
  if (!state.player.inCar && nearestPoliceDist > 200) {
    state.player.bustTimer = 0;
  }
}

function updateBullets(state, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    bullet.x += Math.cos(bullet.angle) * bullet.speed * dt;
    bullet.y += Math.sin(bullet.angle) * bullet.speed * dt;
    bullet.travelled += bullet.speed * dt;
    let dead = bullet.travelled > PLAYER.bulletRange;
    if (!dead && circleHitsBuilding(state.city.buildings, bullet.x, bullet.y, 2)) {
      spawnParticles(state, bullet.x, bullet.y, '#f5d76e', 4, 90);
      dead = true;
    }
    if (!dead) {
      for (let j = state.peds.length - 1; j >= 0; j -= 1) {
        const ped = state.peds[j];
        if (dist(bullet.x, bullet.y, ped.x, ped.y) < 16) {
          state.peds.splice(j, 1);
          spawnParticles(state, ped.x, ped.y, '#ff6b6b', 10, 160);
          addWanted(state, 1);
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of state.cars) {
        if (car.kind === 'player' || car.kind === 'parked' || car.kind === 'comet') continue;
        if (dist(bullet.x, bullet.y, car.x, car.y) < CAR.radius) {
          if (car.kind === 'police') {
            car.health -= PLAYER.bulletDamage;
            spawnParticles(state, bullet.x, bullet.y, '#f5d76e', 6, 120);
            if (car.health <= 0 && !car.disabled) {
              car.disabled = true;
              car.speed = 0;
              addToast(state, 'Cruiser disabled!', 2);
              spawnParticles(state, car.x, car.y, '#888888', 16, 120);
            }
          } else if (car.kind === 'traffic') {
            spawnParticles(state, bullet.x, bullet.y, '#f5d76e', 6, 120);
            addWanted(state, 1);
          }
          dead = true;
          break;
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
  if (state.particles.length > 400) {
    state.particles.splice(0, state.particles.length - 400);
  }
}

export function shootAt(state, targetX, targetY) {
  const player = state.player;
  if (player.inCar || player.fireCooldown > 0) return;
  player.fireCooldown = PLAYER.fireCooldownSeconds;
  const angle = angleTo(player.x, player.y, targetX, targetY);
  state.bullets.push({
    x: player.x + Math.cos(angle) * 20,
    y: player.y + Math.sin(angle) * 20,
    angle,
    speed: PLAYER.bulletSpeed,
    travelled: 0,
  });
  state.sfx.push('shoot');
  spawnParticles(state, player.x + Math.cos(angle) * 22, player.y + Math.sin(angle) * 22, '#ffe08a', 3, 60);
}

export function respawnAfterBust(state) {
  const player = state.player;
  const fine = Math.min(200, state.cash);
  state.cash -= fine;
  state.wanted = 0;
  state.wantedTimer = WANTED.decayDelaySeconds;
  player.health = PLAYER.maxHealth;
  player.bustTimer = 0;
  player.inCar = null;
  state.busted = false;
  player.x = PLACES.hospital.x;
  player.y = PLACES.hospital.y;
  state.cars = state.cars.filter((c) => c.kind !== 'police');
  for (const car of state.cars) {
    if (car.kind === 'player') {
      car.kind = 'parked';
      car.occupied = false;
      car.speed = 0;
    }
  }
  addToast(state, `BUSTED! The PD fined you $${fine}. You wake up at St. Coral Hospital.`, 5);
}

export function applySave(state, save) {
  state.cash = save.cash;
  state.missionIndex = Math.min(save.missionIndex, MISSIONS.length);
  state.stepIndex = save.stepIndex || 0;
  state.player.health = save.health || PLAYER.maxHealth;
  state.wanted = 0;
  if (state.missionIndex >= MISSIONS.length) {
    state.storyDone = true;
    startCourierRun(state);
  } else {
    state.mission = MISSIONS[state.missionIndex];
  }
  if (typeof save.x === 'number' && typeof save.y === 'number') {
    state.player.x = clamp(save.x, 20, WORLD.width - 20);
    state.player.y = clamp(save.y, 20, WORLD.height - 20);
  }
}

export function makeSave(state) {
  return {
    cash: state.cash,
    missionIndex: state.missionIndex,
    stepIndex: state.stepIndex,
    x: Math.round(state.player.x),
    y: Math.round(state.player.y),
    health: Math.round(state.player.health),
  };
}

export function updateWorld(state, dt, input, mouseWorld) {
  state.time += dt;
  const player = state.player;

  if (player.inCar) updatePlayerCar(state, dt, input);
  else updatePlayerOnFoot(state, dt, input, mouseWorld);

  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  updateBullets(state, dt);
  updateParticles(state, dt);
  updateMission(state, dt);

  // Slow health recovery when the heat is off.
  if (state.wanted === 0 && player.health < PLAYER.maxHealth && player.hurtCooldown <= 0) {
    player.health = Math.min(PLAYER.maxHealth, player.health + 3 * dt);
  }
  if (player.health <= 0) {
    state.busted = true;
  }

  for (let i = state.toasts.length - 1; i >= 0; i -= 1) {
    state.toasts[i].ttl -= dt;
    if (state.toasts[i].ttl <= 0) state.toasts.splice(i, 1);
  }

  // Camera follows the player.
  const pos = playerWorldPos(state);
  state.camera.x += (pos.x - state.camera.x) * Math.min(1, dt * 5);
  state.camera.y += (pos.y - state.camera.y) * Math.min(1, dt * 5);
}

export { STEP };
