// Visuels décoratifs du parcours maquette (§10ter) — portés depuis l'artefact validé le
// 2026-07-29/30 (parcours_maquette_mockup.html) en composants React réutilisables.

export function WaxPattern({
  id,
  hue,
  size = 16,
}: {
  id: string;
  hue: number;
  size?: number;
}) {
  const resist = `oklch(0.95 0.03 ${hue + 25} / .6)`;
  return (
    <defs>
      <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse" patternTransform="rotate(14)">
        <rect width={size} height={size} fill={`oklch(0.52 0.15 ${hue})`} />
        <circle cx={size / 2} cy={size / 2} r={size * 0.3} fill="none" stroke={resist} strokeWidth="1" />
        <circle cx={size / 2} cy={size / 2} r={size * 0.1} fill={resist} />
        <circle cx="0" cy="0" r="1.2" fill={resist} />
        <circle cx={size} cy="0" r="1.2" fill={resist} />
        <circle cx="0" cy={size} r="1.2" fill={resist} />
        <circle cx={size} cy={size} r="1.2" fill={resist} />
      </pattern>
    </defs>
  );
}

const GOLD = "oklch(0.72 0.13 85)";

export function logoBadgeMarkup(cx: number, cy: number, hue: number, shape: string, size: number): string {
  const rx = 8.2 * size,
    ry = 6.2 * size,
    rx2 = 6 * size,
    ry2 = 4.3 * size;
  const outer =
    shape === "rect"
      ? `<rect x="${cx - rx}" y="${cy - ry}" width="${rx * 2}" height="${ry * 2}" rx="${2.5 * size}" fill="oklch(0.97 0.01 90)" stroke="oklch(0.3 0.05 ${hue})" stroke-width="1"/>`
      : `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="oklch(0.97 0.01 90)" stroke="oklch(0.3 0.05 ${hue})" stroke-width="1"/>`;
  const inner =
    shape === "rect"
      ? `<rect x="${cx - rx2}" y="${cy - ry2}" width="${rx2 * 2}" height="${ry2 * 2}" rx="${1.5 * size}" fill="none" stroke="${GOLD}" stroke-width="0.6"/>`
      : `<ellipse cx="${cx}" cy="${cy}" rx="${rx2}" ry="${ry2}" fill="none" stroke="${GOLD}" stroke-width="0.6"/>`;
  return `<g>${outer}${inner}<text x="${cx}" y="${cy + 2 * size}" font-size="${5.4 * size}" text-anchor="middle" font-family="ui-serif, Georgia, serif" font-weight="700" fill="oklch(0.32 0.06 ${hue})">E</text></g>`;
}

/** Bande tuilée (motif wax + médaillons) — reconstruit le SVG complet en une chaîne, comme
 * dans l'artefact (un seul <pattern>, tuilé une fois sur le rect plutôt que N badges React). */
export function tiledBandMarkup(opts: {
  positions: [number, number][];
  hue: number;
  repeat: number;
  fit: "slice" | "meet";
  orient: "h" | "v";
  badgeShape: string;
  badgeSize: number;
}): string {
  const { positions, hue, repeat, fit, orient, badgeShape, badgeSize } = opts;
  const w = 64,
    h = 110;
  const id = `tb_${hue}_${repeat}_${orient}`;
  const resist = `oklch(0.95 0.03 ${hue + 25} / .55)`;
  let rosettes = "";
  for (let ry = 8; ry < h; ry += 15) {
    for (let rx = 8; rx < w; rx += 15) {
      rosettes += `<circle cx="${rx}" cy="${ry}" r="4.4" fill="none" stroke="${resist}" stroke-width="1"/><circle cx="${rx}" cy="${ry}" r="1.4" fill="${resist}"/>`;
    }
  }
  const badges = positions.map(([x, y]) => logoBadgeMarkup((x / 100) * w, (y / 100) * h, hue, badgeShape, badgeSize)).join("");
  const vbW = orient === "v" ? w : w * repeat;
  const vbH = orient === "v" ? h * repeat : h;
  return `<svg viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid ${fit}" width="100%" height="100%">
    <defs><pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">
      <rect width="${w}" height="${h}" fill="oklch(0.5 0.15 ${hue})"/>${rosettes}${badges}
    </pattern></defs>
    <rect width="${vbW}" height="${vbH}" fill="url(#${id})"/>
  </svg>`;
}

/** Petite plaque de sélection — juste des points d'encre, sans texture. */
export function miniPlateMarkup(positions: [number, number][]): string {
  const dots = positions.map(([x, y]) => `<circle cx="${(x / 100) * 64}" cy="${(y / 100) * 110}" r="6.5" fill="#eee"/>`).join("");
  return `<svg viewBox="0 0 64 110" width="100%" height="100%">${dots}</svg>`;
}

export function BannerSvg({ hue }: { hue: number }) {
  const id = `bn${hue}`;
  return (
    <svg viewBox="0 0 400 110" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <WaxPattern id={id} hue={hue} />
      <rect width="400" height="110" fill={`url(#${id})`} />
    </svg>
  );
}

export function waxBlockMarkup(hue: number, seed: number): string {
  const id = `wx${seed}`;
  const resist = `oklch(0.95 0.03 ${hue + 25} / .6)`;
  return `<svg viewBox="0 0 100 130" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
    <defs><pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(14)">
      <rect width="16" height="16" fill="oklch(0.52 0.15 ${hue})"/>
      <circle cx="8" cy="8" r="4.8" fill="none" stroke="${resist}" stroke-width="1"/>
      <circle cx="8" cy="8" r="1.6" fill="${resist}"/>
    </pattern></defs>
    <rect width="100" height="130" fill="url(#${id})"/>
  </svg>`;
}
