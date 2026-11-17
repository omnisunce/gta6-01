// The city of Marisol Bay: roads, buildings, the beach, the park and the
// named places missions point at. Everything is placed from the seeded RNG,
// so the same seed always builds the same city.

import { PALETTE, ROADS_X, ROADS_Y, ROAD_WIDTH, WORLD } from './config.js';
import { makeRng, pickFrom, range, rangeInt } from './random.js';

export const PLACES = {
  docksWarehouse: { name: 'Docks Warehouse', x: 320, y: 2060 },
  marinaCafe: { name: 'Marina Cafe', x: 3120, y: 2060 },
  dealerLot: { name: 'Solano Motors', x: 1120, y: 260 },
  chopShop: { name: "Duke's Garage", x: 2720, y: 1340 },
  safehouse: { name: 'Palms Motel', x: 720, y: 1700 },
  airportHangar: { name: 'Bay Air Hangar', x: 3120, y: 260 },
  hospital: { name: 'St. Coral Hospital', x: 1920, y: 620 },
  startCorner: { name: 'Coral & 5th', x: 1520, y: 980 },
};

const ROOFTOPS = [PALETTE.rooftopA, PALETTE.rooftopB, PALETTE.rooftopC, PALETTE.rooftopD, PALETTE.rooftopE];

function roadBand(value) {
  return { start: value - ROAD_WIDTH / 2, end: value + ROAD_WIDTH / 2 };
}

export function isOnRoad(x, y) {
  for (const rx of ROADS_X) {
    const band = roadBand(rx);
    if (x >= band.start && x <= band.end) return true;
  }
  for (const ry of ROADS_Y) {
    const band = roadBand(ry);
    if (y >= band.start && y <= band.end) return true;
  }
  return false;
}

export function nearestRoadPoint(x, y) {
  let bestX = ROADS_X[0];
  let bestDx = Math.abs(x - bestX);
  for (const rx of ROADS_X) {
    if (Math.abs(x - rx) < bestDx) {
      bestDx = Math.abs(x - rx);
      bestX = rx;
    }
  }
  let bestY = ROADS_Y[0];
  let bestDy = Math.abs(y - bestY);
  for (const ry of ROADS_Y) {
    if (Math.abs(y - ry) < bestDy) {
      bestDy = Math.abs(y - ry);
      bestY = ry;
    }
  }
  return bestDx <= bestDy ? { x: bestX, y } : { x, y: bestY };
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const palms = [];
  const parkedCars = [];

  // Park block: between 3rd and 4th vertical roads, 2nd and 3rd horizontal roads.
  const park = { x: 1160, y: 660, w: 320, h: 280 };

  const blockXs = [];
  const blockYs = [];
  // A block is the gap between two neighbouring roads: from one road's
  // right edge to the next road's left edge. Buildings stay inside blocks,
  // so no building ever sits on a road.
  let prevRight = 40;
  for (const rx of ROADS_X) {
    const left = rx - ROAD_WIDTH / 2;
    if (left - prevRight > 60) blockXs.push([prevRight, left]);
    prevRight = rx + ROAD_WIDTH / 2;
  }
  if (WORLD.width - 40 - prevRight > 60) blockXs.push([prevRight, WORLD.width - 40]);
  prevRight = 40;
  for (const ry of ROADS_Y) {
    const top = ry - ROAD_WIDTH / 2;
    if (top - prevRight > 60) blockYs.push([prevRight, top]);
    prevRight = ry + ROAD_WIDTH / 2;
  }
  if (WORLD.sandY - 20 - prevRight > 60) blockYs.push([prevRight, WORLD.sandY - 20]);

  const overlapsPark = (x, y, w, h) => x < park.x + park.w && x + w > park.x && y < park.y + park.h && y + h > park.y;
  const overlapsPlace = (x, y, w, h) => {
    for (const place of Object.values(PLACES)) {
      if (Math.abs(place.x - (x + w / 2)) < 130 && Math.abs(place.y - (y + h / 2)) < 130) return true;
    }
    return false;
  };

  for (const [bx0, bx1] of blockXs) {
    for (const [by0, by1] of blockYs) {
      if (by0 > WORLD.sandY - 40) continue; // beach blocks stay open sand
      const count = rangeInt(rng, 2, 4);
      for (let n = 0; n < count; n += 1) {
        const w = range(rng, 110, Math.min(220, bx1 - bx0 - 20));
        const h = range(rng, 90, Math.min(190, by1 - by0 - 20));
        const x = range(rng, bx0 + 8, bx1 - w - 8);
        const y = range(rng, by0 + 8, by1 - h - 8);
        if (overlapsPark(x, y, w, h) || overlapsPlace(x, y, w, h)) continue;
        let clash = false;
        for (const b of buildings) {
          if (x < b.x + b.w + 14 && x + w + 14 > b.x && y < b.y + b.h + 14 && y + h + 14 > b.y) {
            clash = true;
            break;
          }
        }
        if (clash) continue;
        buildings.push({ x, y, w, h, color: pickFrom(rng, ROOFTOPS), height: rangeInt(rng, 1, 3) });
      }
    }
  }

  // Palm trees along the beach front and around the park.
  for (let x = 120; x < WORLD.width - 80; x += 90) {
    palms.push({ x: x + range(rng, -20, 20), y: WORLD.sandY + range(rng, 30, 120) });
  }
  for (let i = 0; i < 10; i += 1) {
    palms.push({ x: range(rng, park.x + 20, park.x + park.w - 20), y: range(rng, park.y + 20, park.y + park.h - 20) });
  }

  // Parked cars along the roads, for the player to take.
  for (let i = 0; i < 14; i += 1) {
    const vertical = rng() < 0.5;
    if (vertical) {
      const road = pickFrom(rng, ROADS_X);
      const y = range(rng, 120, WORLD.sandY - 120);
      parkedCars.push({ x: road + (rng() < 0.5 ? -38 : 38), y, angle: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2, parked: true });
    } else {
      const road = pickFrom(rng, ROADS_Y);
      const x = range(rng, 120, WORLD.width - 120);
      parkedCars.push({ x, y: road + (rng() < 0.5 ? -38 : 38), angle: rng() < 0.5 ? 0 : Math.PI, parked: true });
    }
  }

  return { buildings, palms, parkedCars, park };
}
