// Sunset Keys — tuning numbers, colours and city layout in one place.
// The world is a fixed-size top-down city; the camera shows a window of it.

export const WORLD = {
  width: 3600,
  height: 2600,
  // South edge is the beach: sand starts here, water starts here.
  sandY: 2280,
  waterY: 2460,
};

// Roads run on a grid. Each road is a band; cars drive on them, buildings fill the blocks between.
export const ROADS_X = [320, 720, 1120, 1520, 1920, 2320, 2720, 3120];
export const ROADS_Y = [260, 620, 980, 1340, 1700, 2060];
export const ROAD_WIDTH = 110;
export const LANE_OFFSET = 26;

export const STEP = 1 / 60;

export const ON_FOOT = {
  radius: 13,
  walkSpeed: 175,
  sprintSpeed: 265,
};

export const CAR = {
  length: 52,
  width: 26,
  radius: 24,
  accel: 340,
  reverseAccel: 200,
  maxSpeed: 430,
  maxReverse: 150,
  turnRate: 2.9,
  grip: 0.94,
  offRoadGrip: 0.86,
};

export const TRAFFIC = {
  count: 26,
  speed: 130,
  speedJitter: 45,
};

export const PEDS = {
  count: 34,
  speed: 55,
};

export const WANTED = {
  max: 5,
  decayDelaySeconds: 14,
  policePerStar: 1,
  ramDamage: 9,
  ramCooldownSeconds: 0.9,
  bustRadius: 46,
};

export const PLAYER = {
  maxHealth: 100,
  fireCooldownSeconds: 0.22,
  bulletSpeed: 780,
  bulletDamage: 34,
  bulletRange: 520,
};

export const PALETTE = {
  // Sun-soaked coastal city: warm asphalt, pale sand, teal water.
  blockGround: '#c9a86a',
  sand: '#e8cf9a',
  water: '#2fa8a0',
  waterDeep: '#1f7f8c',
  road: '#4a4550',
  roadEdge: '#6b6575',
  laneMark: '#f5d76e',
  sidewalk: '#b9ac8f',
  parkGrass: '#7fae5a',
  parkPath: '#d9c48f',
  rooftopA: '#e07856',
  rooftopB: '#e8a34c',
  rooftopC: '#7fb3d5',
  rooftopD: '#c86b8a',
  rooftopE: '#8fae7a',
  buildingEdge: '#00000033',
  player: '#37d67a',
  playerCar: '#2fae5f',
  policeCar: '#2f6fd0',
  policeLightRed: '#ff3b30',
  policeLightBlue: '#3b82ff',
  trafficColours: ['#d94f3d', '#e8b23a', '#4f8fd9', '#e8e4da', '#7a5fd0', '#3fae8a', '#c0c8d0', '#8a6f4d'],
  pedColours: ['#f2c14e', '#ef8354', '#4ecdc4', '#ff6b9d', '#a78bfa', '#f8f4e8'],
  objective: '#ffd23f',
  objectiveRing: '#ffffff',
  text: '#f7f3e8',
  textDark: '#241f1a',
  panel: '#1d1a24cc',
  panelEdge: '#f5d76e',
  star: '#ffd23f',
  starEmpty: '#5a5566',
  health: '#4ade80',
  healthLow: '#ef4444',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const FONT_DISPLAY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export const SAVE_KEY = 'sunset-keys.save.v1';
export const GAME_TITLE = 'SUNSET KEYS';
export const CITY_NAME = 'Marisol Bay';
