// The story of Sunset Keys: Rae Vega, a courier who owes money to the wrong
// people, takes jobs from fixer Mara Solano across Marisol Bay. Each mission
// is a list of steps; a step completes when the player reaches its place,
// steals its car, or loses the police, and the next step takes over.

import { PLACES } from './city.js';

export const STORY_INTRO =
  'Rae Vega owes the Coral Crew $5,000. Fixer Mara Solano has three jobs that pay it off — if the cops let her finish them.';

export const MISSIONS = [
  {
    id: 'pickup',
    title: 'Job 1 — The Pickup',
    briefing: 'Mara: "A package is waiting at the Docks Warehouse. Grab it, then drop it at the Marina Cafe. Keep it quiet."',
    payout: 300,
    steps: [
      {
        kind: 'goto',
        place: PLACES.docksWarehouse,
        text: 'Pick up the package at the Docks Warehouse',
        radius: 70,
        onArrive: 'Package secured. Now take it to the Marina Cafe — drive, don\'t walk.',
      },
      {
        kind: 'goto',
        place: PLACES.marinaCafe,
        text: 'Deliver the package to the Marina Cafe',
        radius: 70,
        onArrive: 'Delivered. Mara wires $300. One job down.',
      },
    ],
  },
  {
    id: 'hotwheels',
    title: 'Job 2 — Hot Wheels',
    briefing: 'Mara: "Solano Motors has a yellow Comet GT out back. Take it. Duke\'s Garage will pay $600 for it — and the cops will notice."',
    payout: 600,
    steps: [
      {
        kind: 'steal',
        place: PLACES.dealerLot,
        text: 'Steal the yellow Comet GT from Solano Motors (press E)',
        radius: 80,
        targetCar: 'comet',
        onArrive: 'That\'s the Comet. Get in and go — the lot guards already called it in.',
      },
      {
        kind: 'deliver',
        place: PLACES.chopShop,
        text: 'Deliver the Comet GT to Duke\'s Garage',
        radius: 80,
        needsCar: 'comet',
        onArrive: 'Duke pays $600, no questions asked. The heat is real now.',
      },
    ],
  },
  {
    id: 'getaway',
    title: 'Job 3 — The Getaway',
    briefing: 'Mara: "The crew wants you gone. Lose the cops, lay low at the Palms Motel, then fly the last package out of the Bay Air Hangar."',
    payout: 1200,
    steps: [
      {
        kind: 'escape',
        place: PLACES.safehouse,
        text: 'Lose the police, then lay low at the Palms Motel',
        radius: 110,
        onArrive: 'Quiet at last. Mara: "One last run. The hangar, east side."',
      },
      {
        kind: 'goto',
        place: PLACES.airportHangar,
        text: 'Deliver the last package to the Bay Air Hangar',
        radius: 80,
        onArrive: 'Package gone, debt paid. Marisol Bay is yours, Rae.',
      },
    ],
  },
];

export const COURIER_RUN = {
  id: 'courier',
  title: 'Courier Run',
  briefing: 'Mara has another parcel that needs wheels. Same deal: pick it up, drop it off, keep the cops off your back.',
  payout: 150,
};

export function missionObjective(mission, stepIndex) {
  if (!mission) return 'Free roam — press M for sound, P to pause.';
  const step = mission.steps[stepIndex];
  if (!step) return mission.title;
  return step.text;
}

export function missionPlace(mission, stepIndex) {
  if (!mission) return null;
  const step = mission.steps[stepIndex];
  return step ? step.place : null;
}
