/** "front_wing.001" -> "Front wing" */
export function prettifyName(raw: string): string {
  const s = raw
    .replace(/\.\d+$/, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return 'Part';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

const SYNONYMS: Record<string, string> = {
  tire: 'wheel', tires: 'wheel', tyre: 'wheel', tyres: 'wheel', wheels: 'wheel', rims: 'rim', screen: 'display', monitor: 'display',
  lcd: 'display', oled: 'display', cover: 'shell', housing: 'shell', casing: 'shell', case: 'shell', enclosure: 'shell',
  lenses: 'lens', buttons: 'button', keys: 'keycaps', key: 'keycaps', keycap: 'keycaps', wings: 'wing', spoiler: 'wing',
  pods: 'pod', sidepods: 'pod', sidepod: 'pod', chassis: 'chassis', monocoque: 'chassis', frame: 'frame', lid: 'lid',
  cap: 'cap', lobe: 'lobe', lobes: 'lobe', motor: 'engine', blades: 'blade', legs: 'leg', arms: 'arm', propellers: 'propeller',
  props: 'propeller', prop: 'propeller', rotor: 'propeller', rotors: 'propeller', cylinders: 'cylinder', pistons: 'piston',
  rods: 'rod', batteries: 'battery', cell: 'battery', board: 'board', pcb: 'board', motherboard: 'board', mainboard: 'board',
};

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'with', 'for', 'to', 'in', 'on', 'part', 'assembly', 'unit', 'left', 'right', 'front', 'rear', 'upper', 'lower']);

export function tokens(s: string, keepSides = false): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t && (keepSides ? !['the', 'a', 'an', 'of', 'and'].includes(t) : !STOP.has(t)))
    .map((t) => SYNONYMS[t] ?? (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t));
}

/** Token-set similarity in 0..1 (Dice coefficient with substring bonus). */
export function similarity(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  let score = (2 * inter) / (ta.size + tb.size);
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (score < 1 && (la.includes(lb) || lb.includes(la))) score = Math.max(score, 0.75);
  return score;
}

/** User-facing name for where a recognition came from – never names the cloud vendor. */
export function sourceLabel(provider: string | null | undefined): string {
  if (!provider || provider === 'local') return 'On-device';
  if (provider === 'manual') return 'Manual';
  return 'Cloud AI';
}
