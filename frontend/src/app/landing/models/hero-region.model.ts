/**
 * The hero's 6 language nodes projected into the Three.js scene
 * (`three/hero-scene.ts`), one per region. Position comes from
 * `INDIA_REGION_POSITIONS` (`three/india-outline-data.ts`) — this model
 * only adds the region's English name and a depth/scale hint for visual
 * hierarchy, so nodes read as staggered in 3D space rather than a flat
 * ring (the brief's own "use depth, scale, spacing to create hierarchy,
 * don't cluster everything at once").
 *
 * Deliberately does NOT carry an "Input X -> Output Hindi" translation
 * claim: VaaniSetu doesn't translate between arbitrary Indian languages,
 * it's a single-language conversational assistant. Each node instead
 * just names the region and points at a `DEMO_LANGUAGE_NODES` entry for
 * its label/greeting — the same "decorative, not real support" status
 * that model already documents. `languageCode` must match a
 * `DemoLanguageNode.code` and a key in `INDIA_REGION_POSITIONS`.
 */
export interface HeroRegionNode {
  readonly region: string;
  readonly languageCode: string;
  /** Z-offset applied on top of the outline's own plane, purely for
   * visual staggering — not real elevation data. */
  readonly depth: number;
}

export const HERO_REGION_NODES: readonly HeroRegionNode[] = [
  { region: 'Assam', languageCode: 'as', depth: 0.3 },
  { region: 'Punjab', languageCode: 'pa', depth: -0.35 },
  { region: 'West Bengal', languageCode: 'bn', depth: 0.15 },
  { region: 'Jammu & Kashmir', languageCode: 'ks', depth: 0.4 },
  { region: 'Tamil Nadu', languageCode: 'ta', depth: 0.25 },
  { region: 'Goa', languageCode: 'kok', depth: -0.15 },
];
