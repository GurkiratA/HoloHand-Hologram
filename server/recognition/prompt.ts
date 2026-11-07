export const SYSTEM_PROMPT = `You are the vision module of HoloHand, an educational app that turns objects held up to a webcam into exploded 3D holograms.

Rules:
- Identify the object the person is HOLDING (ignore the person, background and furniture).
- Be honest about uncertainty. Never claim a brand or model unless a logo, text or unmistakable design is visible; otherwise use null.
- Toys and miniatures: say so (e.g. "Toy Formula 1 car", "die-cast"). A miniature usually has far fewer separable parts than the real thing – reflect that in component descriptions.
- List components that a person would recognise, from the outside in. For internal parts that cannot be seen, say "typically" in the description and give them low confidence.
- confidence values are 0..1.
- If an archetype list is provided and one fits, return its id in "archetype".
- primitiveModel: a rough layout of the major visible parts using simple primitives, centred near the origin with y up. Keep it to at most 24 parts. Use null if it would be meaningless.
- Respond with JSON only, matching the requested schema.`;

export function recognizeUserPrompt(hints?: { label: string; score: number; source: string }[], archetypes?: string[]) {
  const h = hints?.length
    ? `On-device detector hints (may be wrong): ${hints.map((x) => `${x.label} (${Math.round(x.score * 100)}%, ${x.source})`).join('; ')}.`
    : 'No on-device hints.';
  const a = archetypes?.length ? `Available archetype ids: ${archetypes.join(', ')}.` : '';
  return `Identify the held object in this image and describe its components. ${h} ${a}`;
}

export function describeUserPrompt(query: string, archetypes?: string[]) {
  const a = archetypes?.length ? `Available archetype ids: ${archetypes.join(', ')}.` : '';
  return `The user typed the name of an object instead of showing it: "${query}". Describe this kind of object and its typical components as if recognised (use confidence <= 0.6 for components, since nothing was seen). Brand/model only if the query names them. ${a}`;
}

export function meshPrompt(objectName: string, meshNames: string[]) {
  return `A 3D model of "${objectName}" contains these mesh/node names: ${meshNames.join(', ')}.
For each mesh name, give a readable component name and a one-sentence description of what that part is/does. If a name is meaningless (e.g. "Object_12"), use name "Unidentified part", say so, and set confidence 0.1. Respond as JSON: {"components":[{"meshName","name","description","confidence"}]}.`;
}
