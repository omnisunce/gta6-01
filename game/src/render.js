// Drawing only: the world's state and the current screen in, pixels out.
// A camera follows the player across the city; the HUD, the minimap and the
// menus are drawn on top. Flat shapes and canvas text, no images.

import {
  CAR,
  CITY_NAME,
  FONT,
  FONT_DISPLAY,
  GAME_TITLE,
  ON_FOOT,
  PALETTE,
  ROADS_X,
  ROADS_Y,
  ROAD_WIDTH,
  WORLD,
} from './config.js';
import { PLACES } from './city.js';
import { missionObjective, missionPlace, STORY_INTRO } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';

const MINIMAP = { width: 230, height: 168, margin: 14 };

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function wrapText(context, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (context.measureText(trial).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  let viewWidth = 1280;
  let viewHeight = 800;

  function resize() {
    viewWidth = window.innerWidth;
    viewHeight = window.innerHeight;
    canvas.width = viewWidth;
    canvas.height = viewHeight;
  }

  const fonts = new Map();
  function font(size, display = false) {
    const key = `${size}:${display ? 'd' : 'b'}`;
    if (!fonts.has(key)) fonts.set(key, `bold ${size}px ${display ? FONT_DISPLAY : FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align = 'left', display = false) {
    context.font = font(size, display);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + w, y, x + w, y + h, radius);
    context.arcTo(x + w, y + h, x, y + h, radius);
    context.arcTo(x, y + h, x, y, radius);
    context.arcTo(x, y, x + w, y, radius);
    context.closePath();
  }

  function drawCarShape(car, isPlayerCar) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const length = CAR.length;
    const width = CAR.width;
    // Shadow.
    context.fillStyle = '#00000044';
    roundRect(-length / 2 + 3, -width / 2 + 4, length, width, 8);
    context.fill();
    // Body.
    context.fillStyle = car.disabled ? '#777777' : car.color;
    roundRect(-length / 2, -width / 2, length, width, 8);
    context.fill();
    // Roof and windshield.
    context.fillStyle = '#1d2733';
    roundRect(-length / 2 + 12, -width / 2 + 5, 12, width - 10, 3);
    context.fill();
    context.fillStyle = '#2c3e50';
    roundRect(-4, -width / 2 + 4, 14, width - 8, 3);
    context.fill();
    // Headlights.
    context.fillStyle = '#ffe9a3';
    context.fillRect(length / 2 - 3, -width / 2 + 2, 3, 5);
    context.fillRect(length / 2 - 3, width / 2 - 7, 3, 5);
    if (isPlayerCar) {
      context.strokeStyle = '#ffffff';
      context.lineWidth = 2;
      roundRect(-length / 2 - 2, -width / 2 - 2, length + 4, width + 4, 9);
      context.stroke();
    }
    if (car.kind === 'police') {
      const flashing = Math.floor(Date.now() / 260) % 2 === 0;
      context.fillStyle = flashing ? PALETTE.policeLightRed : PALETTE.policeLightBlue;
      context.beginPath();
      context.arc(-2, -width / 2 + 2, 5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = flashing ? PALETTE.policeLightBlue : PALETTE.policeLightRed;
      context.beginPath();
      context.arc(-2, width / 2 - 2, 5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff';
      context.font = font(9);
      context.textAlign = 'center';
      context.fillText('PD', 0, 3);
    }
    if (car.kind === 'comet') {
      context.fillStyle = '#241f1a';
      context.font = font(9);
      context.textAlign = 'center';
      context.fillText('GT', 8, 3);
    }
    context.restore();
  }

  function drawCity(state) {
    const city = state.city;
    const time = state.time;
    // Ground: city blocks.
    context.fillStyle = PALETTE.blockGround;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    // Beach sand and water.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, WORLD.sandY, WORLD.width, WORLD.height - WORLD.sandY);
    context.fillStyle = PALETTE.water;
    context.fillRect(0, WORLD.waterY, WORLD.width, WORLD.height - WORLD.waterY);
    context.strokeStyle = PALETTE.waterDeep;
    context.lineWidth = 3;
    for (let x = 0; x < WORLD.width; x += 140) {
      const wave = Math.sin((x + time * 40) / 90) * 6;
      context.beginPath();
      context.moveTo(x, WORLD.waterY + 14 + wave);
      context.lineTo(x + 70, WORLD.waterY + 14 - wave);
      context.stroke();
    }
    // Park.
    context.fillStyle = PALETTE.parkGrass;
    context.fillRect(city.park.x, city.park.y, city.park.w, city.park.h);
    context.fillStyle = PALETTE.parkPath;
    context.fillRect(city.park.x + city.park.w / 2 - 12, city.park.y, 24, city.park.h);
    context.fillRect(city.park.x, city.park.y + city.park.h / 2 - 12, city.park.w, 24);
    // Roads: sidewalk edge, asphalt, dashed centre line.
    for (const rx of ROADS_X) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(rx - ROAD_WIDTH / 2 - 14, 0, ROAD_WIDTH + 28, WORLD.sandY);
      context.fillStyle = PALETTE.road;
      context.fillRect(rx - ROAD_WIDTH / 2, 0, ROAD_WIDTH, WORLD.sandY);
    }
    for (const ry of ROADS_Y) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(0, ry - ROAD_WIDTH / 2 - 14, WORLD.width, ROAD_WIDTH + 28);
      context.fillStyle = PALETTE.road;
      context.fillRect(0, ry - ROAD_WIDTH / 2, WORLD.width, ROAD_WIDTH);
    }
    context.strokeStyle = PALETTE.laneMark;
    context.lineWidth = 3;
    context.setLineDash([26, 22]);
    for (const rx of ROADS_X) {
      context.beginPath();
      context.moveTo(rx, 0);
      context.lineTo(rx, WORLD.sandY);
      context.stroke();
    }
    for (const ry of ROADS_Y) {
      context.beginPath();
      context.moveTo(0, ry);
      context.lineTo(WORLD.width, ry);
      context.stroke();
    }
    context.setLineDash([]);
    // Buildings.
    for (const b of city.buildings) {
      context.fillStyle = '#00000055';
      context.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.strokeStyle = PALETTE.buildingEdge;
      context.lineWidth = 2;
      context.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      context.fillStyle = '#ffffff33';
      context.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
      context.fillStyle = '#00000022';
      context.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.25, 18, 12);
      context.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.6, 18, 12);
    }
    // Named places: a small signpost with the place's first letter.
    for (const place of Object.values(PLACES)) {
      context.fillStyle = '#241f1a';
      context.beginPath();
      context.arc(place.x, place.y, 13, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.objective;
      context.beginPath();
      context.arc(place.x, place.y, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#241f1a';
      context.font = font(11);
      context.textAlign = 'center';
      context.fillText(place.name.charAt(0), place.x, place.y + 4);
    }
    // Palm trees.
    for (const palm of city.palms) {
      context.strokeStyle = '#8a6f4d';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(palm.x, palm.y);
      context.lineTo(palm.x + 3, palm.y - 14);
      context.stroke();
      context.fillStyle = '#3f8f4f';
      context.beginPath();
      context.arc(palm.x + 3, palm.y - 18, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#57ab63';
      context.beginPath();
      context.arc(palm.x - 3, palm.y - 22, 7, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawObjectiveBeacon(state) {
    const place = missionPlace(state.mission, state.stepIndex);
    if (!place) return;
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    const radius = 26 * pulse;
    context.save();
    context.translate(place.x, place.y);
    context.strokeStyle = PALETTE.objective;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.objective;
    context.beginPath();
    context.moveTo(0, -radius - 12);
    context.lineTo(10, -radius + 4);
    context.lineTo(-10, -radius + 4);
    context.closePath();
    context.fill();
    context.restore();
    // A light beam so the marker reads from far away.
    context.fillStyle = '#ffd23f22';
    context.fillRect(place.x - 6, place.y - 320, 12, 320);
  }

  function drawWorld(state) {
    const camera = state.camera;
    const viewX = clamp(camera.x - viewWidth / 2, 0, Math.max(0, WORLD.width - viewWidth));
    const viewY = clamp(camera.y - viewHeight / 2, 0, Math.max(0, WORLD.height - viewHeight));
    context.save();
    context.translate(-viewX, -viewY);
    drawCity(state);
    drawObjectiveBeacon(state);
    // Pedestrians.
    for (const ped of state.peds) {
      context.fillStyle = '#00000044';
      context.beginPath();
      context.ellipse(ped.x + 2, ped.y + 3, 10, 7, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = ped.color;
      context.beginPath();
      context.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#f2c9a0';
      context.beginPath();
      context.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 4, 0, Math.PI * 2);
      context.fill();
    }
    // Cars, player car last so it sits on top.
    for (const car of state.cars) {
      if (car.kind === 'player') continue;
      drawCarShape(car, false);
    }
    const playerCar = state.player.inCar;
    if (playerCar) drawCarShape(playerCar, true);
    // Bullets.
    for (const bullet of state.bullets) {
      context.fillStyle = '#ffe08a';
      context.beginPath();
      context.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#ff9d00';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(bullet.x - Math.cos(bullet.angle) * 12, bullet.y - Math.sin(bullet.angle) * 12);
      context.lineTo(bullet.x, bullet.y);
      context.stroke();
    }
    // Particles.
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // The player on foot.
    if (!playerCar) {
      const player = state.player;
      context.fillStyle = '#00000044';
      context.beginPath();
      context.ellipse(player.x + 2, player.y + 3, 12, 8, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(player.x, player.y, ON_FOOT.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#14532d';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(player.x, player.y);
      context.lineTo(player.x + Math.cos(player.angle) * 20, player.y + Math.sin(player.angle) * 20);
      context.stroke();
      context.fillStyle = '#f2c9a0';
      context.beginPath();
      context.arc(player.x, player.y, 5, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    return { viewX, viewY };
  }

  function drawMinimap(state, view) {
    const scaleX = MINIMAP.width / WORLD.width;
    const scaleY = MINIMAP.height / WORLD.height;
    const x0 = viewWidth - MINIMAP.width - MINIMAP.margin;
    const y0 = viewHeight - MINIMAP.height - MINIMAP.margin;
    context.fillStyle = PALETTE.panel;
    roundRect(x0 - 6, y0 - 6, MINIMAP.width + 12, MINIMAP.height + 12, 8);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    roundRect(x0 - 6, y0 - 6, MINIMAP.width + 12, MINIMAP.height + 12, 8);
    context.stroke();
    context.save();
    context.beginPath();
    context.rect(x0, y0, MINIMAP.width, MINIMAP.height);
    context.clip();
    context.fillStyle = '#8a7a52';
    context.fillRect(x0, y0, MINIMAP.width, MINIMAP.height);
    context.fillStyle = PALETTE.water;
    context.fillRect(x0, y0 + WORLD.sandY * scaleY, MINIMAP.width, MINIMAP.height - WORLD.sandY * scaleY);
    context.strokeStyle = '#3a3542';
    context.lineWidth = 2;
    for (const rx of ROADS_X) {
      context.beginPath();
      context.moveTo(x0 + rx * scaleX, y0);
      context.lineTo(x0 + rx * scaleX, y0 + WORLD.sandY * scaleY);
      context.stroke();
    }
    for (const ry of ROADS_Y) {
      context.beginPath();
      context.moveTo(x0, y0 + ry * scaleY);
      context.lineTo(x0 + MINIMAP.width, y0 + ry * scaleY);
      context.stroke();
    }
    // Viewport rectangle.
    context.strokeStyle = '#ffffff88';
    context.lineWidth = 1;
    context.strokeRect(x0 + view.viewX * scaleX, y0 + view.viewY * scaleY, viewWidth * scaleX, viewHeight * scaleY);
    // Objective.
    const place = missionPlace(state.mission, state.stepIndex);
    if (place) {
      const pulse = 3 + Math.sin(state.time * 5) * 1.5;
      context.fillStyle = PALETTE.objective;
      context.beginPath();
      context.arc(x0 + place.x * scaleX, y0 + place.y * scaleY, pulse + 2, 0, Math.PI * 2);
      context.fill();
    }
    // Police as flashing red dots, other cars as white dots.
    for (const car of state.cars) {
      if (car.kind === 'player' || car.kind === 'parked' || car.kind === 'comet') continue;
      context.fillStyle = car.kind === 'police' ? (Math.floor(state.time * 3) % 2 === 0 ? '#ff3b30' : '#3b82ff') : '#ffffff';
      context.beginPath();
      context.arc(x0 + car.x * scaleX, y0 + car.y * scaleY, 2.5, 0, Math.PI * 2);
      context.fill();
    }
    // Player arrow.
    const player = state.player;
    context.save();
    context.translate(x0 + player.x * scaleX, y0 + player.y * scaleY);
    context.rotate(player.angle);
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.moveTo(7, 0);
    context.lineTo(-5, -5);
    context.lineTo(-5, 5);
    context.closePath();
    context.fill();
    context.restore();
    context.restore();
    text('MAP — MARISOL BAY', x0, y0 - 10, 11, PALETTE.text, 'left');
  }

  function drawHud(state, view) {
    // Top-left: cash and health.
    context.fillStyle = PALETTE.panel;
    roundRect(12, 12, 250, 64, 10);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1.5;
    roundRect(12, 12, 250, 64, 10);
    context.stroke();
    text(`$${state.cash}`, 26, 42, 26, PALETTE.text, 'left', true);
    const healthFraction = Math.max(0, state.player.health / 100);
    context.fillStyle = '#3a3542';
    roundRect(26, 52, 150, 12, 6);
    context.fill();
    context.fillStyle = healthFraction > 0.35 ? PALETTE.health : PALETTE.healthLow;
    roundRect(26, 52, 150 * healthFraction, 12, 6);
    context.fill();
    text('HEALTH', 184, 63, 11, PALETTE.text, 'left');
    // Top-right: wanted stars.
    context.fillStyle = PALETTE.panel;
    roundRect(viewWidth - 212, 12, 200, 64, 10);
    context.fill();
    context.strokeStyle = state.wanted > 0 ? '#ff3b30' : PALETTE.panelEdge;
    context.lineWidth = 1.5;
    roundRect(viewWidth - 212, 12, 200, 64, 10);
    context.stroke();
    text(state.wanted > 0 ? 'WANTED' : 'CLEAN', viewWidth - 198, 34, 13, state.wanted > 0 ? '#ff6b6b' : PALETTE.text, 'left');
    for (let i = 0; i < 5; i += 1) {
      text('★', viewWidth - 198 + i * 34, 66, 26, i < state.wanted ? PALETTE.star : PALETTE.starEmpty, 'left');
    }
    // Top-centre: mission.
    const objective = missionObjective(state.mission, state.stepIndex);
    const title = state.mission ? state.mission.title : 'Free Roam';
    context.font = font(15);
    const objectiveWidth = Math.max(context.measureText(objective).width, context.measureText(title).width) + 36;
    const panelX = (viewWidth - objectiveWidth) / 2;
    context.fillStyle = PALETTE.panel;
    roundRect(panelX, 12, objectiveWidth, 62, 10);
    context.fill();
    context.strokeStyle = PALETTE.objective;
    context.lineWidth = 1.5;
    roundRect(panelX, 12, objectiveWidth, 62, 10);
    context.stroke();
    text(title, viewWidth / 2, 34, 14, PALETTE.objective, 'center', true);
    text(objective, viewWidth / 2, 58, 14, PALETTE.text, 'center');
    // Bottom-left: speed and hints.
    if (state.player.inCar) {
      const speedKmh = Math.round(Math.abs(state.player.inCar.speed) * 0.55);
      text(`${speedKmh} km/h`, 18, viewHeight - 52, 26, PALETTE.text, 'left', true);
      text('WASD drive · E get out · P pause · M mute', 18, viewHeight - 24, 13, PALETTE.text, 'left');
    } else {
      text('WASD walk · Shift run · E enter car · Click to shoot · P pause · M mute', 18, viewHeight - 24, 13, PALETTE.text, 'left');
      // "Press E" prompt when a car is close.
      let nearCar = null;
      let nearDist = 64;
      for (const car of state.cars) {
        if (car.disabled) continue;
        const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
        if (d < nearDist) {
          nearDist = d;
          nearCar = car;
        }
      }
      if (nearCar) {
        const label = nearCar.kind === 'comet' ? 'Press E — steal the Comet GT' : nearCar.kind === 'traffic' ? 'Press E — take this car' : 'Press E — get in';
        context.fillStyle = PALETTE.panel;
        const w = 320;
        roundRect((viewWidth - w) / 2, viewHeight - 120, w, 34, 8);
        context.fill();
        text(label, viewWidth / 2, viewHeight - 97, 15, PALETTE.objective, 'center', true);
      }
    }
    // Off-screen objective arrow.
    const place = missionPlace(state.mission, state.stepIndex);
    if (place) {
      const px = place.x - view.viewX;
      const py = place.y - view.viewY;
      if (px < 0 || px > viewWidth || py < 0 || py > viewHeight) {
        const cx = viewWidth / 2;
        const cy = viewHeight / 2;
        const angle = Math.atan2(py - cy, px - cx);
        const ax = cx + Math.cos(angle) * Math.min(viewWidth, viewHeight) * 0.32;
        const ay = cy + Math.sin(angle) * Math.min(viewWidth, viewHeight) * 0.32;
        context.save();
        context.translate(ax, ay);
        context.rotate(angle);
        context.fillStyle = PALETTE.objective;
        context.beginPath();
        context.moveTo(18, 0);
        context.lineTo(-10, -12);
        context.lineTo(-10, 12);
        context.closePath();
        context.fill();
        context.restore();
        const distanceM = Math.round(Math.hypot(place.x - state.player.x, place.y - state.player.y) / 10);
        text(`${distanceM}m`, ax, ay - 22, 13, PALETTE.objective, 'center', true);
      }
    }
    // Toasts.
    let toastY = viewHeight - 170;
    for (const toast of state.toasts) {
      context.font = font(15);
      const width = context.measureText(toast.text).width + 28;
      context.fillStyle = PALETTE.panel;
      roundRect((viewWidth - width) / 2, toastY, width, 32, 8);
      context.fill();
      text(toast.text, viewWidth / 2, toastY + 22, 15, PALETTE.text, 'center');
      toastY -= 40;
    }
    // Low-health vignette.
    if (state.player.health < 35) {
      const pulse = 0.25 + Math.sin(state.time * 5) * 0.12;
      context.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
      context.lineWidth = 18;
      context.strokeRect(0, 0, viewWidth, viewHeight);
    }
    drawMinimap(state, view);
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 30 + 70;
    const x = (viewWidth - width) / 2;
    const y = (viewHeight - height) / 2;
    context.fillStyle = '#141118ee';
    roundRect(x, y, width, height, 14);
    context.fill();
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 2;
    roundRect(x, y, width, height, 14);
    context.stroke();
    text(title, viewWidth / 2, y + 64, 40, PALETTE.text, 'center', true);
    lines.forEach((line, i) => {
      text(line, viewWidth / 2, y + 108 + i * 30, 17, '#cfc9bd', 'center');
    });
    if (prompt) text(prompt, viewWidth / 2, y + height - 28, 17, PALETTE.objective, 'center', true);
  }

  function titleMenu(hasSave) {
    const width = 300;
    const x = (viewWidth - width) / 2;
    const y = viewHeight / 2 + 96;
    return {
      newGame: { x, y, w: width, h: 52 },
      continueGame: hasSave ? { x, y: y + 64, w: width, h: 52 } : null,
    };
  }

  function drawTitle(state, hasSave) {
    const view = drawWorld(state);
    context.fillStyle = '#1d143066';
    context.fillRect(0, 0, viewWidth, viewHeight);
    // Sun.
    context.fillStyle = '#ffb347';
    context.beginPath();
    context.arc(viewWidth - 190, 130, 64, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ffd23f';
    context.beginPath();
    context.arc(viewWidth - 190, 130, 48, 0, Math.PI * 2);
    context.fill();
    text(GAME_TITLE, viewWidth / 2, viewHeight / 2 - 150, 84, '#ffd23f', 'center', true);
    text(CITY_NAME, viewWidth / 2, viewHeight / 2 - 104, 30, PALETTE.text, 'center', true);
    context.font = font(17);
    const introLines = wrapText(context, STORY_INTRO, 640);
    introLines.forEach((line, i) => {
      text(line, viewWidth / 2, viewHeight / 2 - 56 + i * 26, 17, '#f7f3e8', 'center');
    });
    const menu = titleMenu(hasSave);
    context.fillStyle = PALETTE.objective;
    roundRect(menu.newGame.x, menu.newGame.y, menu.newGame.w, menu.newGame.h, 10);
    context.fill();
    text('1 · NEW GAME', viewWidth / 2, menu.newGame.y + 35, 20, '#241f1a', 'center', true);
    if (menu.continueGame) {
      context.fillStyle = '#f7f3e8';
      roundRect(menu.continueGame.x, menu.continueGame.y, menu.continueGame.w, menu.continueGame.h, 10);
      context.fill();
      text('2 · CONTINUE', viewWidth / 2, menu.continueGame.y + 35, 20, '#241f1a', 'center', true);
    }
    text('WASD move / drive · E enter car · Click to shoot · P pause · M mute', viewWidth / 2, viewHeight - 56, 15, '#cfc9bd', 'center');
    text('An original game. No real city, no real gang, no borrowed anything.', viewWidth / 2, viewHeight - 28, 13, '#9a94a8', 'center');
    return view;
  }

  function drawPaused(state) {
    const view = drawWorld(state);
    context.fillStyle = '#14111899';
    context.fillRect(0, 0, viewWidth, viewHeight);
    drawPanel('PAUSED', [
      'The city waits for you.',
      'P or Esc — resume',
      'S — save and quit to the title screen',
      'M — sound on / off',
    ], 'WASD move · E enter car · Click to shoot', PALETTE.panelEdge);
    return view;
  }

  function drawBusted(state) {
    const view = drawWorld(state);
    context.fillStyle = '#2a0d0dcc';
    context.fillRect(0, 0, viewWidth, viewHeight);
    drawPanel('BUSTED!', [
      'The Marisol Bay PD caught up with Rae.',
      'Fine: $200 (or everything, if that is less).',
      'You wake up at St. Coral Hospital.',
    ], 'Press Enter to wake up', '#ff3b30');
    return view;
  }

  function draw(state, screen, hasSave) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#141118';
    context.fillRect(0, 0, viewWidth, viewHeight);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, hasSave);
      return;
    }
    if (screen === SCREEN_PAUSED) {
      drawPaused(state);
      return;
    }
    if (screen === SCREEN_BUSTED) {
      drawBusted(state);
      return;
    }
    const view = drawWorld(state);
    drawHud(state, view);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, titleMenu, viewSize: () => ({ width: viewWidth, height: viewHeight }) };
}
