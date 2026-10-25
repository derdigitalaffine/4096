export const GRID_WIDTH = 16;
export const GRID_HEIGHT = 12;

export const positionKey = ({ x, y }) => `${x},${y}`;

const freezePosition = (position) => Object.freeze({ ...position });
const freezeList = (items = []) => Object.freeze(items.map((item) => Object.freeze({ ...item })));

function border(openings = []) {
  const open = new Set(openings.map(positionKey));
  const cells = [];
  for (let x = 0; x < GRID_WIDTH; x += 1) {
    for (const y of [0, GRID_HEIGHT - 1]) {
      if (!open.has(`${x},${y}`)) cells.push({ x, y });
    }
  }
  for (let y = 1; y < GRID_HEIGHT - 1; y += 1) {
    for (const x of [0, GRID_WIDTH - 1]) {
      if (!open.has(`${x},${y}`)) cells.push({ x, y });
    }
  }
  return cells;
}

function rect(x, y, width, height) {
  const cells = [];
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) cells.push({ x: x + dx, y: y + dy });
  }
  return cells;
}

function freezeZone(zone) {
  return Object.freeze({
    ...zone,
    start: freezePosition(zone.start),
    obstacles: freezeList(zone.obstacles),
    portals: freezeList(zone.portals),
    npcs: freezeList(zone.npcs),
    objects: freezeList(zone.objects),
    enemies: freezeList(zone.enemies),
    decor: freezeList(zone.decor),
  });
}

const villageOpenings = [{ x: 15, y: 6 }];
const meadowOpenings = [{ x: 0, y: 6 }, { x: 15, y: 6 }];
const shrineOpenings = [{ x: 0, y: 6 }];

export const ZONES = Object.freeze({
  village: freezeZone({
    id: 'village',
    name: 'Lindenquell',
    subtitle: 'Dorf am Morgenhang',
    palette: 'village',
    start: { x: 3, y: 7 },
    obstacles: [
      ...border(villageOpenings),
      ...rect(2, 1, 5, 2),
      ...rect(10, 1, 4, 2),
      ...rect(1, 9, 4, 2),
      ...rect(11, 9, 4, 2),
      { x: 8, y: 6 }, { x: 8, y: 7 },
    ],
    portals: [
      { id: 'village-east', x: 15, y: 6, toZone: 'meadow', toX: 1, toY: 6 },
    ],
    npcs: [
      { id: 'mira', name: 'Hüterin Mira', x: 5, y: 3, glyph: 'M' },
    ],
    objects: [
      { id: 'workshop-chest', kind: 'chest', x: 12, y: 3, glyph: '▣' },
      { id: 'well', kind: 'well', x: 8, y: 5, glyph: '○' },
    ],
    enemies: [],
    decor: [
      { x: 2, y: 5, kind: 'flower' }, { x: 3, y: 5, kind: 'flower' },
      { x: 11, y: 6, kind: 'flower' }, { x: 12, y: 7, kind: 'flower' },
      { x: 6, y: 9, kind: 'grass' }, { x: 9, y: 9, kind: 'grass' },
    ],
  }),
  meadow: freezeZone({
    id: 'meadow',
    name: 'Moosweg',
    subtitle: 'Pfad zum Tauhain',
    palette: 'meadow',
    start: { x: 1, y: 6 },
    obstacles: [
      ...border(meadowOpenings),
      { x: 4, y: 2 }, { x: 5, y: 2 }, { x: 4, y: 3 },
      { x: 7, y: 8 }, { x: 8, y: 8 }, { x: 9, y: 8 },
      { x: 11, y: 2 }, { x: 11, y: 3 },
      { x: 3, y: 9 }, { x: 12, y: 9 },
    ],
    portals: [
      { id: 'meadow-west', x: 0, y: 6, toZone: 'village', toX: 14, toY: 6 },
    ],
    npcs: [
      { id: 'karo', name: 'Pfadwächter Karo', x: 13, y: 3, glyph: 'K' },
    ],
    objects: [
      { id: 'shrine-gate', kind: 'gate', x: 15, y: 6, glyph: '║' },
      { id: 'trail-sign', kind: 'sign', x: 2, y: 3, glyph: '!' },
    ],
    enemies: [
      { id: 'leaf-a', kind: 'leafling', x: 5, y: 5, hp: 1, glyph: '◆' },
      { id: 'leaf-b', kind: 'leafling', x: 9, y: 4, hp: 1, glyph: '◆' },
      { id: 'leaf-c', kind: 'leafling', x: 11, y: 7, hp: 1, glyph: '◆' },
    ],
    decor: [
      { x: 2, y: 8, kind: 'grass' }, { x: 6, y: 3, kind: 'grass' },
      { x: 8, y: 5, kind: 'flower' }, { x: 13, y: 8, kind: 'grass' },
      { x: 6, y: 9, kind: 'flower' },
    ],
  }),
  shrine: freezeZone({
    id: 'shrine',
    name: 'Tauhain-Schrein',
    subtitle: 'Kammer des Morgenkerns',
    palette: 'shrine',
    start: { x: 1, y: 6 },
    obstacles: [
      ...border(shrineOpenings),
      { x: 5, y: 2 }, { x: 10, y: 2 },
      { x: 5, y: 5 }, { x: 10, y: 5 },
      { x: 5, y: 9 }, { x: 10, y: 9 },
      { x: 7, y: 4 }, { x: 9, y: 4 },
    ],
    portals: [
      { id: 'shrine-west', x: 0, y: 6, toZone: 'meadow', toX: 14, toY: 6 },
    ],
    npcs: [],
    objects: [
      { id: 'rune-left', kind: 'rune', x: 3, y: 3, glyph: '◇' },
      { id: 'rune-right', kind: 'rune', x: 12, y: 3, glyph: '◇' },
      { id: 'rune-south', kind: 'rune', x: 8, y: 9, glyph: '◇' },
      { id: 'morning-altar', kind: 'altar', x: 8, y: 1, glyph: '✦' },
    ],
    enemies: [
      { id: 'guardian', kind: 'guardian', x: 8, y: 6, hp: 3, glyph: '⬟' },
    ],
    decor: [
      { x: 2, y: 2, kind: 'rune-floor' }, { x: 13, y: 2, kind: 'rune-floor' },
      { x: 2, y: 9, kind: 'rune-floor' }, { x: 13, y: 9, kind: 'rune-floor' },
    ],
  }),
});

export function getZone(zoneId) {
  return ZONES[zoneId] ?? null;
}

export function inside(position) {
  return Number.isInteger(position?.x) && Number.isInteger(position?.y)
    && position.x >= 0 && position.y >= 0 && position.x < GRID_WIDTH && position.y < GRID_HEIGHT;
}

export function staticBlockSet(zoneId) {
  const zone = getZone(zoneId);
  return new Set(zone ? zone.obstacles.map(positionKey) : []);
}

export function validateWorld() {
  for (const zone of Object.values(ZONES)) {
    if (!inside(zone.start)) return false;
    const obstacleKeys = new Set(zone.obstacles.map(positionKey));
    if (obstacleKeys.size !== zone.obstacles.length) return false;
    if (obstacleKeys.has(positionKey(zone.start))) return false;
    const entityIds = [...zone.portals, ...zone.npcs, ...zone.objects, ...zone.enemies].map((item) => item.id);
    if (new Set(entityIds).size !== entityIds.length) return false;
    for (const entity of [...zone.portals, ...zone.npcs, ...zone.objects, ...zone.enemies]) {
      if (!inside(entity)) return false;
    }
    for (const portal of zone.portals) {
      const target = getZone(portal.toZone);
      if (!target || !inside({ x: portal.toX, y: portal.toY })) return false;
    }
  }
  return true;
}
