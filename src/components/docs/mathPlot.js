const FUNCTIONS = {
  abs: { arity: 1, fn: Math.abs },
  sqrt: { arity: 1, fn: Math.sqrt },
  cbrt: { arity: 1, fn: Math.cbrt },
  exp: { arity: 1, fn: Math.exp },
  log: { arity: 1, fn: Math.log },
  ln: { arity: 1, fn: Math.log },
  log10: { arity: 1, fn: Math.log10 },
  sin: { arity: 1, fn: Math.sin },
  cos: { arity: 1, fn: Math.cos },
  tan: { arity: 1, fn: Math.tan },
  asin: { arity: 1, fn: Math.asin },
  acos: { arity: 1, fn: Math.acos },
  atan: { arity: 1, fn: Math.atan },
  sinh: { arity: 1, fn: Math.sinh },
  cosh: { arity: 1, fn: Math.cosh },
  tanh: { arity: 1, fn: Math.tanh },
  floor: { arity: 1, fn: Math.floor },
  ceil: { arity: 1, fn: Math.ceil },
  round: { arity: 1, fn: Math.round },
  sign: { arity: 1, fn: Math.sign },
  min: { variadic: true, fn: Math.min },
  max: { variadic: true, fn: Math.max },
  pow: { arity: 2, fn: Math.pow },
  sec: { arity: 1, fn: (x) => 1 / Math.cos(x) },
  csc: { arity: 1, fn: (x) => 1 / Math.sin(x) },
  cot: { arity: 1, fn: (x) => 1 / Math.tan(x) },
};

const CONSTANTS = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
};

function tokenize(source) {
  const normalized = String(source)
    .trim()
    .replace(/[−–—]/g, "-")
    .replace(/×/g, "*")
    .replace(/÷/g, "/");

  const tokens = [];
  let index = 0;

  while (index < normalized.length) {
    const ch = normalized[index];

    if (/\s/.test(ch)) {
      index += 1;
      continue;
    }

    const number = normalized
      .slice(index)
      .match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);

    if (number) {
      tokens.push({ type: "number", value: Number(number[0]) });
      index += number[0].length;
      continue;
    }

    const identifier = normalized
      .slice(index)
      .match(/^[A-Za-z_][A-Za-z0-9_]*/);

    if (identifier) {
      tokens.push({ type: "ident", value: identifier[0].toLowerCase() });
      index += identifier[0].length;
      continue;
    }

    if ("+-*/^(),".includes(ch)) {
      tokens.push({ type: ch, value: ch });
      index += 1;
      continue;
    }

    throw new Error(`Unsupported character: ${ch}`);
  }

  const result = [];
  const canEnd = (token) =>
    token &&
    (token.type === "number" || token.type === "ident" || token.type === ")");
  const canStart = (token) =>
    token &&
    (token.type === "number" || token.type === "ident" || token.type === "(");

  for (const token of tokens) {
    const previous = result[result.length - 1];
    const functionCall =
      previous?.type === "ident" &&
      token.type === "(" &&
      Boolean(FUNCTIONS[previous.value]);

    if (canEnd(previous) && canStart(token) && !functionCall) {
      result.push({ type: "*", value: "*" });
    }
    result.push(token);
  }

  return result;
}

function compileExpression(source) {
  const tokens = tokenize(source);
  let position = 0;

  const peek = () => tokens[position];
  const take = () => tokens[position++];
  const expect = (type) => {
    const token = take();
    if (!token || token.type !== type) {
      throw new Error(`Expected ${type}`);
    }
    return token;
  };

  function parseExpression() {
    let node = parseTerm();

    while (peek()?.type === "+" || peek()?.type === "-") {
      const op = take().type;
      node = { type: "binary", op, left: node, right: parseTerm() };
    }

    return node;
  }

  function parseTerm() {
    let node = parseUnary();

    while (peek()?.type === "*" || peek()?.type === "/") {
      const op = take().type;
      node = { type: "binary", op, left: node, right: parseUnary() };
    }

    return node;
  }

  function parseUnary() {
    if (peek()?.type === "+" || peek()?.type === "-") {
      const op = take().type;
      return { type: "unary", op, arg: parseUnary() };
    }

    return parsePower();
  }

  function parsePower() {
    const left = parsePrimary();

    if (peek()?.type === "^") {
      take();
      return {
        type: "binary",
        op: "^",
        left,
        right: parseUnary(),
      };
    }

    return left;
  }

  function parsePrimary() {
    const token = take();

    if (!token) {
      throw new Error("Unexpected end of expression");
    }

    if (token.type === "number") {
      return { type: "number", value: token.value };
    }

    if (token.type === "(") {
      const node = parseExpression();
      expect(")");
      return node;
    }

    if (token.type === "ident") {
      if (token.value === "x") {
        return { type: "x" };
      }

      if (Object.hasOwn(CONSTANTS, token.value)) {
        return { type: "number", value: CONSTANTS[token.value] };
      }

      const definition = FUNCTIONS[token.value];

      if (!definition) {
        throw new Error(`Unknown identifier: ${token.value}`);
      }

      expect("(");
      const args = [];

      if (peek()?.type !== ")") {
        while (true) {
          args.push(parseExpression());
          if (peek()?.type !== ",") break;
          take();
        }
      }

      expect(")");

      if (
        !definition.variadic &&
        args.length !== definition.arity
      ) {
        throw new Error(
          `${token.value} expects ${definition.arity} argument(s)`
        );
      }

      if (definition.variadic && args.length < 1) {
        throw new Error(`${token.value} expects at least one argument`);
      }

      return { type: "call", name: token.value, args };
    }

    throw new Error(`Unexpected token: ${token.type}`);
  }

  const ast = parseExpression();

  if (position !== tokens.length) {
    const token = tokens[position];
    throw new Error(`Unexpected token: ${token.value || token.type}`);
  }

  const evaluate = (node) => {
    switch (node.type) {
      case "number":
        return () => node.value;
      case "x":
        return (x) => x;
      case "unary": {
        const arg = evaluate(node.arg);
        return (x) => (node.op === "-" ? -arg(x) : arg(x));
      }
      case "binary": {
        const left = evaluate(node.left);
        const right = evaluate(node.right);

        return (x) => {
          const a = left(x);
          const b = right(x);

          switch (node.op) {
            case "+":
              return a + b;
            case "-":
              return a - b;
            case "*":
              return a * b;
            case "/":
              return a / b;
            case "^":
              return Math.pow(a, b);
            default:
              return NaN;
          }
        };
      }
      case "call": {
        const args = node.args.map(evaluate);
        const fn = FUNCTIONS[node.name].fn;
        return (x) => fn(...args.map((arg) => arg(x)));
      }
      default:
        return () => NaN;
    }
  };

  return evaluate(ast);
}

function parseSource(source) {
  let xDomain = [-10, 10];
  let yDomain = [-10, 10];
  let height = 360;
  let grid = true;
  let title = "";
  const functions = [];

  String(source)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .forEach((rawLine) => {
      const line = rawLine.trim();

      if (!line || line.startsWith("#") || line.startsWith("//")) return;

      const range = line.match(
        /^([xy])\s*[:=]\s*(-?(?:\d+(?:\.\d*)?|\.\d+))\s*\.\.\s*(-?(?:\d+(?:\.\d*)?|\.\d+))$/i
      );

      if (range) {
        const min = Number(range[2]);
        const max = Number(range[3]);

        if (Number.isFinite(min) && Number.isFinite(max) && min < max) {
          if (range[1].toLowerCase() === "x") {
            xDomain = [min, max];
          } else {
            yDomain = [min, max];
          }
        }

        return;
      }

      const option = line.match(/^(height|grid|title)\s*[:=]\s*(.+)$/i);

      if (option) {
        const key = option[1].toLowerCase();
        const value = option[2].trim();

        if (key === "height") {
          const nextHeight = Number(value);
          if (Number.isFinite(nextHeight)) {
            height = Math.max(220, Math.min(640, nextHeight));
          }
        } else if (key === "grid") {
          grid = !/^(false|0|off|no)$/i.test(value);
        } else {
          title = value;
        }

        return;
      }

      const functionLine = line.match(/^(?:y|f(?:\d+)?)\s*=\s*(.+)$/i);
      const expression = (functionLine ? functionLine[1] : line).trim();

      if (expression) functions.push(expression);
    });

  return { xDomain, yDomain, height, grid, title, functions };
}

function niceStep(range, targetTicks = 8) {
  const rough = Math.abs(range) / Math.max(2, targetTicks);
  if (!Number.isFinite(rough) || rough <= 0) return 1;

  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / power;
  const factor = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;

  return factor * power;
}

function formatTick(value, step) {
  const decimals = Math.max(
    0,
    Math.min(6, Math.ceil(-Math.log10(Math.abs(step || 1))) + 1)
  );
  const rounded = Number(value.toFixed(decimals));

  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function escapeMarkup(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSvg(plot, width, zoom = 1) {
  const safeWidth = Math.max(280, Math.round(width));
  const safeHeight = Math.max(220, Math.round(plot.height || 360));
  const margin = {
    top: plot.title ? 46 : 24,
    right: 20,
    bottom: 44,
    left: 54,
  };
  const innerWidth = Math.max(140, safeWidth - margin.left - margin.right);
  const innerHeight = Math.max(
    120,
    safeHeight - margin.top - margin.bottom
  );

  const centerX = (plot.xDomain[0] + plot.xDomain[1]) / 2;
  const centerY = (plot.yDomain[0] + plot.yDomain[1]) / 2;
  const halfX = (plot.xDomain[1] - plot.xDomain[0]) / (2 * zoom);
  const halfY = (plot.yDomain[1] - plot.yDomain[0]) / (2 * zoom);
  const xMin = centerX - halfX;
  const xMax = centerX + halfX;
  const yMin = centerY - halfY;
  const yMax = centerY + halfY;

  const sx = (x) =>
    margin.left + ((x - xMin) / (xMax - xMin)) * innerWidth;
  const sy = (y) =>
    margin.top + ((yMax - y) / (yMax - yMin)) * innerHeight;

  const xStep = niceStep(xMax - xMin);
  const yStep = niceStep(yMax - yMin);

  const grid = [];

  if (plot.grid) {
    for (
      let x = Math.ceil(xMin / xStep) * xStep;
      x <= xMax + xStep * 0.001;
      x += xStep
    ) {
      const px = sx(x);
      if (px > margin.left && px < safeWidth - margin.right) {
        grid.push(
          `<line x1="${px}" y1="${margin.top}" x2="${px}" y2="${margin.top + innerHeight}" class="doc-math-grid-line"/>`
        );
      }
    }

    for (
      let y = Math.ceil(yMin / yStep) * yStep;
      y <= yMax + yStep * 0.001;
      y += yStep
    ) {
      const py = sy(y);
      if (py > margin.top && py < margin.top + innerHeight) {
        grid.push(
          `<line x1="${margin.left}" y1="${py}" x2="${margin.left + innerWidth}" y2="${py}" class="doc-math-grid-line"/>`
        );
      }
    }
  }

  const ticks = [];

  for (
    let x = Math.ceil(xMin / xStep) * xStep;
    x <= xMax + xStep * 0.001;
    x += xStep
  ) {
    const px = sx(x);

    if (px >= margin.left - 1 && px <= safeWidth - margin.right + 1) {
      ticks.push(
        `<text x="${px}" y="${margin.top + innerHeight + 25}" text-anchor="middle" class="doc-math-tick-label">${escapeMarkup(formatTick(x, xStep))}</text>`
      );
    }
  }

  for (
    let y = Math.ceil(yMin / yStep) * yStep;
    y <= yMax + yStep * 0.001;
    y += yStep
  ) {
    const py = sy(y);

    if (py >= margin.top - 1 && py <= margin.top + innerHeight + 1) {
      ticks.push(
        `<text x="${margin.left - 9}" y="${py + 4}" text-anchor="end" class="doc-math-tick-label">${escapeMarkup(formatTick(y, yStep))}</text>`
      );
    }
  }

  const axes = [];

  if (xMin <= 0 && xMax >= 0) {
    const px = sx(0);
    axes.push(
      `<line x1="${px}" y1="${margin.top}" x2="${px}" y2="${margin.top + innerHeight}" class="doc-math-axis"/>`
    );
  }

  if (yMin <= 0 && yMax >= 0) {
    const py = sy(0);
    axes.push(
      `<line x1="${margin.left}" y1="${py}" x2="${margin.left + innerWidth}" y2="${py}" class="doc-math-axis"/>`
    );
  }

  const colors = [
    "var(--doc-math-plot-1)",
    "var(--doc-math-plot-2)",
    "var(--doc-math-plot-3)",
    "var(--doc-math-plot-4)",
    "var(--doc-math-plot-5)",
  ];

  const paths = [];
  const legend = [];
  const samples = Math.max(500, Math.min(1200, Math.round(innerWidth * 2)));

  plot.functions.forEach((source, index) => {
    let fn;

    try {
      fn = compileExpression(source);
    } catch {
      legend.push(
        `<span class="doc-math-legend-item is-error"><i></i>${escapeMarkup(source)} — invalid</span>`
      );
      return;
    }

    const segments = [];
    let path = "";
    let previousY = null;

    for (let sample = 0; sample <= samples; sample += 1) {
      const x = xMin + ((xMax - xMin) * sample) / samples;
      let y = NaN;

      try {
        y = fn(x);
      } catch {
        y = NaN;
      }

      const finite = Number.isFinite(y);
      const outside =
        finite &&
        (y < yMin - (yMax - yMin) * 2 ||
          y > yMax + (yMax - yMin) * 2);

      if (!finite || outside) {
        if (path) segments.push(path);
        path = "";
        previousY = null;
        continue;
      }

      if (
        previousY !== null &&
        Math.abs(y - previousY) > (yMax - yMin) * 1.25
      ) {
        if (path) segments.push(path);
        path = "";
      }

      const px = sx(x);
      const py = sy(y);

      path += path
        ? ` L ${px.toFixed(2)} ${py.toFixed(2)}`
        : `M ${px.toFixed(2)} ${py.toFixed(2)}`;

      previousY = y;
    }

    if (path) segments.push(path);

    segments.forEach((segment) => {
      paths.push(
        `<path d="${segment}" class="doc-math-function" style="stroke:${colors[index % colors.length]}"/>`
      );
    });

    legend.push(
      `<span class="doc-math-legend-item"><i style="background:${colors[index % colors.length]}"></i>${escapeMarkup(source)}</span>`
    );
  });

  const title = plot.title
    ? `<text x="${margin.left}" y="23" class="doc-math-title">${escapeMarkup(plot.title)}</text>`
    : "";

  return `
    <svg
      class="doc-math-svg"
      viewBox="0 0 ${safeWidth} ${safeHeight}"
      data-plot-width="${safeWidth}"
      data-plot-height="${safeHeight}"
      role="img"
      aria-label="${escapeMarkup(plot.title || "Two-dimensional mathematical function plot")}"
    >
      <rect x="${margin.left}" y="${margin.top}" width="${innerWidth}" height="${innerHeight}" class="doc-math-plot-bg"/>
      ${grid.join("")}
      ${axes.join("")}
      ${ticks.join("")}
      ${paths.join("")}
      <rect x="${margin.left}" y="${margin.top}" width="${innerWidth}" height="${innerHeight}" class="doc-math-frame"/>
      ${title}
    </svg>
    <div class="doc-math-legend">${legend.join("")}</div>
  `;
}

function parseAndRender(source, target, plotShell, zoom = 1) {
  const plot = parseSource(source);

  if (!plot.functions.length) {
    target.innerHTML =
      '<div class="doc-math-plot-error">No function was found. Add one expression such as <code>y = x^2</code>.</div>';
    return plot;
  }

  const width = target.clientWidth || plotShell.clientWidth || 720;
  target.innerHTML = buildSvg(plot, width, zoom);
  return plot;
}

export function wireMathPlots(root) {
  const nodes = Array.from(root.querySelectorAll("[data-math-plot]"));

  return nodes.map((node) => {
    const source = node.querySelector(".doc-math-plot-source");
    const target = node.querySelector(".doc-math-plot-render");

    if (!source || !target) return () => {};

    const raw = source.textContent || "";
    const zoomState = { value: 1 };
    let resizeObserver = null;

    const render = () => {
      const plot = parseAndRender(raw, target, node, zoomState.value);

      if (plot.functions.length) {
        source.hidden = true;
        node.classList.remove("is-error");
      } else {
        source.hidden = false;
        node.classList.add("is-error");
      }
    };

    const onPointerMove = (event) => {
      const svg = target.querySelector("svg");
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const viewWidth = Number(svg.getAttribute("data-plot-width")) || 720;
      const viewHeight = Number(svg.getAttribute("data-plot-height")) || 360;
      const scaleX = rect.width / viewWidth;
      const scaleY = rect.height / viewHeight;
      const viewX = (event.clientX - rect.left) / Math.max(scaleX, 0.0001);
      const viewY = (event.clientY - rect.top) / Math.max(scaleY, 0.0001);
      const plot = parseSource(raw);
      const marginTop = plot.title ? 46 : 24;
      const margin = { left: 54, right: 20, top: marginTop, bottom: 44 };

      if (
        viewX < margin.left ||
        viewX > viewWidth - margin.right ||
        viewY < margin.top ||
        viewY > viewHeight - margin.bottom
      ) {
        node.classList.remove("is-hovering");
        return;
      }

      const centerX = (plot.xDomain[0] + plot.xDomain[1]) / 2;
      const centerY = (plot.yDomain[0] + plot.yDomain[1]) / 2;
      const halfX =
        (plot.xDomain[1] - plot.xDomain[0]) / (2 * zoomState.value);
      const halfY =
        (plot.yDomain[1] - plot.yDomain[0]) / (2 * zoomState.value);
      const xMin = centerX - halfX;
      const xMax = centerX + halfX;
      const yMin = centerY - halfY;
      const yMax = centerY + halfY;
      const innerWidth = viewWidth - margin.left - margin.right;
      const innerHeight = viewHeight - margin.top - margin.bottom;
      const x =
        xMin + ((viewX - margin.left) / Math.max(innerWidth, 1)) * (xMax - xMin);
      const y =
        yMax - ((viewY - margin.top) / Math.max(innerHeight, 1)) * (yMax - yMin);

      let tooltip = node.querySelector(".doc-math-plot-tooltip");

      if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.className = "doc-math-plot-tooltip";
        node.appendChild(tooltip);
      }

      tooltip.textContent = `x = ${x.toFixed(3)} · y = ${y.toFixed(3)}`;
      tooltip.style.left = `${Math.min(Math.max(event.clientX - rect.left + 12, 8), rect.width - 150)}px`;
      tooltip.style.top = `${Math.min(Math.max(event.clientY - rect.top + 12, 8), rect.height - 30)}px`;
      node.classList.add("is-hovering");
    };

    const onPointerLeave = () => node.classList.remove("is-hovering");

    render();

    const controls = document.createElement("div");
    controls.className = "doc-math-plot-controls";
    controls.innerHTML =
      '<button type="button" data-plot-zoom-out aria-label="Zoom out">−</button>' +
      '<button type="button" data-plot-reset aria-label="Reset zoom">Reset</button>' +
      '<button type="button" data-plot-zoom-in aria-label="Zoom in">+</button>';

    const controlHandler = (event) => {
      const button = event.target.closest("button");
      if (!button) return;

      if (button.hasAttribute("data-plot-reset")) {
        zoomState.value = 1;
      } else if (button.hasAttribute("data-plot-zoom-in")) {
        zoomState.value = Math.min(8, zoomState.value * 1.4);
      } else if (button.hasAttribute("data-plot-zoom-out")) {
        zoomState.value = Math.max(0.25, zoomState.value / 1.4);
      }

      render();
    };

    controls.addEventListener("click", controlHandler);
    node.querySelector(".doc-math-plot-header")?.appendChild(controls);
    target.addEventListener("pointermove", onPointerMove);
    target.addEventListener("pointerleave", onPointerLeave);

    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(() => render());
      resizeObserver.observe(target);
    }

    requestAnimationFrame(render);

    return () => {
      controls.removeEventListener("click", controlHandler);
      controls.remove();
      target.removeEventListener("pointermove", onPointerMove);
      target.removeEventListener("pointerleave", onPointerLeave);
      resizeObserver?.disconnect();
      node.querySelector(".doc-math-plot-tooltip")?.remove();
    };
  });
}

export { compileExpression, parseSource };
