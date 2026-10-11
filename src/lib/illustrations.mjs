// Hand-built SVG illustrations (isometric plates, glowing nodes, flowing connectors).
// Colours come from CSS variables (--ill-*) in global.css, so every scene follows the light/dark theme.
// Each function takes a unique id prefix so several illustrations can live on one page.

export const illustrationNames = /** @type {const} */ (['math', 'network', 'orbit', 'stream', 'layers']);

const ISO = 'matrix(.866 .5 -.866 .5 0 0)';

/** Deterministic pseudo-random numbers, so builds are reproducible. */
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

function defs(id) {
  const glow = (name, v) => `
    <radialGradient id="${id}-${name}">
      <stop offset="0" style="stop-color:var(${v});stop-opacity:.6"/>
      <stop offset=".45" style="stop-color:var(${v});stop-opacity:.18"/>
      <stop offset="1" style="stop-color:var(${v});stop-opacity:0"/>
    </radialGradient>`;
  return `<defs>
    ${glow('ga', '--ill-a')}${glow('gb', '--ill-b')}${glow('gc', '--ill-c')}
    <radialGradient id="${id}-orb" cx=".36" cy=".32" r=".75">
      <stop offset="0" style="stop-color:#fff"/>
      <stop offset=".35" style="stop-color:var(--ill-c)"/>
      <stop offset="1" style="stop-color:var(--ill-a)"/>
    </radialGradient>
    <linearGradient id="${id}-line" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="600" y2="400">
      <stop offset="0" style="stop-color:var(--ill-a)"/>
      <stop offset=".55" style="stop-color:var(--ill-c)"/>
      <stop offset="1" style="stop-color:var(--ill-b)"/>
    </linearGradient>
    <linearGradient id="${id}-plate" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" style="stop-color:var(--ill-plate)"/>
      <stop offset="1" style="stop-color:var(--ill-plate-2)"/>
    </linearGradient>
    <pattern id="${id}-dots" width="12" height="12" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.1" class="fdot"/>
    </pattern>
    <filter id="${id}-shadow" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow dx="0" dy="14" stdDeviation="12" style="flood-color:var(--ill-a);flood-opacity:.16"/>
    </filter>
  </defs>`;
}

/** A floating isometric slab. `inner` is drawn in the slab's own (un-projected) coordinates. */
function plate(id, tx, ty, w, h, inner = '', { dots = true } = {}) {
  const r = `x="-14" y="-14" width="${w + 28}" height="${h + 28}" rx="20"`;
  return `
  <g filter="url(#${id}-shadow)">
    <g transform="translate(${tx} ${ty + 9})"><g transform="${ISO}"><rect ${r} class="edge"/></g></g>
    <g transform="translate(${tx} ${ty})"><g transform="${ISO}">
      <rect ${r} fill="url(#${id}-plate)" class="plate"/>
      ${dots ? `<rect ${r} fill="url(#${id}-dots)"/>` : ''}
      ${inner}
    </g></g>
  </g>`;
}

/** A node: solid dot, optionally with a soft glow halo. kind: a | b | c | i (ink) | w (hollow). */
function node(id, x, y, kind = 'a', r = 4, glow = false) {
  const halo = glow && kind !== 'i' && kind !== 'w'
    ? `<circle cx="${x}" cy="${y}" r="${r * 4.5}" fill="url(#${id}-g${kind})" class="pulse"/>`
    : '';
  return `${halo}<circle cx="${x}" cy="${y}" r="${r}" class="n${kind}"/>`;
}

/** A gradient connector with an animated dotted "data flow" on top. */
function link(id, d, { flow = true, width = 2 } = {}) {
  return `<path d="${d}" fill="none" stroke="url(#${id}-line)" stroke-width="${width}" stroke-linecap="round" opacity=".75"/>
    ${flow ? `<path d="${d}" class="flow"/>` : ''}`;
}

/** The central glowing orb with isometric rings. */
function orb(id, x, y, size = 1) {
  const s = (n) => n * size;
  return `
    <circle cx="${x}" cy="${y}" r="${s(95)}" fill="url(#${id}-ga)" class="pulse"/>
    <ellipse cx="${x}" cy="${y + s(14)}" rx="${s(78)}" ry="${s(36)}" class="ring"/>
    <ellipse cx="${x}" cy="${y + s(14)}" rx="${s(56)}" ry="${s(26)}" class="ring"/>
    <ellipse cx="${x}" cy="${y + s(14)}" rx="${s(36)}" ry="${s(16)}" class="ring strong"/>
    <circle cx="${x}" cy="${y}" r="${s(17)}" fill="url(#${id}-orb)"/>
    <ellipse cx="${x - s(5)}" cy="${y - s(7)}" rx="${s(6)}" ry="${s(3.5)}" fill="#fff" opacity=".7"/>`;
}

function particles(seed, count, box, classes = ['pt']) {
  const r = rng(seed);
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = box[0] + r() * (box[2] - box[0]);
    const y = box[1] + r() * (box[3] - box[1]);
    const radius = 1 + r() * 2.6;
    const cls = classes[Math.floor(r() * classes.length)];
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" class="${cls}" opacity="${(0.25 + r() * 0.55).toFixed(2)}"/>`;
  }
  return out;
}

function chip(id, x, y, label) {
  return `<g filter="url(#${id}-shadow)">
    <rect x="${x - 21}" y="${y - 21}" width="42" height="42" rx="12" fill="url(#${id}-plate)" class="plate"/>
    <text x="${x}" y="${y + 1}" class="chip-t">${label}</text>
  </g>`;
}

function svg(id, body) {
  return `<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${defs(id)}${body}</svg>`;
}

/* ------------------------------------------------------------------ scenes */

function network(id) {
  const p1 = plate(id, 440, 40, 150, 110, `
      <path d="M12 22 H62 V52 H122" class="trace"/>
      <path d="M12 84 H42 V62 H102 V92 H140" class="trace"/>
      <path d="M72 10 V36 H140" class="trace"/>
      ${node(id, 12, 22, 'i', 4)}${node(id, 62, 22, 'w', 3.5)}${node(id, 62, 52, 'b', 4, true)}${node(id, 122, 52, 'i', 4)}
      ${node(id, 12, 84, 'a', 4, true)}${node(id, 42, 62, 'w', 3.5)}${node(id, 102, 62, 'i', 4)}${node(id, 102, 92, 'b', 3.5)}
      ${node(id, 140, 92, 'i', 4)}${node(id, 72, 10, 'i', 3.5)}${node(id, 140, 36, 'b', 4, true)}`);
  const hub = [[16, 20], [92, 16], [96, 82], [20, 92], [58, 100], [30, 52], [84, 46]];
  const p2 = plate(id, 492, 188, 110, 112, `
      ${hub.map(([x, y]) => `<path d="M56 56 L${x} ${y}" class="trace thin"/>`).join('')}
      ${hub.map(([x, y], i) => node(id, x, y, ['b', 'i', 'a', 'w', 'i', 'b', 'i'][i], 3.6, i % 3 === 0)).join('')}
      ${node(id, 56, 56, 'a', 5.5, true)}`);
  const p3 = plate(id, 392, 262, 140, 96, `
      <path d="M10 48 C30 8 50 88 70 48 S110 8 130 48" class="trace"/>
      <path d="M10 80 H50 M90 16 H130" class="trace thin"/>
      ${node(id, 10, 48, 'i', 4)}${node(id, 70, 48, 'c', 4.5, true)}${node(id, 130, 48, 'i', 4)}
      ${node(id, 40, 26, 'w', 3.2)}${node(id, 100, 70, 'a', 3.6, true)}${node(id, 50, 80, 'i', 3)}${node(id, 90, 16, 'b', 3)}`);

  return svg(id, `
    ${particles(11, 46, [40, 20, 330, 380], ['pt', 'ptb'])}
    ${link(id, 'M214 168 C180 132 168 104 138 84', { width: 1.4 })}
    ${link(id, 'M206 196 C170 210 130 230 96 262', { width: 1.4 })}
    ${node(id, 138, 84, 'w', 5)}${node(id, 96, 262, 'b', 4, true)}
    ${node(id, 112, 64, 'i', 2.5)}${node(id, 160, 58, 'a', 3)}${node(id, 80, 286, 'i', 2.5)}
    ${p1}${p2}${p3}
    ${link(id, 'M252 186 C300 170 300 112 352 106')}
    ${link(id, 'M266 206 C320 214 350 250 402 248')}
    ${link(id, 'M240 230 C248 278 270 310 306 312')}
    ${orb(id, 232, 202)}
  `);
}

function math(id) {
  const u = 14;
  const fib = `
    <rect x="0" y="0" width="${13 * u}" height="${8 * u}" rx="4" class="trace thin"/>
    <path d="M${8 * u} 0 V${8 * u} M${8 * u} ${5 * u} H${13 * u} M${10 * u} ${5 * u} V${8 * u} M${8 * u} ${6 * u} H${10 * u} M${9 * u} ${5 * u} V${6 * u}" class="trace thin"/>
    <path d="M0 ${8 * u} A${8 * u} ${8 * u} 0 0 1 ${8 * u} 0 A${5 * u} ${5 * u} 0 0 1 ${13 * u} ${5 * u} A${3 * u} ${3 * u} 0 0 1 ${10 * u} ${8 * u} A${2 * u} ${2 * u} 0 0 1 ${8 * u} ${6 * u} A${u} ${u} 0 0 1 ${9 * u} ${5 * u} A${u} ${u} 0 0 1 ${10 * u} ${6 * u}"
      fill="none" stroke="url(#${id}-line)" stroke-width="3" stroke-linecap="round"/>
    ${node(id, 0, 8 * u, 'i', 4)}${node(id, 8 * u, 0, 'a', 4, true)}${node(id, 13 * u, 5 * u, 'b', 4, true)}
    ${node(id, 10 * u, 8 * u, 'i', 3.5)}${node(id, 8 * u, 6 * u, 'w', 3)}`;

  // Wireframe cube in true isometric projection.
  const cx = 474, top = 52, a = 48, b = 27.5, hgt = 56;
  const T = { back: [cx, top], right: [cx + a, top + b], front: [cx, top + 2 * b], left: [cx - a, top + b] };
  const B = { right: [cx + a, top + b + hgt], front: [cx, top + 2 * b + hgt], left: [cx - a, top + b + hgt] };
  const P = (p) => p.join(' ');
  const cube = `
    <path d="M${P(T.back)} L${P(T.front)} M${P(B.left)} L${P(T.front)} M${P(B.right)} L${P(T.front)}" class="trace thin dash"/>
    <path d="M${P(T.back)} L${P(T.right)} L${P(T.front)} L${P(T.left)} Z" class="face"/>
    <path d="M${P(T.left)} L${P(B.left)} L${P(B.front)} L${P(B.right)} L${P(T.right)} M${P(T.front)} L${P(B.front)}" fill="none" stroke="url(#${id}-line)" stroke-width="2" stroke-linejoin="round"/>
    <path d="M${P(T.back)} L${P(T.right)} L${P(T.front)} L${P(T.left)} Z" fill="none" stroke="url(#${id}-line)" stroke-width="2" stroke-linejoin="round"/>
    ${[T.back, T.right, T.front, T.left, B.left, B.front, B.right].map(([x, y], i) => node(id, x, y, i % 2 ? 'b' : 'a', 3.6, i === 2)).join('')}`;

  const wave = 'M330 332 C346 306 364 306 380 332 S414 358 430 332 S464 306 480 332 S514 358 530 332 S564 306 580 332';

  return svg(id, `
    ${particles(7, 40, [20, 20, 600, 390], ['pt', 'ptc'])}
    ${plate(id, 250, 128, 13 * u, 8 * u, fib)}
    ${cube}
    <path d="M318 332 H592" class="trace thin"/>
    ${[355, 405, 455, 505, 555].map((x) => `<path d="M${x} 327 V337" class="trace thin"/>`).join('')}
    <path d="${wave}" fill="none" stroke="url(#${id}-line)" stroke-width="2.6" stroke-linecap="round"/>
    ${node(id, 380, 332, 'i', 3.5)}${node(id, 430, 332, 'a', 4, true)}${node(id, 480, 332, 'i', 3.5)}${node(id, 530, 332, 'b', 4, true)}
    ${link(id, 'M306 222 C346 196 384 160 426 136')}
    ${link(id, 'M300 246 C306 290 318 318 330 332')}
    ${orb(id, 296, 232, 0.8)}
    ${chip(id, 92, 92, '∑')}${chip(id, 556, 214, 'π')}${chip(id, 110, 318, '∫')}${chip(id, 360, 58, '∞')}
  `);
}

function orbit(id) {
  const cx = 290, cy = 206;
  const orbitPoint = (rx, ry, deg, t) => {
    const th = (deg * Math.PI) / 180;
    return [cx + rx * Math.cos(t) * Math.cos(th) - ry * Math.sin(t) * Math.sin(th),
      cy + rx * Math.cos(t) * Math.sin(th) + ry * Math.sin(t) * Math.cos(th)];
  };
  const rings = [
    { rx: 210, ry: 74, deg: -16, nodes: [[0.4, 'b', true], [2.6, 'i', false], [4.4, 'a', true]] },
    { rx: 150, ry: 54, deg: 14, nodes: [[1.2, 'c', true], [3.6, 'w', false], [5.4, 'i', false]] },
    { rx: 92, ry: 36, deg: -4, nodes: [[2.2, 'a', true], [5.0, 'b', false]] },
  ];
  const orbits = rings.map(({ rx, ry, deg }, i) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${deg} ${cx} ${cy})" class="ring${i === 1 ? ' dash' : ''}${i === 0 ? ' strong' : ''}"/>`).join('');
  const bodies = rings.flatMap(({ rx, ry, deg, nodes }) =>
    nodes.map(([t, kind, glow]) => {
      const [x, y] = orbitPoint(rx, ry, deg, t);
      return node(id, x.toFixed(1), y.toFixed(1), kind, glow ? 5 : 3.6, glow);
    })).join('');

  const stars = [[452, 52], [494, 80], [534, 62], [566, 104], [520, 126], [482, 118]];
  const constellation = `
    <path d="M${stars.map((s) => s.join(' ')).join(' L')}" class="trace thin"/>
    <path d="M${stars[1].join(' ')} L${stars[5].join(' ')}" class="trace thin"/>
    ${stars.map(([x, y], i) => node(id, x, y, i % 2 ? 'b' : 'a', i === 2 ? 4 : 2.8, i === 2)).join('')}`;

  const doc = plate(id, 112, 262, 96, 70, `
      <rect x="10" y="10" width="44" height="7" rx="3.5" class="na" opacity=".75"/>
      <rect x="10" y="26" width="76" height="5" rx="2.5" class="ni" opacity=".25"/>
      <rect x="10" y="38" width="66" height="5" rx="2.5" class="ni" opacity=".25"/>
      <rect x="10" y="50" width="72" height="5" rx="2.5" class="ni" opacity=".25"/>`, { dots: false });

  return svg(id, `
    ${particles(23, 70, [10, 10, 600, 390], ['pt', 'ptb', 'ptc'])}
    ${orbits}
    ${constellation}
    ${link(id, 'M330 170 C380 130 430 110 482 118', { width: 1.6 })}
    ${doc}
    ${link(id, 'M262 236 C230 262 200 282 176 300', { width: 1.6 })}
    ${orb(id, cx, cy, 1.05)}
    ${bodies}
  `);
}

function stream(id) {
  const lanes = [24, 70, 116];
  const r = rng(5);
  const records = lanes.map((y, li) => {
    let out = `<rect x="6" y="${y - 15}" width="228" height="30" rx="9" class="lane"/>`;
    for (let i = 0; i < 9; i++) {
      const x = 14 + i * 24.5;
      const roll = r();
      const cls = i < 3 + li ? 'rec-done' : roll < 0.3 ? 'rec-b' : roll < 0.55 ? 'rec-a' : 'rec-w';
      out += `<rect x="${x.toFixed(1)}" y="${y - 8}" width="17" height="16" rx="4.5" class="${cls}"/>`;
    }
    return out;
  }).join('');

  const tx = 236, ty = 58;
  const scr = (px, py) => [tx + 0.866 * (px - py), ty + 0.5 * (px + py)];
  const ends = lanes.map((y) => scr(240, y));
  const starts = lanes.map((y) => scr(0, y));
  const consumers = [[540, 214], [500, 292], [430, 346]];
  const fanOut = ends.flatMap(([x, y], i) => consumers.map(([cx2, cy2], j) =>
    (i === j || (i + 1) % 3 === j)
      ? link(id, `M${x.toFixed(1)} ${y.toFixed(1)} C${(x + 50).toFixed(1)} ${y.toFixed(1)} ${(cx2 - 50).toFixed(1)} ${cy2} ${cx2 - 14} ${cy2}`, { width: 1.5, flow: i === j })
      : '')).join('');

  return svg(id, `
    ${particles(31, 36, [20, 20, 600, 390], ['pt', 'ptb'])}
    ${starts.map(([x, y]) => link(id, `M96 70 C130 70 ${(x - 40).toFixed(1)} ${y.toFixed(1)} ${(x - 8).toFixed(1)} ${y.toFixed(1)}`, { width: 1.5 })).join('')}
    ${orb(id, 84, 66, 0.55)}
    ${plate(id, tx, ty, 240, 140, records, { dots: false })}
    ${fanOut}
    ${consumers.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="15" fill="url(#${id}-plate)" class="plate"/>${node(id, x, y, ['b', 'a', 'c'][i], 6, true)}`).join('')}
  `);
}

function layers(id) {
  const grid = Array.from({ length: 7 }, (_, i) => `M${i * 26 + 2} 2 V158 M2 ${i * 26 + 2} H158`).join(' ');
  const bottom = plate(id, 300, 196, 160, 160, `
      <path d="${grid}" class="trace thin"/>
      ${node(id, 80, 80, 'a', 7, true)}`);
  const middle = plate(id, 300, 126, 160, 160, `
      <rect x="18" y="18" width="56" height="56" rx="10" class="tile"/>
      <rect x="86" y="18" width="56" height="56" rx="10" class="tile"/>
      <rect x="18" y="86" width="56" height="56" rx="10" class="tile"/>
      <rect x="86" y="86" width="56" height="56" rx="10" class="tile strong"/>
      ${node(id, 114, 114, 'b', 5, true)}`, { dots: false });
  const top = plate(id, 300, 56, 160, 160, `
      <path d="M20 30 H70 V80 H140 M20 130 H60 V100 H120 V140 M100 20 V50 H140" class="trace"/>
      ${node(id, 20, 30, 'i', 4)}${node(id, 70, 80, 'c', 5, true)}${node(id, 140, 80, 'i', 4)}${node(id, 20, 130, 'a', 4, true)}
      ${node(id, 120, 140, 'i', 4)}${node(id, 100, 20, 'b', 4, true)}${node(id, 140, 50, 'w', 3.5)}${node(id, 60, 100, 'w', 3.5)}`);
  const corners = [[300, 56], [438.6, 136], [161.4, 136], [300, 216]];
  const pillars = corners.map(([x, y]) => `<path d="M${x} ${y} V${y + 140}" class="trace thin dash"/>`).join('');

  return svg(id, `
    ${particles(42, 44, [20, 20, 600, 390], ['pt', 'ptb', 'ptc'])}
    ${bottom}${middle}
    ${pillars}
    ${top}
    ${link(id, 'M154 136 C110 136 96 96 60 92', { width: 1.6 })}
    ${link(id, 'M446 136 C500 140 520 190 556 196', { width: 1.6 })}
    ${node(id, 60, 92, 'b', 5, true)}${node(id, 556, 196, 'a', 5, true)}
    ${node(id, 40, 120, 'i', 2.5)}${node(id, 574, 170, 'i', 2.5)}
  `);
}

const scenes = { math, network, orbit, stream, layers };

let counter = 0;

/** Render an illustration to an SVG string. */
export function renderIllustration(name, prefix = 'ill') {
  const scene = scenes[name];
  if (!scene) throw new Error(`Unknown illustration "${name}". Available: ${illustrationNames.join(', ')}`);
  counter += 1;
  return scene(`${prefix}-${name}-${counter}`);
}
