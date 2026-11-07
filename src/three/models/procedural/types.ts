import type * as THREE from 'three';

export interface Archetype {
  id: string;
  name: string;
  category: string;
  subtitle: string;
  /** Labels / phrases (COCO, ImageNet or free text) that map to this archetype. */
  keywords: string[];
  build(): THREE.Group;
}
