import { useEffect, useRef } from "react";

type Point = { x: number; y: number };
type Rgb = { r: number; g: number; b: number };
type DomainKind = "rag" | "tools" | "memory" | "trace";

type Palette = {
  background: Rgb;
  foreground: Rgb;
  primary: Rgb;
  soft: Rgb;
};

type Domain = {
  kind: DomainKind;
  label: string;
  x: number;
  y: number;
  phase: number;
};

type LayoutModel = {
  core: { x: number; y: number; r: number };
  domains: Domain[];
  scale: number;
};

const OFFSCREEN = -10000;
const PRIMARY_FALLBACK = "#0e7c7b";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function parseRgb(value: string, fallback: Rgb): Rgb {
  const hex = value.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);

  if (hex) {
    const raw = hex[1];
    const normalized =
      raw.length === 3
        ? raw
            .split("")
            .map(char => char + char)
            .join("")
        : raw;

    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16),
    };
  }

  const rgb = value.match(/rgba?\(([^)]+)\)/i);
  if (!rgb) return fallback;

  const channels = rgb[1]
    .replace(/\//g, " ")
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(channel => {
      const parsed = Number.parseFloat(channel);
      return channel.endsWith("%") ? (parsed / 100) * 255 : parsed;
    });

  if (channels.length < 3 || channels.some(channel => Number.isNaN(channel))) {
    return fallback;
  }

  return {
    r: clamp(channels[0], 0, 255),
    g: clamp(channels[1], 0, 255),
    b: clamp(channels[2], 0, 255),
  };
}

function tokenRgb(name: string, fallback: string): Rgb {
  if (typeof document === "undefined") {
    return parseRgb(fallback, { r: 14, g: 124, b: 123 });
  }

  const probe = document.createElement("span");
  probe.style.color = `var(${name}, ${fallback})`;
  probe.style.position = "absolute";
  probe.style.pointerEvents = "none";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);

  const resolved = getComputedStyle(probe).color;
  probe.remove();

  return parseRgb(resolved, parseRgb(fallback, { r: 14, g: 124, b: 123 }));
}

function rgba(color: Rgb, alpha: number) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${clamp(alpha, 0, 1)})`;
}

function mixRgb(a: Rgb, b: Rgb, amount: number): Rgb {
  const t = clamp(amount, 0, 1);
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function cubicPoint(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number
): Point {
  const u = 1 - t;
  return {
    x:
      u * u * u * p0.x +
      3 * u * u * t * p1.x +
      3 * u * t * t * p2.x +
      t * t * t * p3.x,
    y:
      u * u * u * p0.y +
      3 * u * u * t * p1.y +
      3 * u * t * t * p2.y +
      t * t * t * p3.y,
  };
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawMicroLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  detail: string,
  palette: Palette,
  dark: boolean,
  align: "left" | "center" = "left"
) {
  const labelWidth = Math.max(78, label.length * 7.2 + 20);
  const width = detail
    ? Math.max(labelWidth, detail.length * 5.8 + 20)
    : labelWidth;
  const height = detail ? 42 : 28;
  const left = align === "center" ? x - width / 2 : x;

  ctx.save();
  ctx.globalCompositeOperation = dark ? "screen" : "multiply";
  roundedRectPath(ctx, left, y, width, height, 8);
  ctx.fillStyle = rgba(palette.background, dark ? 0.42 : 0.58);
  ctx.fill();
  ctx.strokeStyle = rgba(palette.primary, dark ? 0.2 : 0.16);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = "700 10px 'Plus Jakarta Sans', Inter, sans-serif";
  ctx.letterSpacing = "0.12em";
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillStyle = rgba(palette.soft, dark ? 0.68 : 0.58);
  ctx.fillText(label, align === "center" ? x : left + 10, y + 8);

  if (detail) {
    ctx.font = "600 9px 'Plus Jakarta Sans', Inter, sans-serif";
    ctx.letterSpacing = "0.04em";
    ctx.fillStyle = rgba(palette.foreground, dark ? 0.34 : 0.36);
    ctx.fillText(detail, align === "center" ? x : left + 10, y + 24);
  }
  ctx.restore();
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: Palette,
  dark: boolean
) {
  ctx.fillStyle = rgba(palette.background, 1);
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = dark ? "screen" : "multiply";

  const field = ctx.createRadialGradient(
    width * 0.72,
    height * 0.48,
    20,
    width * 0.72,
    height * 0.48,
    width * 0.58
  );
  field.addColorStop(0, rgba(palette.primary, dark ? 0.17 : 0.12));
  field.addColorStop(0.46, rgba(palette.primary, dark ? 0.06 : 0.055));
  field.addColorStop(1, rgba(palette.primary, 0));
  ctx.fillStyle = field;
  ctx.fillRect(0, 0, width, height);

  const plane = ctx.createLinearGradient(0, height, width, height * 0.08);
  plane.addColorStop(0, rgba(palette.primary, 0));
  plane.addColorStop(0.45, rgba(palette.primary, dark ? 0.08 : 0.055));
  plane.addColorStop(1, rgba(palette.primary, 0));
  ctx.fillStyle = plane;
  ctx.beginPath();
  ctx.moveTo(width * -0.1, height * 0.96);
  ctx.lineTo(width * 0.42, height * 0.64);
  ctx.lineTo(width * 1.08, height * 0.3);
  ctx.lineTo(width * 1.08, height * 0.5);
  ctx.lineTo(width * 0.52, height * 0.72);
  ctx.lineTo(width * -0.1, height * 1.04);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: Palette,
  dark: boolean,
  time: number
) {
  const step = width < 900 ? 58 : 48;
  const originY = height * 0.2;
  const primaryAlpha = dark ? 0.038 : 0.034;
  const secondaryAlpha = dark ? 0.026 : 0.024;

  ctx.save();
  ctx.globalCompositeOperation = dark ? "screen" : "multiply";
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(palette.primary, primaryAlpha);

  for (let i = -18; i < width / step + 26; i += 1) {
    const x = i * step + ((time * 1.3) % step);
    ctx.beginPath();
    ctx.moveTo(x - width * 0.16, height);
    ctx.lineTo(x + width * 0.62, originY);
    ctx.stroke();
  }

  ctx.strokeStyle = rgba(palette.primary, secondaryAlpha);
  for (let i = -16; i < width / step + 28; i += 1) {
    const x = i * step - ((time * 0.9) % step);
    ctx.beginPath();
    ctx.moveTo(x + width * 0.12, originY);
    ctx.lineTo(x + width * 0.78, height);
    ctx.stroke();
  }

  ctx.restore();
}

function drawDataPointField(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  model: LayoutModel,
  time: number,
  cursor: Point,
  active: number,
  palette: Palette,
  dark: boolean
) {
  const compact = width < 820;
  const stepX = compact ? 25 : 27;
  const stepY = compact ? 23 : 25;
  const startX = compact ? width * -0.04 : width * 0.12;
  const startY = height * 0.16;
  const endY = height * 0.96;
  const corePoint = { x: model.core.x, y: model.core.y };
  const domainRadius = (compact ? 95 : 130) * model.scale;
  const coreRadius = model.core.r * 2.3;

  ctx.save();
  ctx.globalCompositeOperation = dark ? "screen" : "multiply";

  const rows = Math.ceil((endY - startY) / stepY) + 4;
  const cols = Math.ceil((width * 1.28) / stepX) + 10;

  for (let row = -2; row < rows; row += 1) {
    const y = startY + row * stepY;
    const depth = clamp((y - startY) / Math.max(1, endY - startY), 0, 1);
    const rowShift =
      (row % 2) * stepX * 0.5 +
      depth * width * (compact ? 0.03 : 0.1) +
      Math.sin(time * 0.12 + row * 0.31) * stepX * 0.18;

    for (let col = -4; col < cols; col += 1) {
      const x = startX + col * stepX + rowShift;
      if (x < -20 || x > width + 20 || y < -20 || y > height + 20) {
        continue;
      }

      const point = { x, y };
      const textFade = compact
        ? 0.72
        : clamp((x - width * 0.18) / (width * 0.34), 0.12, 1);
      const bottomFade = clamp((height - y) / (height * 0.28), 0.16, 1);
      const coreContain = Math.max(
        0,
        1 - distance(point, corePoint) / coreRadius
      );
      const domainContain = model.domains.reduce((max, domain) => {
        const score = Math.max(
          0,
          1 - distance(point, { x: domain.x, y: domain.y }) / domainRadius
        );
        return Math.max(max, score);
      }, 0);
      const containment = Math.max(coreContain, domainContain);
      const cursorFocus =
        active > 0.02 && cursor.x !== OFFSCREEN
          ? Math.max(0, 1 - distance(point, cursor) / 180) * active
          : 0;
      const pulse = Math.sin(time * 0.72 + row * 0.29 + col * 0.17) * 0.5 + 0.5;
      const alpha =
        ((dark ? 0.048 : 0.05) +
          containment * (dark ? 0.12 : 0.095) +
          cursorFocus * (dark ? 0.12 : 0.08) +
          pulse * (dark ? 0.012 : 0.01)) *
        textFade *
        bottomFade;
      const radius =
        0.62 + containment * 0.66 + cursorFocus * 0.5 + depth * 0.06;

      ctx.fillStyle = rgba(
        containment > 0.08 ? palette.soft : palette.primary,
        alpha
      );
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawExecutionMap(
  ctx: CanvasRenderingContext2D,
  width: number,
  model: LayoutModel,
  time: number,
  palette: Palette,
  dark: boolean
) {
  const { core, domains, scale } = model;
  const compact = width < 820;
  const domainWidth = core.r * (compact ? 2.7 : 3.35);
  const domainHeight = core.r * (compact ? 2.15 : 2.55);
  const gate = {
    x: core.x - core.r * (compact ? 1.45 : 1.75),
    y: core.y,
  };
  const source = {
    x: core.x - core.r * (compact ? 2.4 : 3.85),
    y: core.y - core.r * 0.08,
  };

  ctx.save();
  ctx.globalCompositeOperation = dark ? "screen" : "multiply";

  const domainGlow = ctx.createRadialGradient(
    core.x,
    core.y,
    core.r * 0.1,
    core.x,
    core.y,
    domainWidth
  );
  domainGlow.addColorStop(0, rgba(palette.primary, dark ? 0.07 : 0.045));
  domainGlow.addColorStop(0.58, rgba(palette.primary, dark ? 0.035 : 0.024));
  domainGlow.addColorStop(1, rgba(palette.primary, 0));
  ctx.fillStyle = domainGlow;
  ctx.beginPath();
  ctx.ellipse(core.x, core.y, domainWidth, domainHeight, -0.06, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(palette.primary, dark ? 0.16 : 0.12);
  ctx.beginPath();
  ctx.ellipse(
    core.x,
    core.y,
    domainWidth * 0.72,
    domainHeight * 0.72,
    -0.06,
    0,
    Math.PI * 2
  );
  ctx.stroke();

  ctx.setLineDash([4, 12]);
  ctx.lineDashOffset = -time * 3.2;
  ctx.strokeStyle = rgba(palette.soft, dark ? 0.18 : 0.13);
  ctx.beginPath();
  ctx.ellipse(
    core.x,
    core.y,
    domainWidth * 0.48,
    domainHeight * 0.48,
    -0.06,
    0,
    Math.PI * 2
  );
  ctx.stroke();
  ctx.setLineDash([]);

  const laneStarts = [-0.42, -0.14, 0.14, 0.42].map(offset => ({
    x: source.x,
    y: source.y + offset * core.r,
  }));
  laneStarts.forEach((start, index) => {
    const laneGate = { x: gate.x, y: gate.y + (index - 1.5) * core.r * 0.19 };
    const laneCore = {
      x: core.x - core.r * 0.24,
      y: core.y + (index - 1.5) * core.r * 0.08,
    };
    ctx.strokeStyle = rgba(palette.primary, dark ? 0.1 : 0.075);
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(
      start.x + core.r * 0.7,
      start.y - core.r * 0.08,
      gate.x - core.r * 0.55,
      laneGate.y,
      laneGate.x,
      laneGate.y
    );
    ctx.bezierCurveTo(
      gate.x + core.r * 0.42,
      laneGate.y,
      core.x - core.r * 0.58,
      laneCore.y,
      laneCore.x,
      laneCore.y
    );
    ctx.stroke();

    for (let i = 0; i < 3; i += 1) {
      const progress = (time * 0.05 + i * 0.33 + index * 0.07) % 1;
      const x = lerp(start.x, laneCore.x, progress);
      const y =
        lerp(start.y, laneCore.y, progress) +
        Math.sin(progress * Math.PI) * core.r * 0.12;
      ctx.fillStyle = rgba(
        palette.soft,
        (dark ? 0.3 : 0.22) * Math.sin(progress * Math.PI)
      );
      ctx.beginPath();
      ctx.arc(x, y, 1.4 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  roundedRectPath(
    ctx,
    gate.x - 8 * scale,
    gate.y - core.r * 0.58,
    16 * scale,
    core.r * 1.16,
    8 * scale
  );
  ctx.fillStyle = rgba(palette.background, dark ? 0.34 : 0.54);
  ctx.fill();
  ctx.strokeStyle = rgba(palette.soft, dark ? 0.34 : 0.26);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  for (let i = 0; i < 4; i += 1) {
    ctx.fillStyle = rgba(palette.soft, dark ? 0.62 : 0.46);
    ctx.beginPath();
    ctx.arc(
      gate.x,
      gate.y + (i - 1.5) * core.r * 0.26,
      2.1 * scale,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  const blocked = domains.find(domain => domain.kind === "memory");
  if (blocked) {
    const edge = {
      x: blocked.x - core.r * 0.82,
      y: blocked.y + core.r * 0.18,
    };
    ctx.strokeStyle = rgba(palette.foreground, dark ? 0.16 : 0.13);
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 10]);
    ctx.beginPath();
    ctx.moveTo(blocked.x - core.r * 0.16, blocked.y + core.r * 0.12);
    ctx.lineTo(edge.x, edge.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = rgba(palette.soft, dark ? 0.32 : 0.24);
    ctx.beginPath();
    ctx.moveTo(edge.x - 6 * scale, edge.y - 6 * scale);
    ctx.lineTo(edge.x + 6 * scale, edge.y + 6 * scale);
    ctx.moveTo(edge.x + 6 * scale, edge.y - 6 * scale);
    ctx.lineTo(edge.x - 6 * scale, edge.y + 6 * scale);
    ctx.stroke();
  }

  if (!compact) {
    drawMicroLabel(
      ctx,
      source.x - 18 * scale,
      source.y - core.r * 0.86,
      "AGENT REQUEST",
      "context enters runtime",
      palette,
      dark
    );
    drawMicroLabel(
      ctx,
      gate.x - 42 * scale,
      gate.y - core.r * 0.98,
      "SIGNED SCOPE",
      "domain gate",
      palette,
      dark,
      "center"
    );
    drawMicroLabel(
      ctx,
      core.x,
      core.y + core.r * 1.24,
      "ISOLATED EXECUTION",
      "RAG · tools · memory · traces",
      palette,
      dark,
      "center"
    );
  }

  ctx.restore();
}

function layout(width: number, height: number): LayoutModel {
  const scale = clamp(Math.min(width / 1440, height / 900), 0.7, 1.08);
  const compact = width < 820;
  const core = {
    x: width * (compact ? 1.08 : 0.76),
    y: height * (compact ? 0.62 : 0.48),
    r: (compact ? 84 : 96) * scale,
  };

  const domains: Domain[] = [
    {
      kind: "rag",
      label: "RAG",
      x: core.x - (compact ? 126 : 260) * scale,
      y: core.y - (compact ? 132 : 148) * scale,
      phase: 0.1,
    },
    {
      kind: "tools",
      label: "MCP TOOLS",
      x: core.x + (compact ? 116 : 248) * scale,
      y: core.y - (compact ? 116 : 135) * scale,
      phase: 1.5,
    },
    {
      kind: "memory",
      label: "MEMORY",
      x: core.x - (compact ? 120 : 246) * scale,
      y: core.y + (compact ? 118 : 150) * scale,
      phase: 2.4,
    },
    {
      kind: "trace",
      label: "TRACES",
      x: core.x + (compact ? 114 : 244) * scale,
      y: core.y + (compact ? 114 : 146) * scale,
      phase: 3.2,
    },
  ];

  return { core, domains, scale };
}

function routeControls(
  from: Point,
  to: Point,
  index: number
): [Point, Point, Point, Point] {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const bend = index % 2 === 0 ? -46 : 46;
  return [
    from,
    { x: midX + bend, y: midY - 24 },
    { x: midX - bend * 0.5, y: midY + 28 },
    to,
  ];
}

function drawRoute(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  index: number,
  time: number,
  focus: number,
  palette: Palette,
  dark: boolean
) {
  const [p0, p1, p2, p3] = routeControls(from, to, index);

  ctx.save();
  ctx.globalCompositeOperation = dark ? "screen" : "multiply";
  ctx.lineCap = "round";

  const glow = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  glow.addColorStop(0, rgba(palette.primary, dark ? 0.015 : 0.012));
  glow.addColorStop(
    0.5,
    rgba(palette.primary, dark ? 0.1 + focus * 0.08 : 0.08 + focus * 0.05)
  );
  glow.addColorStop(
    0.56,
    rgba(palette.soft, dark ? 0.2 + focus * 0.15 : 0.16 + focus * 0.08)
  );
  glow.addColorStop(1, rgba(palette.primary, dark ? 0.015 : 0.012));

  ctx.strokeStyle = glow;
  ctx.lineWidth = 4.4 + focus * 1.1;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
  ctx.stroke();

  ctx.strokeStyle = rgba(
    palette.soft,
    dark ? 0.16 + focus * 0.14 : 0.12 + focus * 0.08
  );
  ctx.lineWidth = 1;
  ctx.setLineDash([7, 18]);
  ctx.lineDashOffset = -time * 7;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let i = 0; i < 4; i += 1) {
    const u = (i / 4 + time * 0.018 + index * 0.13) % 1;
    const p = cubicPoint(p0, p1, p2, p3, u);
    const envelope = Math.sin(u * Math.PI);
    ctx.fillStyle = rgba(
      palette.soft,
      (dark ? 0.09 + focus * 0.14 : 0.075 + focus * 0.08) * envelope
    );
    ctx.beginPath();
    ctx.arc(p.x, p.y, 0.85 + focus * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawSealGate(
  ctx: CanvasRenderingContext2D,
  point: Point,
  time: number,
  focus: number,
  phase: number,
  palette: Palette,
  dark: boolean
) {
  const radius = 23 + focus * 4;

  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(time * 0.25 + phase);
  ctx.globalCompositeOperation = dark ? "screen" : "multiply";

  ctx.strokeStyle = rgba(
    palette.soft,
    dark ? 0.2 + focus * 0.18 : 0.16 + focus * 0.1
  );
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([4, 9]);
  ctx.strokeStyle = rgba(
    palette.soft,
    dark ? 0.22 + focus * 0.16 : 0.18 + focus * 0.1
  );
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = rgba(
    palette.soft,
    dark ? 0.48 + focus * 0.18 : 0.36 + focus * 0.12
  );
  ctx.beginPath();
  ctx.arc(0, 0, 2.2 + focus * 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawDomainGlyph(
  ctx: CanvasRenderingContext2D,
  domain: Domain,
  time: number,
  focus: number,
  scale: number,
  palette: Palette,
  dark: boolean
) {
  const size = 40 * scale;

  ctx.save();
  ctx.translate(domain.x, domain.y);
  ctx.globalCompositeOperation = dark ? "screen" : "multiply";

  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 68 * scale);
  halo.addColorStop(
    0,
    rgba(palette.primary, dark ? 0.1 + focus * 0.05 : 0.08 + focus * 0.035)
  );
  halo.addColorStop(1, rgba(palette.primary, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 68 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = rgba(
    palette.soft,
    dark ? 0.2 + focus * 0.18 : 0.16 + focus * 0.1
  );
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(0, 0, 34 * scale, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = rgba(
    palette.primary,
    dark ? 0.15 + focus * 0.12 : 0.12 + focus * 0.08
  );
  ctx.beginPath();
  ctx.arc(0, 0, 49 * scale, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = rgba(
    palette.soft,
    dark ? 0.34 + focus * 0.18 : 0.25 + focus * 0.12
  );
  ctx.lineWidth = 1.2;

  if (domain.kind === "rag") {
    for (let y = -1; y <= 1; y += 1) {
      for (let x = -1; x <= 1; x += 1) {
        ctx.strokeRect(
          x * size * 0.25 - size * 0.07,
          y * size * 0.21 - size * 0.07,
          size * 0.14,
          size * 0.14
        );
      }
    }
  }

  if (domain.kind === "tools") {
    ctx.beginPath();
    ctx.moveTo(-size * 0.3, size * 0.16);
    ctx.lineTo(size * 0.2, -size * 0.24);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(size * 0.26, -size * 0.27, size * 0.09, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(size * 0.22, size * 0.2, size * 0.1, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (domain.kind === "memory") {
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.ellipse(
        0,
        (i - 1.5) * size * 0.15,
        size * 0.32,
        size * 0.075,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
  }

  if (domain.kind === "trace") {
    ctx.beginPath();
    for (let i = 0; i <= 20; i += 1) {
      const u = i / 20;
      const x = -size * 0.38 + u * size * 0.76;
      const y = Math.sin(u * Math.PI * 2.5 + time * 0.45) * size * 0.13;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-size * 0.38, size * 0.3);
    ctx.lineTo(size * 0.38, size * 0.3);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSealedCore(
  ctx: CanvasRenderingContext2D,
  core: LayoutModel["core"],
  time: number,
  focus: number,
  palette: Palette,
  dark: boolean
) {
  const { x, y, r } = core;

  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = dark ? "screen" : "multiply";

  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.05);
  glow.addColorStop(
    0,
    rgba(palette.soft, dark ? 0.15 + focus * 0.05 : 0.1 + focus * 0.03)
  );
  glow.addColorStop(
    0.42,
    rgba(palette.primary, dark ? 0.06 + focus * 0.03 : 0.045 + focus * 0.02)
  );
  glow.addColorStop(1, rgba(palette.primary, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.05, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 5; i += 1) {
    const radius = r * (0.72 + i * 0.22 + focus * 0.015);
    ctx.strokeStyle = rgba(
      i % 2 === 0 ? palette.soft : palette.primary,
      dark ? 0.16 - i * 0.018 + focus * 0.04 : 0.12 - i * 0.014 + focus * 0.025
    );
    ctx.lineWidth = i === 0 ? 1.5 : 0.9;
    ctx.setLineDash(i === 1 || i === 3 ? [8, 16] : []);
    ctx.lineDashOffset = -time * (5 + i * 1.4);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.save();
  ctx.rotate(time * 0.06);
  ctx.strokeStyle = rgba(
    palette.soft,
    dark ? 0.32 + focus * 0.1 : 0.24 + focus * 0.06
  );
  ctx.fillStyle = rgba(
    palette.primary,
    dark ? 0.07 + focus * 0.03 : 0.045 + focus * 0.02
  );
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const px = Math.cos(angle) * r * 0.52;
    const py = Math.sin(angle) * r * 0.52;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2 + time * 0.12;
    const px = Math.cos(angle) * r * 0.31;
    const py = Math.sin(angle) * r * 0.31;
    ctx.strokeStyle = rgba(
      palette.soft,
      dark ? 0.16 + focus * 0.08 : 0.12 + focus * 0.05
    );
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(px, py);
    ctx.stroke();

    ctx.fillStyle = rgba(
      palette.soft,
      dark ? 0.56 + focus * 0.12 : 0.42 + focus * 0.08
    );
    ctx.beginPath();
    ctx.arc(px, py, 1.9 + focus * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = rgba(palette.soft, dark ? 0.74 : 0.54);
  ctx.shadowColor = rgba(palette.soft, dark ? 0.62 : 0.2);
  ctx.shadowBlur = dark ? 18 + focus * 7 : 7 + focus * 3;
  ctx.beginPath();
  ctx.arc(0, 0, 4.2 + focus * 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawCursorField(
  ctx: CanvasRenderingContext2D,
  cursor: Point,
  active: number,
  palette: Palette,
  dark: boolean
) {
  if (active < 0.02 || cursor.x === OFFSCREEN) return;

  ctx.save();
  ctx.globalCompositeOperation = dark ? "screen" : "multiply";

  const glow = ctx.createRadialGradient(
    cursor.x,
    cursor.y,
    0,
    cursor.x,
    cursor.y,
    150
  );
  glow.addColorStop(0, rgba(palette.soft, (dark ? 0.1 : 0.075) * active));
  glow.addColorStop(
    0.35,
    rgba(palette.primary, (dark ? 0.04 : 0.028) * active)
  );
  glow.addColorStop(1, rgba(palette.primary, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cursor.x, cursor.y, 150, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function AgenticGrid() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const maybeContext = canvas.getContext("2d", { alpha: true });
    if (!maybeContext) return;
    const ctx: CanvasRenderingContext2D = maybeContext;

    const cursor = { current: { x: OFFSCREEN, y: OFFSCREEN } };
    const smooth = { current: { x: OFFSCREEN, y: OFFSCREEN } };
    const active = { current: 0 };
    const dark = {
      current: document.documentElement.classList.contains("dark"),
    };
    const reduced = {
      current: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
    const size = { current: { width: 0, height: 0, dpr: 1 } };
    const palette = {
      current: {
        background: tokenRgb(
          "--background",
          dark.current ? "#0a0a0a" : "#f5f5f5"
        ),
        foreground: tokenRgb(
          "--foreground",
          dark.current ? "#f5f5f5" : "#0a0a0a"
        ),
        primary: tokenRgb("--primary", PRIMARY_FALLBACK),
        soft: mixRgb(
          tokenRgb("--primary", PRIMARY_FALLBACK),
          tokenRgb("--foreground", dark.current ? "#f5f5f5" : "#0a0a0a"),
          dark.current ? 0.42 : 0.2
        ),
      } satisfies Palette,
    };
    let raf = 0;

    const updatePalette = () => {
      dark.current = document.documentElement.classList.contains("dark");
      const background = tokenRgb(
        "--background",
        dark.current ? "#0a0a0a" : "#f5f5f5"
      );
      const foreground = tokenRgb(
        "--foreground",
        dark.current ? "#f5f5f5" : "#0a0a0a"
      );
      const primary = tokenRgb("--primary", PRIMARY_FALLBACK);
      palette.current = {
        background,
        foreground,
        primary,
        soft: mixRgb(primary, foreground, dark.current ? 0.42 : 0.2),
      };
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;

      size.current = { width, height, dpr };
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onPointerMove = (event: PointerEvent) => {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (target?.closest("[data-no-grid]")) {
        active.current = Math.min(active.current, 0.12);
        return;
      }

      cursor.current = { x: event.clientX, y: event.clientY };
      active.current = 1;

      if (reduced.current) draw(performance.now());
    };

    const onPointerLeave = () => {
      active.current = 0;
      if (reduced.current) draw(performance.now());
    };

    function draw(now: number) {
      const { width, height, dpr } = size.current;
      if (!width || !height) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const time = reduced.current ? 14 : now / 1000;
      const currentPalette = palette.current;

      if (active.current > 0 && smooth.current.x === OFFSCREEN) {
        smooth.current = { ...cursor.current };
      }

      if (active.current > 0 && cursor.current.x !== OFFSCREEN) {
        smooth.current = {
          x: lerp(smooth.current.x, cursor.current.x, 0.1),
          y: lerp(smooth.current.y, cursor.current.y, 0.1),
        };
      }

      active.current = lerp(active.current, 0, 0.018);

      const model = layout(width, height);
      const { core, domains, scale } = model;
      const corePoint = { x: core.x, y: core.y };
      const coreFocus =
        Math.max(0, 1 - distance(smooth.current, corePoint) / 420) *
        active.current;

      drawBackground(ctx, width, height, currentPalette, dark.current);
      drawGrid(ctx, width, height, currentPalette, dark.current, time);
      drawDataPointField(
        ctx,
        width,
        height,
        model,
        time,
        smooth.current,
        active.current,
        currentPalette,
        dark.current
      );
      drawExecutionMap(ctx, width, model, time, currentPalette, dark.current);
      drawCursorField(
        ctx,
        smooth.current,
        active.current,
        currentPalette,
        dark.current
      );

      domains.forEach((domain, index) => {
        const domainPoint = { x: domain.x, y: domain.y };
        const focus =
          Math.max(
            Math.max(0, 1 - distance(smooth.current, domainPoint) / 260),
            Math.max(0, 1 - distance(smooth.current, corePoint) / 520) * 0.5
          ) * active.current;
        drawRoute(
          ctx,
          domainPoint,
          corePoint,
          index,
          time,
          focus,
          currentPalette,
          dark.current
        );
      });

      domains.forEach((domain, index) => {
        const domainPoint = { x: domain.x, y: domain.y };
        const gatePoint = {
          x: lerp(domain.x, core.x, 0.68),
          y: lerp(domain.y, core.y, 0.68),
        };
        const gateFocus =
          Math.max(0, 1 - distance(smooth.current, gatePoint) / 240) *
          active.current;
        const domainFocus =
          Math.max(0, 1 - distance(smooth.current, domainPoint) / 250) *
          active.current;
        drawSealGate(
          ctx,
          gatePoint,
          time,
          gateFocus,
          domain.phase + index,
          currentPalette,
          dark.current
        );
        drawDomainGlyph(
          ctx,
          domain,
          time,
          domainFocus,
          scale,
          currentPalette,
          dark.current
        );
      });

      drawSealedCore(ctx, core, time, coreFocus, currentPalette, dark.current);
    }

    const run = (now: number) => {
      draw(now);
      if (!reduced.current) {
        raf = requestAnimationFrame(run);
      }
    };

    const restartAnimation = () => {
      cancelAnimationFrame(raf);
      if (reduced.current) {
        draw(performance.now());
      } else {
        raf = requestAnimationFrame(run);
      }
    };

    const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
      reduced.current = event.matches;
      restartAnimation();
    };

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const observer = new MutationObserver(() => {
      updatePalette();
      if (reduced.current) draw(performance.now());
    });

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("blur", onPointerLeave);
    motionQuery.addEventListener("change", onMotionPreferenceChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    restartAnimation();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
      motionQuery.removeEventListener("change", onMotionPreferenceChange);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-background"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background/88 to-background/0" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-background/92 to-background/0" />
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background/80 to-background/0" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background/80 to-background/0" />
    </div>
  );
}
