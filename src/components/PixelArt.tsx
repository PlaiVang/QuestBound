import { SPRITES, type SpriteId } from '../art/sprites';

export function PixelArt({ name, size = 24, label }: { name: SpriteId; size?: number; label?: string }) {
  const sprite = SPRITES[name];
  return <svg className="pixel-art" width={size} height={size} viewBox="0 0 16 16"
    shapeRendering="crispEdges" role={label ? 'img' : undefined}
    aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
    {sprite.rows.flatMap((row, y) => [...row].flatMap((pixel, x) => pixel === '.' ? []
      : [<rect key={`${x}:${y}`} x={x} y={y} width="1" height="1" fill={sprite.colors[pixel]} />]))}
  </svg>;
}
