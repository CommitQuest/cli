import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import stringWidth from 'string-width';

/** Fantasy palette — warm gold, emerald, deep teal (not purple-default AI look). */
export const palette = {
  gold: chalk.hex('#E8B84A'),
  goldBright: chalk.hex('#FFD76A').bold,
  amber: chalk.hex('#F0A030'),
  emerald: chalk.hex('#3ECF8E'),
  emeraldDim: chalk.hex('#2A9B6A'),
  teal: chalk.hex('#4ECDC4'),
  tealDim: chalk.hex('#2A9A94'),
  crimson: chalk.hex('#E85D5D'),
  rose: chalk.hex('#FF8A80'),
  stone: chalk.hex('#8B8580'),
  mist: chalk.hex('#C4BEB6'),
  ink: chalk.hex('#1A1A18'),
  parchment: chalk.hex('#F5E6C8'),
  flame: chalk.hex('#FF6B35'),
  frost: chalk.hex('#A8D8FF'),
  mystic: chalk.hex('#7EB8DA'),
};

const BOX = {
  double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║', ml: '╠', mr: '╣', t: '╦', b: '╩', x: '╬' },
  round: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│', ml: '├', mr: '┤', t: '┬', b: '┴', x: '┼' },
  heavy: { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃', ml: '┣', mr: '┫', t: '┳', b: '┻', x: '╋' },
};

/** Display columns (emoji / CJK aware). ANSI styles do not count. */
export function visibleWidth(text) {
  return stringWidth(String(text ?? ''));
}

export function terminalColumns(fallback = 80) {
  const cols = Number(process.stdout?.columns);
  return Number.isFinite(cols) && cols >= 20 ? cols : fallback;
}

/** Clamp a preferred content width to the current terminal. */
export function resolvePanelWidth(preferred = 50, { min = 28, gutter = 4 } = {}) {
  const max = Math.max(min, terminalColumns() - gutter);
  const want = Number.isFinite(preferred) ? preferred : max;
  return Math.max(min, Math.min(want, max));
}

/** Truncate to a display width, appending … when clipped. */
export function truncateToWidth(text, width) {
  const value = String(text ?? '');
  if (width <= 0) return '';
  if (visibleWidth(value) <= width) return value;

  const plain = stripAnsi(value);
  if (width === 1) return '…';

  let out = '';
  for (const ch of [...plain]) {
    if (visibleWidth(out + ch) > width - 1) break;
    out += ch;
  }
  return `${out}…`;
}

/** Word-wrap plain text to a display width. */
export function wrapToWidth(text, width) {
  const plain = stripAnsi(String(text ?? ''));
  if (width <= 0) return [''];
  if (visibleWidth(plain) <= width) return [plain];

  const lines = [];
  let current = '';

  const pushHard = (chunk) => {
    let rest = chunk;
    while (visibleWidth(rest) > width) {
      let piece = '';
      for (const ch of [...rest]) {
        if (visibleWidth(piece + ch) > width) break;
        piece += ch;
      }
      if (!piece) {
        piece = [...rest][0] || '';
      }
      lines.push(piece);
      rest = rest.slice(piece.length);
    }
    current = rest;
  };

  for (const word of plain.split(/(\s+)/)) {
    if (!word) continue;
    if (visibleWidth(current + word) <= width) {
      current += word;
      continue;
    }
    if (current.trim()) lines.push(current.trimEnd());
    if (visibleWidth(word.trim()) > width) {
      pushHard(word.trim());
    } else {
      current = word.trimStart();
    }
  }
  if (current.trim()) lines.push(current.trimEnd());
  return lines.length ? lines : [''];
}

export function padLine(text, width, align = 'left') {
  const value = truncateToWidth(String(text ?? ''), width);
  const len = visibleWidth(value);
  const pad = Math.max(0, width - len);
  if (align === 'center') {
    const left = Math.floor(pad / 2);
    const right = pad - left;
    return ' '.repeat(left) + value + ' '.repeat(right);
  }
  if (align === 'right') {
    return ' '.repeat(pad) + value;
  }
  return value + ' '.repeat(pad);
}

/** Soft gold→amber→teal “gradient” across characters. */
export function gradientText(text, colors = ['#E8B84A', '#F0A030', '#4ECDC4', '#3ECF8E']) {
  const chars = [...String(text)];
  if (chars.length === 0) return '';
  return chars
    .map((ch, i) => {
      if (ch === ' ') return ch;
      const t = chars.length === 1 ? 0 : i / (chars.length - 1);
      const idx = Math.min(colors.length - 1, Math.floor(t * (colors.length - 1)));
      const next = Math.min(colors.length - 1, idx + 1);
      const local = t * (colors.length - 1) - idx;
      const hex = local < 0.5 ? colors[idx] : colors[next];
      return chalk.hex(hex)(ch);
    })
    .join('');
}

export function divider(width = 52, style = 'ornate') {
  const w = Math.max(8, width);
  if (style === 'ornate') {
    const mid = Math.floor((w - 3) / 2);
    const left = '─'.repeat(mid);
    const right = '─'.repeat(w - mid - 3);
    return palette.stone(`${left}◇${right}`);
  }
  if (style === 'double') {
    return palette.gold('═'.repeat(w));
  }
  if (style === 'flame') {
    const n = Math.floor(w / 2);
    return palette.flame('~'.repeat(n)) + palette.amber('≈'.repeat(w - n));
  }
  return palette.stone('─'.repeat(w));
}

export function sectionTitle(title, { width = 52, accent = 'gold' } = {}) {
  const color = palette[accent] || palette.gold;
  const label = ` ${title} `;
  const labelLen = visibleWidth(label);
  const side = Math.max(2, Math.floor((width - labelLen) / 2));
  const right = Math.max(2, width - labelLen - side);
  return (
    color('─'.repeat(side)) +
    palette.goldBright(label) +
    color('─'.repeat(right))
  );
}

/**
 * Draw a framed panel. Edges stay aligned across emoji/unicode and terminal sizes.
 * `width` is preferred content width; actual width clamps to the terminal and can
 * grow to fit content (without overflowing the screen).
 */
export function box(lines, {
  title,
  width = 50,
  style = 'round',
  color = 'gold',
  align = 'left',
  autoWidth = true,
} = {}) {
  const b = BOX[style] || BOX.round;
  const paint = palette[color] || palette.gold;
  const rows = (Array.isArray(lines) ? lines : String(lines).split('\n'))
    .map((row) => String(row ?? ''));

  const maxContent = resolvePanelWidth(terminalColumns() - 4, { min: 24, gutter: 4 });
  let contentWidth = resolvePanelWidth(width, { min: 24, gutter: 4 });

  if (autoWidth) {
    const longest = Math.max(
      0,
      ...rows.map((row) => visibleWidth(row)),
      title ? visibleWidth(` ${title} `) : 0
    );
    contentWidth = Math.min(maxContent, Math.max(contentWidth, Math.min(longest, maxContent)));
  }

  contentWidth = Math.min(contentWidth, maxContent);

  const titleLabel = title != null && title !== ''
    ? truncateToWidth(` ${title} `, Math.max(3, contentWidth))
    : null;

  const top = titleLabel
    ? (() => {
        const tLen = visibleWidth(titleLabel);
        const avail = Math.max(0, contentWidth - tLen);
        const left = Math.floor(avail / 2);
        const right = avail - left;
        return paint(b.tl + b.h.repeat(left)) + palette.goldBright(titleLabel) + paint(b.h.repeat(right) + b.tr);
      })()
    : paint(b.tl + b.h.repeat(contentWidth) + b.tr);

  const body = rows.flatMap((row) => {
    if (visibleWidth(row) <= contentWidth) {
      return [paint(b.v) + padLine(row, contentWidth, align) + paint(b.v)];
    }
    // Overflow: wrap as plain text so column edges stay perfect.
    return wrapToWidth(row, contentWidth).map(
      (line) => paint(b.v) + padLine(line, contentWidth, align) + paint(b.v)
    );
  });

  const bottom = paint(b.bl + b.h.repeat(contentWidth) + b.br);
  return [top, ...body, bottom].join('\n');
}

export function banner(subtitle) {
  const title = gradientText('COMMITQUEST', ['#E8B84A', '#FFD76A', '#F0A030', '#E8B84A']);
  const tagline = palette.mist('Welcome, adventurer');
  const mountain = palette.amber;
  const castle = chalk.white;
  const water = chalk.hex('#4A9EFF');
  const landscape = [
    palette.frost('        .  *    .      *   .'),
    mountain('              /\\        /\\'),
    mountain('             /  \\  /\\  /  \\              ') + title,
    // Castle battlements (white) sit in the mountain ridge (orange)
    mountain('            ') +
      castle('/_/\\_\\') +
      mountain('/  \\') +
      castle('/_/\\_\\') +
      mountain('             ') +
      tagline,
    castle('            |    |░░░░|    |'),
    mountain('       ~/~~\\') +
      castle('| [] |████| [] |') +
      mountain('/~~\\~'),
    mountain('      /     ') +
      castle('|____|████|____|') +
      mountain('     \\'),
    water('  ' + '~'.repeat(32)),
  ];

  if (subtitle) {
    landscape.push('');
    landscape.push(palette.teal(`  ${subtitle}`));
  }
  return landscape.join('\n');
}

export function compactBanner(title = 'CommitQuest') {
  return box(
    [palette.mist('  ◇  quest · commit · conquer  ◇')],
    { title, width: 42, style: 'double', color: 'gold' }
  );
}

function statusBanner(title, details, { glyph, color, style }) {
  const lines = [
    (palette[color] || palette.gold)(` ${title}`),
    ...details.map((d) => palette.mist(`  ${d}`)),
  ];
  const longest = Math.max(
    visibleWidth(` ${glyph} `),
    ...lines.map((line) => visibleWidth(line))
  );
  return box(lines, {
    title: glyph,
    width: resolvePanelWidth(Math.max(40, longest + 2)),
    style,
    color,
  });
}

/** Block progress bar with color that warms as it fills. */
export function renderBar(percent, { width = 24, filled = '█', empty = '░' } = {}) {
  const p = Math.min(100, Math.max(0, Number(percent) || 0));
  const fillCount = Math.round((p / 100) * width);
  const emptyCount = width - fillCount;

  const fills = [];
  for (let i = 0; i < fillCount; i++) {
    const t = width <= 1 ? 1 : i / (width - 1);
    let color;
    if (t < 0.33) color = palette.emeraldDim;
    else if (t < 0.66) color = palette.teal;
    else if (t < 0.9) color = palette.gold;
    else color = palette.goldBright;
    fills.push(color(filled));
  }

  return fills.join('') + palette.stone(empty.repeat(emptyCount));
}

export function xpMeter(levelProgress, { width = 22 } = {}) {
  if (!levelProgress || !Number.isFinite(levelProgress.currentLevel)) {
    return null;
  }

  const currentLevel = levelProgress.currentLevel;
  const expIn = Number.isFinite(levelProgress.expInCurrentLevel) ? levelProgress.expInCurrentLevel : 0;
  const expNeed = Number.isFinite(levelProgress.expNeededForNextLevel) ? levelProgress.expNeededForNextLevel : 0;
  const progress = Math.min(
    100,
    Math.max(
      0,
      Number.isFinite(levelProgress.progress)
        ? levelProgress.progress
        : expNeed > 0
          ? (expIn / expNeed) * 100
          : 0
    )
  );
  const totalExp = Number.isFinite(levelProgress.totalExp) ? levelProgress.totalExp : 0;
  const pct = Number(progress.toFixed(2)).toString();

  const bar = renderBar(progress, { width });
  const header =
    palette.amber(`Lv ${currentLevel}`) +
    ' ' +
    palette.stone('[') +
    bar +
    palette.stone(']') +
    ' ' +
    palette.gold(`Lv ${currentLevel + 1}`);

  return [
    header,
    palette.mist(`  ✦ ${expIn}/${expNeed} XP`) + palette.stone(`  (${pct}%)`),
    palette.stone(`  Σ Total XP: `) + palette.goldBright(String(totalExp)),
  ].join('\n');
}

export function streakVisual(days) {
  const n = Number(days) || 0;
  if (n <= 0) return palette.stone('○ cold start — light the forge');
  if (n < 3) return palette.amber(`✧ ${n} day ember`);
  if (n < 7) return palette.flame(`🔥 ${n}-day blaze`);
  if (n < 30) return palette.flame(`🔥🔥 ${n}-day inferno`);
  return palette.goldBright(`🌋 ${n}-day legendary streak`);
}

export function commitsVisual(count) {
  const n = Number(count) || 0;
  if (n === 0) return palette.stone('no scrolls yet');
  if (n < 10) return palette.teal(`${n} scrolls sealed`);
  if (n < 100) return palette.teal(`${n} quest logs`);
  return palette.goldBright(`${n} chronicles of glory`);
}

const CLASS_ART = {
  wizard: ['  ∩_∩  ', ' /★_★\\ ', ' \\___/  '],
  warrior: ['  ⚔    ', ' /███\\ ', ' \\___/  '],
  rogue: ['  ^_^  ', ' /▓_▓\\ ', '  \\_/   '],
  scout: ['  ◠◠   ', ' /o_o\\ ', '  \\_/   '],
  cleric: ['  †    ', ' /♥_♥\\ ', '  \\_/   '],
  ranger: ['  🏹   ', ' /•_•\\ ', '  \\_/   '],
  paladin: ['  +    ', ' /#_#\\ ', '  \\_/   '],
  bard: ['  ♪    ', ' /♫_♫\\ ', '  \\_/   '],
  monk: ['  ☯    ', ' /=_=\\ ', '  \\_/   '],
  druid: ['  🌿   ', ' /◇_◇\\ ', '  \\_/   '],
  sorcerer: ['  ✦    ', ' /✧_✧\\ ', '  \\_/   '],
  warlock: ['  ☽    ', ' /◉_◉\\ ', '  \\_/   '],
  barbarian: ['  🪓   ', ' /▼_▼\\ ', '  \\_/   '],
  fighter: ['  ⚔    ', ' /■_■\\ ', '  \\_/   '],
  default: ['  ◈    ', ' /•_•\\ ', '  \\_/   '],
};

const SPECIES_ART = {
  human: ['  ☺  '],
  elf: ['  ✧  '],
  dwarf: ['  ◆  '],
  orc: ['  ▲  '],
  lizardfolk: ['  ≈  '],
  default: ['  ○  '],
};

export function getClassArt(className) {
  const key = String(className || 'default').toLowerCase();
  return CLASS_ART[key] || CLASS_ART.default;
}

export function getSpeciesGlyph(speciesName) {
  const key = String(speciesName || 'default').toLowerCase();
  return (SPECIES_ART[key] || SPECIES_ART.default)[0];
}

export function characterPortrait(character, { width = 28, title = '✦ Hero' } = {}) {
  if (!character) return null;
  const className = character.classes?.name || 'Adventurer';
  const speciesName = character.species?.name || 'Unknown';
  const art = getClassArt(className);
  const glyph = getSpeciesGlyph(speciesName);

  const lines = [
    palette.goldBright(`  ${character.name}`),
    palette.stone('  ─────────────────'),
    ...art.map((line) => palette.teal(`  ${line}`)),
    '',
    palette.mist(`  ${glyph} ${speciesName}`) + palette.stone('  ·  ') + palette.amber(className),
  ];
  return box(lines, { title, width, style: 'round', color: 'teal' });
}

/** Side-by-side column layout (falls back to stacked if too narrow). */
export function columns(left, right, { gap = 2, minWidth = 72 } = {}) {
  const leftLines = String(left || '').split('\n');
  const rightLines = String(right || '').split('\n');
  const leftW = Math.max(0, ...leftLines.map(visibleWidth));
  const rightW = Math.max(0, ...rightLines.map(visibleWidth));
  const termWidth = Number(process.stdout.columns) || 80;

  if (termWidth < minWidth || leftW + rightW + gap > termWidth) {
    return [...leftLines, '', ...rightLines].join('\n');
  }

  const height = Math.max(leftLines.length, rightLines.length);
  const spacer = ' '.repeat(gap);
  const rows = [];
  for (let i = 0; i < height; i++) {
    const l = leftLines[i] ?? '';
    const r = rightLines[i] ?? '';
    rows.push(padLine(l, leftW) + spacer + r);
  }
  return rows.join('\n');
}

/** App-window chrome with title bar + status footer. */
export function appWindow({ title, subtitle, body, footer, width = 62 } = {}) {
  const rows = [];
  if (subtitle) {
    rows.push(palette.mist(`  ${subtitle}`));
    rows.push('');
  }
  for (const row of String(body || '').split('\n')) {
    rows.push(row);
  }
  if (footer) {
    rows.push('');
    rows.push(palette.stone(`  ${footer}`));
  }
  return box(rows, {
    title: title || 'CommitQuest',
    width: resolvePanelWidth(width),
    style: 'heavy',
    color: 'gold',
  });
}

/** Settings-row used by the character editor menu. */
export function settingsRow(key, label, value, { dirty = false } = {}) {
  const marker = dirty ? palette.amber('●') : palette.stone('○');
  const keyLabel = palette.teal(padLine(`[${key}]`, 4));
  const name = palette.mist(padLine(label, 10));
  const val = dirty ? palette.goldBright(String(value)) : palette.parchment(String(value));
  return `  ${marker} ${keyLabel} ${name} ${val}`;
}

export function actionBar(actions, { width = 60 } = {}) {
  const parts = actions.map(([key, label]) => {
    return palette.stone('[') + palette.goldBright(key) + palette.stone('] ') + palette.mist(label);
  });
  const joined = parts.join(palette.stone('  ·  '));
  return box([`  ${joined}`], { title: 'Actions', width, style: 'round', color: 'stone' });
}

/** Compact meter line for dashboard tiles. */
export function meterTile(label, valueText, percent, { width = 18, icon = '✦' } = {}) {
  const bar = renderBar(percent, { width });
  return [
    palette.stone(`  ${icon} `) + palette.mist(label),
    palette.stone('  [') + bar + palette.stone(']'),
    palette.goldBright(`  ${valueText}`),
  ].join('\n');
}

export function trophyGrid(achievements, { columns: cols = 1, limit = 6 } = {}) {
  const items = (achievements || []).slice(0, limit);
  if (items.length === 0) {
    return [palette.stone('  No trophies yet — keep committing!')];
  }

  if (cols <= 1) {
    return items.map(achievementRow);
  }

  const rows = [];
  for (let i = 0; i < items.length; i += cols) {
    const chunk = items.slice(i, i + cols);
    const cells = chunk.map((a) => {
      const icon = a.metadata?.icon || '★';
      const name = String(a.name || 'Mystery').slice(0, 18);
      return padLine(palette.emerald(`✧ ${icon} `) + palette.parchment(name), 26);
    });
    rows.push('  ' + cells.join(palette.stone(' │ ')));
  }
  return rows;
}

export function statRow(label, value, { icon = '·' } = {}) {
  return (
    palette.stone(`  ${icon} `) +
    palette.mist(padLine(label, 14)) +
    palette.goldBright(String(value))
  );
}

export function achievementRow(achievement) {
  const icon = achievement.metadata?.icon || '★';
  const name = achievement.name || 'Mystery Achievement';
  return palette.emerald(`  ✧ ${icon}  `) + palette.parchment(name);
}

export function successBanner(title, details = []) {
  return statusBanner(title, details, { glyph: 'OK', color: 'emerald', style: 'round' });
}

export function warnBanner(title, details = []) {
  return statusBanner(title, details, { glyph: '!', color: 'amber', style: 'round' });
}

export function errorBanner(title, details = []) {
  return statusBanner(title, details, { glyph: 'ERR', color: 'crimson', style: 'heavy' });
}

/** Server/API throttle — flame (not crimson) so it reads as "wait/retry", not bad credentials. */
export function rateLimitBanner(title, details = []) {
  return statusBanner(title, details, { glyph: 'WAIT', color: 'flame', style: 'heavy' });
}

export function infoHint(text) {
  return palette.stone(`  ▸ ${text}`);
}

export function commandHint(cmd, description) {
  return palette.teal(`  ${padLine(cmd, 28)}`) + palette.stone(description);
}

export function sparkleLine(text) {
  return palette.gold('  · ') + gradientText(text, ['#FFD76A', '#E8B84A', '#4ECDC4']) + palette.gold(' ·');
}

/** Tiny spinner-ish waiting dots for polling (static helper). */
export function waitingPulse(tick = 0) {
  const frames = ['◐', '◓', '◑', '◒'];
  return palette.teal(frames[tick % frames.length]);
}
