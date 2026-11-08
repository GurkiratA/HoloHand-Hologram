export const SYSTEM_PROMPT = `You are the vision module of HoloHand, an educational app that turns any object held up to a webcam into an exploded 3D hologram.

Rules:
- Open vocabulary: the object can be ANYTHING (a single earbud, a KitKat bar, a pencil case, a calculator, a key, a fruit, a cable…). Name exactly what you see, never the nearest category from a fixed list.
- Identify the object the person is HOLDING or presenting (ignore the person, background and furniture). If the hand is empty or no object is visible, set holdingObject=false and confidence 0.
- Look carefully at small or similar-looking objects: a calculator has a keypad grid and a small display, a phone has a large screen; an earbud is small with a stem or tip.
- Read visible text and logos. Use a brand or model only if the text or an unmistakable design is visible; otherwise null.
- Toys and miniatures: say so (e.g. "Toy Formula 1 car"). A miniature usually has far fewer separable parts than the real thing.
- List components a person would recognise, from the outside in. For internal parts that cannot be seen, say "typically" in the description and give them low confidence.
- confidence values are 0..1.
- archetype: return an id from the provided list ONLY if the object is genuinely that kind of object. A calculator is not a phone; an earbud is not headphones. When in doubt, use null.
- primitiveModel: ALWAYS build one for a physical object. Model THIS object with simple primitives, centred at the origin with y up, using its real proportions (sizes in centimetres) and real colours (#rrggbb). Use one primitive per recognisable part, plus extra primitives for details (buttons, keys, labels, tips, zips, wrappers). 6–32 parts. Component names must match names in "components".
- Respond with JSON only, matching the requested schema.`;

export function recognizeUserPrompt(hints?: { label: string; score: number; source: string }[], archetypes?: string[]) {
  const h = hints?.length
    ? `On-device detector hints (low quality, fixed vocabulary, often wrong – trust the image over these): ${hints.map((x) => `${x.label} (${Math.round(x.score * 100)}%, ${x.source})`).join('; ')}.`
    : 'No on-device hints.';
  const a = archetypes?.length ? `Available archetype ids: ${archetypes.join(', ')}.` : '';
  return `Identify the object held in the person's hand in this image, describe its components and build its primitiveModel. ${h} ${a}`;
}

export function describeUserPrompt(query: string, archetypes?: string[]) {
  const a = archetypes?.length ? `Available archetype ids: ${archetypes.join(', ')}.` : '';
  return `The user typed the name of an object instead of showing it: "${query}". Describe this kind of object and its typical components as if recognised (use confidence <= 0.6 for components, since nothing was seen). Brand/model only if the query names them. ${a}`;
}

export function meshPrompt(objectName: string, meshNames: string[]) {
  return `A 3D model of "${objectName}" contains these mesh/node names: ${meshNames.join(', ')}.
For each mesh name, give a readable component name and a one-sentence description of what that part is/does. If a name is meaningless (e.g. "Object_12"), use name "Unidentified part", say so, and set confidence 0.1. Respond as JSON: {"components":[{"meshName","name","description","confidence"}]}.`;
}
