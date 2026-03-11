document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("startBtn");
  const svg = document.querySelector("svg.maze");
  const solution = document.getElementById("solution");
  const player = document.getElementById("player");
  const goal = document.getElementById("goal");

  if (!btn || !svg || !solution || !player || !goal) {
    console.error("Manjka startBtn / svg.maze / #solution / #player / #goal");
    return;
  }

  solution.style.opacity = "0";

  const hud = document.createElement("div");
  hud.className = "hud";
  document.body.appendChild(hud);

  function setHud(text) {
    hud.textContent = text;
  }

  const GRID = 16;
  const OFFSET = 10;
  const ROWS = 30;
  const COLS = 30;

  const START = { col: 14, row: 0 };
  const GOAL = { col: 15, row: 29 };

  let modalOpen = false;
  let running = false;
  let goalUnlocked = false;
  let ghostMode = false;

  let keysToCollect = [];
  let collected = 0;

  let currentCell = { ...START };
  let moving = false;
  let moveFrom = null;
  let moveTo = null;
  let moveProgress = 0;
  const MOVE_DURATION = 140;

  const pressedKeys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
  };

  let keyQueue = [];

  function cellToPoint(col, row) {
    return {
      x: OFFSET + col * GRID,
      y: OFFSET + row * GRID,
    };
  }

  function sameCell(a, b) {
    return a.col === b.col && a.row === b.row;
  }

  function cellKey(col, row) {
    return `${col},${row}`;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

function drawLockedDoor() {
  goal.innerHTML = "";

  const door = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  door.setAttribute("x", "-9");
  door.setAttribute("y", "-11");
  door.setAttribute("width", "18");
  door.setAttribute("height", "22");
  door.setAttribute("rx", "2");
  door.setAttribute("fill", "#5f6973");
  door.setAttribute("stroke", "#2b3138");
  door.setAttribute("stroke-width", "2");

  goal.appendChild(door);

  // navpične rešetke
  for (let i = -6; i <= 6; i += 4) {
    const bar = document.createElementNS("http://www.w3.org/2000/svg", "line");
    bar.setAttribute("x1", i);
    bar.setAttribute("y1", "-11");
    bar.setAttribute("x2", i);
    bar.setAttribute("y2", "11");
    bar.setAttribute("stroke", "#c9d1d8");
    bar.setAttribute("stroke-width", "1.6");
    goal.appendChild(bar);
  }


  const cross = document.createElementNS("http://www.w3.org/2000/svg", "line");
  cross.setAttribute("x1", "-9");
  cross.setAttribute("y1", "-2");
  cross.setAttribute("x2", "9");
  cross.setAttribute("y2", "-2");
  cross.setAttribute("stroke", "#aeb6bd");
  cross.setAttribute("stroke-width", "1.5");

  goal.appendChild(cross);


  const lock = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  lock.setAttribute("x", "-2");
  lock.setAttribute("y", "3");
  lock.setAttribute("width", "4");
  lock.setAttribute("height", "5");
  lock.setAttribute("rx", "1");
  lock.setAttribute("fill", "#d6b34b");
  lock.setAttribute("stroke", "#6a5318");
  lock.setAttribute("stroke-width", "1");

  goal.appendChild(lock);

  goal.setAttribute("opacity", "0.9");
}

  function drawUnlockedDoor() {
  goal.innerHTML = "";
  goal.style.display = "none";

  const door = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  door.setAttribute("x", "-9");
  door.setAttribute("y", "-11");
  door.setAttribute("width", "18");
  door.setAttribute("height", "22");
  door.setAttribute("rx", "2");
  door.setAttribute("fill", "#7d8a96");
  door.setAttribute("stroke", "#2b3138");
  door.setAttribute("stroke-width", "2");

  goal.appendChild(door);

  // rešetke
  for (let i = -6; i <= 6; i += 4) {
    const bar = document.createElementNS("http://www.w3.org/2000/svg", "line");
    bar.setAttribute("x1", i);
    bar.setAttribute("y1", "-11");
    bar.setAttribute("x2", i);
    bar.setAttribute("y2", "11");
    bar.setAttribute("stroke", "#e1e6eb");
    bar.setAttribute("stroke-width", "1.6");
    goal.appendChild(bar);
  }

  // odprta ključavnica
  const opening = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  opening.setAttribute("cx", "0");
  opening.setAttribute("cy", "5");
  opening.setAttribute("r", "2");
  opening.setAttribute("fill", "#d6b34b");

  goal.appendChild(opening);

  goal.setAttribute("opacity", "1");
}

  function lockGoal() {
    goalUnlocked = false;
    hud.classList.remove("hud--done", "hud--pulse");
    drawLockedDoor();
  }

  function unlockGoal() {
    goalUnlocked = true;
    drawUnlockedDoor();

    goal.style.transition = "transform 0.2s ease";
    goal.style.transformOrigin = "center";
    goal.style.transform = "scale(1.2)";

    setTimeout(() => {
      goal.style.transform = "scale(1)";
    }, 200);

    setHud("VSI KLJUČI POBRANI! ODKLENI IZHOD");
    hud.classList.add("hud--done", "hud--pulse");

    setTimeout(() => {
      hud.classList.remove("hud--pulse");
    }, 700);
  }

  let stepToggle = false;
let lastFootprintX = null;
let lastFootprintY = null;

function resetTrail() {
  stepToggle = false;
  lastFootprintX = null;
  lastFootprintY = null;
}

function addTrail(x, y) {
  if (
    lastFootprintX !== null &&
    Math.hypot(x - lastFootprintX, y - lastFootprintY) < 10
  ) {
    return;
  }

  stepToggle = !stepToggle;

  const offsetX = stepToggle ? -2.2 : 2.2;
  const offsetY = 0.8;

  const footprint = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
  footprint.setAttribute("cx", x + offsetX);
  footprint.setAttribute("cy", y + offsetY);
  footprint.setAttribute("rx", "1.4");
  footprint.setAttribute("ry", "2.4");
  footprint.setAttribute("fill", "#3f4348");
  footprint.setAttribute("opacity", "0.55");
  footprint.style.pointerEvents = "none";

  svg.insertBefore(footprint, player);

  lastFootprintX = x;
  lastFootprintY = y;

  setTimeout(() => {
    footprint.remove();
  }, 2500);
}

 function setPlayer(x, y) {
  player.setAttribute("transform", `translate(${x},${y})`);
  addTrail(x, y);
}

function placePlayerOnCell(cell) {
  const p = cellToPoint(cell.col, cell.row);
  player.setAttribute("transform", `translate(${p.x},${p.y})`);
  addTrail(p.x, p.y);
}

  function clearKeys() {
    for (const item of keysToCollect) {
      item.el.remove();
    }
    keysToCollect = [];
    collected = 0;
  }

  function makeKey(x, y) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", `translate(${x}, ${y})`);
    g.style.pointerEvents = "none";

    const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    ring.setAttribute("cx", "-3");
    ring.setAttribute("cy", "0");
    ring.setAttribute("r", "4");
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", "#d6b34b");
    ring.setAttribute("stroke-width", "2");

    const shaft = document.createElementNS("http://www.w3.org/2000/svg", "line");
    shaft.setAttribute("x1", "1");
    shaft.setAttribute("y1", "0");
    shaft.setAttribute("x2", "8");
    shaft.setAttribute("y2", "0");
    shaft.setAttribute("stroke", "#d6b34b");
    shaft.setAttribute("stroke-width", "2");

    const tooth1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    tooth1.setAttribute("x1", "5");
    tooth1.setAttribute("y1", "0");
    tooth1.setAttribute("x2", "5");
    tooth1.setAttribute("y2", "3");
    tooth1.setAttribute("stroke", "#d6b34b");
    tooth1.setAttribute("stroke-width", "2");

    const tooth2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    tooth2.setAttribute("x1", "8");
    tooth2.setAttribute("y1", "0");
    tooth2.setAttribute("x2", "8");
    tooth2.setAttribute("y2", "2");
    tooth2.setAttribute("stroke", "#d6b34b");
    tooth2.setAttribute("stroke-width", "2");

    g.appendChild(ring);
    g.appendChild(shaft);
    g.appendChild(tooth1);
    g.appendChild(tooth2);

    svg.insertBefore(g, player);
    return g;
  }

  function lineKey(x1, y1, x2, y2) {
    const a = `${x1},${y1}`;
    const b = `${x2},${y2}`;
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  function getMazeLines() {
    const g = svg.querySelector("g");
    if (!g) return [];
    return Array.from(g.querySelectorAll("line")).map(line => ({
      x1: parseFloat(line.getAttribute("x1")),
      y1: parseFloat(line.getAttribute("y1")),
      x2: parseFloat(line.getAttribute("x2")),
      y2: parseFloat(line.getAttribute("y2")),
    }));
  }

  const wallSet = new Set();

  function addSegmentWall(x1, y1, x2, y2) {
    wallSet.add(lineKey(x1, y1, x2, y2));
  }

  function buildWallSet() {
    wallSet.clear();

    const lines = getMazeLines();

    for (const l of lines) {
      if (Math.abs(l.y1 - l.y2) < 0.001) {
        const y = l.y1;
        const minX = Math.min(l.x1, l.x2);
        const maxX = Math.max(l.x1, l.x2);

        for (let x = minX; x < maxX - 0.001; x += GRID) {
          addSegmentWall(x, y, x + GRID, y);
        }
      } else if (Math.abs(l.x1 - l.x2) < 0.001) {
        const x = l.x1;
        const minY = Math.min(l.y1, l.y2);
        const maxY = Math.max(l.y1, l.y2);

        for (let y = minY; y < maxY - 0.001; y += GRID) {
          addSegmentWall(x, y, x, y + GRID);
        }
      }
    }
  }

  function hasHorizontalWall(x1, x2, y) {
    return wallSet.has(lineKey(x1, y, x2, y));
  }

  function hasVerticalWall(x, y1, y2) {
    return wallSet.has(lineKey(x, y1, x, y2));
  }

  function canMove(col, row, dir) {
    if (ghostMode) {
      if (dir === "up") return row > 0;
      if (dir === "down") return row < ROWS - 1;
      if (dir === "left") return col > 0;
      if (dir === "right") return col < COLS - 1;
      return false;
    }

    if (dir === "up") {
      if (row <= 0) return false;
      const y = 2 + row * GRID;
      const x1 = 2 + col * GRID;
      const x2 = x1 + GRID;
      return !hasHorizontalWall(x1, x2, y);
    }

    if (dir === "down") {
      if (row >= ROWS - 1) return false;
      const y = 2 + (row + 1) * GRID;
      const x1 = 2 + col * GRID;
      const x2 = x1 + GRID;
      return !hasHorizontalWall(x1, x2, y);
    }

    if (dir === "left") {
      if (col <= 0) return false;
      const x = 2 + col * GRID;
      const y1 = 2 + row * GRID;
      const y2 = y1 + GRID;
      return !hasVerticalWall(x, y1, y2);
    }

    if (dir === "right") {
      if (col >= COLS - 1) return false;
      const x = 2 + (col + 1) * GRID;
      const y1 = 2 + row * GRID;
      const y2 = y1 + GRID;
      return !hasVerticalWall(x, y1, y2);
    }

    return false;
  }

  function getNeighbors(cell) {
    const result = [];

    if (canMove(cell.col, cell.row, "up")) {
      result.push({ col: cell.col, row: cell.row - 1 });
    }
    if (canMove(cell.col, cell.row, "down")) {
      result.push({ col: cell.col, row: cell.row + 1 });
    }
    if (canMove(cell.col, cell.row, "left")) {
      result.push({ col: cell.col - 1, row: cell.row });
    }
    if (canMove(cell.col, cell.row, "right")) {
      result.push({ col: cell.col + 1, row: cell.row });
    }

    return result;
  }

  function getReachableCells(startCell) {
    const visited = new Set();
    const queue = [startCell];
    const result = [];

    visited.add(cellKey(startCell.col, startCell.row));

    while (queue.length) {
      const current = queue.shift();
      result.push(current);

      for (const neighbor of getNeighbors(current)) {
        const k = cellKey(neighbor.col, neighbor.row);
        if (!visited.has(k)) {
          visited.add(k);
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  function spawnRandomKeys(count) {
    clearKeys();

    const reachable = getReachableCells(START).filter(cell => {
      return !sameCell(cell, START) && !sameCell(cell, GOAL);
    });

    const selected = shuffle(reachable).slice(0, Math.min(count, reachable.length));

    for (const cell of selected) {
      const p = cellToPoint(cell.col, cell.row);
      const el = makeKey(p.x, p.y);

      keysToCollect.push({
        el,
        x: p.x,
        y: p.y,
        col: cell.col,
        row: cell.row,
      });
    }

    setHud(`KLJUČI: 0 / ${keysToCollect.length}`);
  }

 function collectKeysIfTouching() {
  const transform = player.getAttribute("transform") || "translate(0,0)";
  const match = transform.match(/translate\(([-\d.]+),([-\d.]+)\)/);

  const px = match ? parseFloat(match[1]) : 0;
  const py = match ? parseFloat(match[2]) : 0;

  const TOUCH_DIST = 8;
  let changed = false;

  keysToCollect = keysToCollect.filter(item => {
    const hit = Math.hypot(px - item.x, py - item.y) <= TOUCH_DIST;
    if (hit) {
      item.el.remove();
      collected++;
      changed = true;
      return false;
    }
    return true;
  });

  if (changed && !goalUnlocked) {
    if (ghostMode) {
      setHud(`CHEAT MODE | KLJUČI: ${collected} / ${collected + keysToCollect.length}`);
    } else {
      setHud(`KLJUČI: ${collected} / ${collected + keysToCollect.length}`);
    }
  }

  if (!goalUnlocked && keysToCollect.length === 0) {
    unlockGoal();
  }
}

  function checkWin() {
  if (!goalUnlocked) return false;

  const transform = player.getAttribute("transform") || "translate(0,0)";
  const match = transform.match(/translate\(([-\d.]+),([-\d.]+)\)/);

  const px = match ? parseFloat(match[1]) : 0;
  const py = match ? parseFloat(match[2]) : 0;

  const gx = parseFloat(goal.getAttribute("data-x"));
  const gy = parseFloat(goal.getAttribute("data-y"));

  const winDistance = 10;
  const onGoal = Math.hypot(px - gx, py - gy) <= winDistance;

  if (!onGoal) return false;

  running = false;
  modalOpen = true;
  moving = false;
  keyQueue = [];

  if (typeof Swal === "undefined") {
    alert("Uspeh! Pobral si vse ključe in odklenil izhod!");
    location.reload();
    return true;
  }

  Swal.fire({
    title: "POBEG USPEL!",
    text: "Pobral si vse ključe in odklenil izhod!",
    icon: "success",
    confirmButtonText: "Igraj znova",
    buttonsStyling: false,
    customClass: {
      popup: "prison-popup",
      title: "prison-title",
      htmlContainer: "prison-text",
      confirmButton: "prison-confirm btn"
    },
    focusConfirm: false,
    allowOutsideClick: false,
    allowEscapeKey: false,
    scrollbarPadding: false,
    heightAuto: false
  }).then(() => {
    modalOpen = false;
    location.reload();
  });

  return true;
}

  function directionFromKey(key) {
    if (key === "ArrowUp") return "up";
    if (key === "ArrowDown") return "down";
    if (key === "ArrowLeft") return "left";
    if (key === "ArrowRight") return "right";
    return null;
  }

  function nextCellFromDirection(cell, dir) {
    if (dir === "up") return { col: cell.col, row: cell.row - 1 };
    if (dir === "down") return { col: cell.col, row: cell.row + 1 };
    if (dir === "left") return { col: cell.col - 1, row: cell.row };
    if (dir === "right") return { col: cell.col + 1, row: cell.row };
    return { ...cell };
  }

  function getWantedDirection() {
    for (let i = keyQueue.length - 1; i >= 0; i--) {
      const key = keyQueue[i];
      if (pressedKeys[key]) return directionFromKey(key);
    }
    return null;
  }

  function tryStartMove() {
    if (!running || moving) return;

    const dir = getWantedDirection();
    if (!dir) return;

    if (!canMove(currentCell.col, currentCell.row, dir)) return;

    moveFrom = { ...currentCell };
    moveTo = nextCellFromDirection(currentCell, dir);
    moveProgress = 0;
    moving = true;
  }

  function startGame() {
    running = true;
    modalOpen = false;
    moving = false;
    moveFrom = null;
    moveTo = null;
    moveProgress = 0;
    keyQueue = [];

    for (const key of Object.keys(pressedKeys)) {
      pressedKeys[key] = false;
    }

    resetTrail();
    lockGoal();
    spawnRandomKeys(5);

    currentCell = { ...START };
    placePlayerOnCell(currentCell);
    collectKeysIfTouching();

    if (ghostMode) {
      setHud(`CHEAT MODE | KLJUČI: ${collected} / ${collected + keysToCollect.length}`);
    } else {
      setHud(`KLJUČI: ${collected} / ${collected + keysToCollect.length}`);
    }
  }

  let lastTime = null;

  function animate(timestamp) {
    requestAnimationFrame(animate);

    if (!running) {
      lastTime = timestamp;
      return;
    }

    if (lastTime == null) {
      lastTime = timestamp;
      return;
    }

    const dt = timestamp - lastTime;
    lastTime = timestamp;

    if (!moving) {
      tryStartMove();
      return;
    }

    moveProgress += dt / MOVE_DURATION;
    const t = clamp(moveProgress, 0, 1);

    const a = cellToPoint(moveFrom.col, moveFrom.row);
    const b = cellToPoint(moveTo.col, moveTo.row);

    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    setPlayer(x, y);

    if (t >= 1) {
      currentCell = { ...moveTo };
      moving = false;
      moveFrom = null;
      moveTo = null;
      moveProgress = 0;

      collectKeysIfTouching();
      if (checkWin()) return;

      tryStartMove();
    }
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "F4") {
      e.preventDefault();
      ghostMode = !ghostMode;

      if (ghostMode) {
        if (running) {
          setHud(`CHEAT MODE | KLJUČI: ${collected} / ${collected + keysToCollect.length}`);
        } else {
          setHud("CHEAT MODE vklopljen — klikni START");
        }
      } else {
        if (running) {
          if (goalUnlocked) {
            setHud("VSI KLJUČI POBRANI! ODKLENI IZHOD");
          } else {
            setHud(`KLJUČI: ${collected} / ${collected + keysToCollect.length}`);
          }
        } else {
          setHud("Klikni START in poberi 5 ključev");
        }
      }
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(pressedKeys, e.key)) return;
    e.preventDefault();
    if (modalOpen) return;

    if (!pressedKeys[e.key]) {
      keyQueue.push(e.key);
    }

    pressedKeys[e.key] = true;

    if (running && !moving) {
      tryStartMove();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (!Object.prototype.hasOwnProperty.call(pressedKeys, e.key)) return;
    e.preventDefault();
    if (modalOpen) return;

    pressedKeys[e.key] = false;
    keyQueue = keyQueue.filter(key => key !== e.key);
  });

  buildWallSet();

  const goalPoint = cellToPoint(GOAL.col, GOAL.row);
  goal.setAttribute("transform", `translate(${goalPoint.x},${goalPoint.y})`);
  goal.setAttribute("data-x", String(goalPoint.x));
  goal.setAttribute("data-y", String(goalPoint.y));

  btn.addEventListener("click", startGame);

  lockGoal();
  setHud("Klikni START in poberi 5 ključev");
  requestAnimationFrame(animate);
});