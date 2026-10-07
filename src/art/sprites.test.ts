import { describe, expect, it } from 'vitest';
import { SPRITES } from './sprites';
import { BOSSES } from '../game/world';
import { CLASS_IDS } from '../game/classes';

describe('starter pixel pack', () => {
  it('has complete 16x16 grids and defined colors for every pixel', () => {
    for (const sprite of Object.values(SPRITES)) {
      expect(sprite.rows).toHaveLength(16);
      for (const row of sprite.rows) {
        expect(row).toHaveLength(16);
        for (const pixel of row) if (pixel !== '.') expect(sprite.colors[pixel]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
  it('covers every existing class and boss', () => {
    for (const id of [...CLASS_IDS, ...BOSSES.map(b => b.id)]) expect(SPRITES).toHaveProperty(id);
  });
});
