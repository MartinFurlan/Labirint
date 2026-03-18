document.addEventListener("DOMContentLoaded", function () {
  // Počakamo, da se celoten HTML naloži, potem šele zaženemo kodo.

  const startBtn = document.getElementById("startBtn");
  const mazeTitle = document.querySelector(".maze-title");
  const svg = document.querySelector("svg.maze");
  const player = document.getElementById("player");
  const goal = document.getElementById("goal");
  const solution = document.getElementById("solution");
  const instructionsText = document.getElementById("instructionsText");
  const statsText = document.getElementById("statsText");

  // Preverimo, če vsi pomembni HTML elementi obstajajo.
  // Če kaj manjka, se igra ne more pravilno zagnati.
  if (!startBtn || !mazeTitle || !svg || !player || !goal || !instructionsText || !statsText) {
    console.error("Manjka kak element v HTML.");
    return;
  }

  // Če obstaja element za rešitev, ga na začetku skrijemo.
  if (solution) {
    solution.style.opacity = "0";
  }

  // Konstante za gibanje in velikost mreže
  const STEP = 16;         // Velikost enega koraka po mreži
  const HALF = 8;          // Polovica koraka (uporabno za preverjanje zidov)
  const MIN = 10;          // Najmanjša dovoljena koordinata
  const MAX = 474;         // Največja dovoljena koordinata
  const KEY_COUNT = 5;     // Koliko ključev mora igralec pobrati
  const MOVE_TIME = 120;   // Čas animacije enega koraka v ms
  const START = { x: 234, y: 10 };    // Začetna pozicija igralca
  const END = { x: 250, y: 474 };     // Končni cilj

  // Trenutna pozicija igralca
  let x = START.x;
  let y = START.y;

  // Spremenljivke za animacijo premika
  let fromX = START.x;
  let fromY = START.y;
  let toX = START.x;
  let toY = START.y;

  // Stanje igre
  let gameRunning = false;   // Ali igra trenutno teče
  let moving = false;        // Ali se igralec trenutno premika
  let cheatMode = false;     // Cheat mode ignorira zidove
  let goalUnlocked = false;  // Ali je cilj odklenjen

  let moveProgress = 0;      // Napredek trenutne animacije (0 do 1)
  let lastTime = null;       // Čas prejšnjega frame-a
  let collectedKeys = 0;     // Število pobranih ključev
  let keys = [];             // Seznam aktivnih ključev na mapi
  let moveCount = 0;         // Število premikov

  let startTime = 0;         // Čas začetka igre
  let finishTime = 0;        // Čas konca igre

  // Sem shranimo vse zidove v obliki povezav med točkami
  const walls = new Set();

  // Evidenca pritisnjenih tipk
  const pressedKeys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
  };

  // Vrstni red tipk, da vemo katera smer ima prednost
  let keyOrder = [];

  // Prikaže navodila na strani
  function showInstructions() {
    instructionsText.innerHTML =
      "• Poberi 5 ključev.<br>" +
      "• Nato pojdi na zeleni cilj.<br>" +
      "• Premikanje: puščice.<br>" +
      "• F4 = cheat mode.";
  }

  // Nastavi HTML za statistiko
  function setStatsHtml(html) {
    statsText.innerHTML = html;
  }

  // Vrne čas igre kot tekst
  function getTimeText() {
    // Če igra še ni začela in tudi ni končana
    if (!gameRunning && finishTime === 0) {
      return "0.0 s";
    }

    let seconds = 0;

    // Če igra teče, računamo čas od začetka do zdaj
    if (gameRunning) {
      seconds = (performance.now() - startTime) / 1000;
    } else {
      // Če je konec, računamo skupni čas
      seconds = (finishTime - startTime) / 1000;
    }

    return seconds.toFixed(1) + " s";
  }

  // Posodobi statistiko na zaslonu
  function updateStats() {
    const keyText = `Ključi: ${collectedKeys} / ${collectedKeys + keys.length}`;
    const moveText = `Premiki: ${moveCount}`;
    const timeText = `Čas: ${getTimeText()}`;

    let html = `${keyText}<br>${moveText}<br>${timeText}`;

    // Če so vsi ključi pobrani, pokažemo da je cilj odklenjen
    if (goalUnlocked) {
      html = `CILJ ODKLENJEN<br>${moveText}<br>${timeText}`;
    }

    // Če je cheat mode vključen, to še dodatno napišemo
    if (cheatMode && gameRunning) {
      html = `CHEAT MODE<br>${html}`;
    }

    setStatsHtml(html);
  }

  // Pobriše vse elemente iz SVG skupine
  function clearSvg(group) {
    while (group.firstChild) {
      group.removeChild(group.firstChild);
    }
  }

  // V SVG skupino nariše emoji
  function setSvgEmoji(group, emoji, size) {
    clearSvg(group);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "0");
    text.setAttribute("y", "0");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size", size);
    text.textContent = emoji;

    group.appendChild(text);
  }

  // Nastavi pozicijo igralca v SVG
  function setPlayer(px, py) {
    player.setAttribute("transform", `translate(${px},${py})`);
  }

  // Zaklenjen cilj ne nariše ničesar
  function drawLockedGoal() {
    clearSvg(goal);
  }

  // Odklenjen cilj nariše zelen krog
  function drawUnlockedGoal() {
    clearSvg(goal);

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "0");
    circle.setAttribute("cy", "0");
    circle.setAttribute("r", "6");
    circle.setAttribute("fill", "#4f8a5b");
    circle.setAttribute("stroke", "#1f2328");
    circle.setAttribute("stroke-width", "1.5");

    goal.appendChild(circle);
  }

  // Nastavi cilj kot zaklenjen
  function lockGoal() {
    goalUnlocked = false;
    drawLockedGoal();
  }

  // Nastavi cilj kot odklenjen
  function unlockGoal() {
    goalUnlocked = true;
    drawUnlockedGoal();
    updateStats();
  }

  // Ustvari unikaten ključ za zid med dvema točkama
  // Uporablja se za shranjevanje v Set
  function lineKey(x1, y1, x2, y2) {
    const a = `${x1},${y1}`;
    const b = `${x2},${y2}`;
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  // Prebere vse <line> elemente v SVG in jih pretvori v "zidove"
  function buildWalls() {
    walls.clear();

    const group = svg.querySelector("g");
    if (!group) return;

    const lines = group.querySelectorAll("line");

    for (const line of lines) {
      const x1 = Number(line.getAttribute("x1"));
      const y1 = Number(line.getAttribute("y1"));
      const x2 = Number(line.getAttribute("x2"));
      const y2 = Number(line.getAttribute("y2"));

      // Horizontalne črte razdelimo na segmente dolžine STEP
      if (y1 === y2) {
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);

        for (let xPart = minX; xPart < maxX; xPart += STEP) {
          walls.add(lineKey(xPart, y1, xPart + STEP, y1));
        }
      }

      // Vertikalne črte razdelimo na segmente dolžine STEP
      if (x1 === x2) {
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);

        for (let yPart = minY; yPart < maxY; yPart += STEP) {
          walls.add(lineKey(x1, yPart, x1, yPart + STEP));
        }
      }
    }
  }

  // Preveri, ali obstaja horizontalni zid
  function hasHorizontalWall(x1, x2, yLine) {
    return walls.has(lineKey(x1, yLine, x2, yLine));
  }

  // Preveri, ali obstaja vertikalni zid
  function hasVerticalWall(xLine, y1, y2) {
  return walls.has(lineKey(xLine, y1, xLine, y2));
}

  // Preveri, ali se igralec lahko premakne v dano smer
  function canMove(px, py, dir) {
    // V cheat mode samo preverimo robove igralnega polja
    if (cheatMode) {
      if (dir === "up") return py > MIN;
      if (dir === "down") return py < MAX;
      if (dir === "left") return px > MIN;
      if (dir === "right") return px < MAX;
      return false;
    }

    // Normalen način: preverjamo tudi zidove
    if (dir === "up") {
      if (py <= MIN) return false;
      return !hasHorizontalWall(px - HALF, px + HALF, py - HALF);
    }

    if (dir === "down") {
      if (py >= MAX) return false;
      return !hasHorizontalWall(px - HALF, px + HALF, py + HALF);
    }

    if (dir === "left") {
      if (px <= MIN) return false;
      return !hasVerticalWall(px - HALF, py - HALF, py + HALF);
    }

    if (dir === "right") {
      if (px >= MAX) return false;
      return !hasVerticalWall(px + HALF, py - HALF, py + HALF);
    }

    return false;
  }

  // Vrne vse sosednje točke, kamor lahko gre igralec
  function getNeighbors(point) {
    const list = [];

    if (canMove(point.x, point.y, "up")) {
      list.push({ x: point.x, y: point.y - STEP });
    }
    if (canMove(point.x, point.y, "down")) {
      list.push({ x: point.x, y: point.y + STEP });
    }
    if (canMove(point.x, point.y, "left")) {
      list.push({ x: point.x - STEP, y: point.y });
    }
    if (canMove(point.x, point.y, "right")) {
      list.push({ x: point.x + STEP, y: point.y });
    }

    return list;
  }

  // BFS algoritem: poišče vse dosegljive točke od začetka
  function getReachablePoints(startPoint) {
    const visited = new Set();
    const queue = [startPoint];
    const result = [];

    visited.add(`${startPoint.x},${startPoint.y}`);

    while (queue.length > 0) {
      const current = queue.shift();
      result.push(current);

      const neighbors = getNeighbors(current);

      for (const n of neighbors) {
        const id = `${n.x},${n.y}`;

        if (!visited.has(id)) {
          visited.add(id);
          queue.push(n);
        }
      }
    }

    return result;
  }

  // Naključno premeša array
  function shuffle(array) {
    const arr = [...array];

    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }

    return arr;
  }

  // Preveri, ali sta dve točki enaki
  function samePoint(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  // Ustvari ključ v SVG na določeni poziciji
  function createKey(px, py) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", `translate(${px},${py})`);
    g.style.pointerEvents = "none";

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "0");
    text.setAttribute("y", "0");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size", "14");
    text.textContent = "🗝️";

    g.appendChild(text);
    svg.insertBefore(g, player);

    return { x: px, y: py, el: g };
  }

  // Pobriše vse obstoječe ključe
  function clearKeys() {
    for (const key of keys) {
      key.el.remove();
    }

    keys = [];
    collectedKeys = 0;
  }

  // Postavi ključe na naključne dosegljive pozicije
  function spawnKeys() {
    clearKeys();

    const reachable = getReachablePoints(START).filter(function (point) {
      return !samePoint(point, START) && !samePoint(point, END);
    });

    const chosen = shuffle(reachable).slice(0, KEY_COUNT);

    keys = chosen.map(function (point) {
      return createKey(point.x, point.y);
    });

    updateStats();
  }

  // Preveri, ali je igralec stopil na ključ
  function collectKey() {
    const remaining = [];

    for (const key of keys) {
      if (key.x === x && key.y === y) {
        key.el.remove();
        collectedKeys++;
      } else {
        remaining.push(key);
      }
    }

    keys = remaining;

    // Ko pobere vse ključe, odklenemo cilj
    if (keys.length === 0 && !goalUnlocked) {
      unlockGoal();
    } else {
      updateStats();
    }
  }

  // Preveri, ali je igralec zmagal
  function checkWin() {
    if (!goalUnlocked) return false;
    if (x !== END.x || y !== END.y) return false;

    gameRunning = false;
    moving = false;
    keyOrder = [];
    finishTime = performance.now();

    updateStats();

    // Če SweetAlert knjižnica ni naložena, uporabimo navaden alert
    if (typeof Swal === "undefined") {
      alert(
        "Uspeh! Pobral si vse ključe in prišel do cilja.\n" +
        "Čas: " + getTimeText() + "\n" +
        "Premiki: " + moveCount
      );
      location.reload();
      return true;
    }

    // Lep popup ob zmagi
    Swal.fire({
      title: "POBEG USPEL!",
      text: `Čas: ${getTimeText()} | Premiki: ${moveCount}`,
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
    }).then(function () {
      location.reload();
    });

    return true;
  }

  // Pretvori tipko v smer premika
  function keyToDir(key) {
    if (key === "ArrowUp") return "up";
    if (key === "ArrowDown") return "down";
    if (key === "ArrowLeft") return "left";
    if (key === "ArrowRight") return "right";
    return null;
  }

  // Izbere trenutno željeno smer glede na vrstni red pritisnjenih tipk
  function getWantedDirection() {
    for (let i = keyOrder.length - 1; i >= 0; i--) {
      const key = keyOrder[i];

      if (pressedKeys[key]) {
        const dir = keyToDir(key);

        if (canMove(x, y, dir)) {
          return dir;
        }
      }
    }

    return null;
  }

  // Začne nov premik igralca
  function startMove() {
    if (!gameRunning || moving) return;

    const dir = getWantedDirection();
    if (!dir) return;

    fromX = x;
    fromY = y;
    toX = x;
    toY = y;

    // Določimo novo ciljno točko
    if (dir === "up") toY -= STEP;
    if (dir === "down") toY += STEP;
    if (dir === "left") toX -= STEP;
    if (dir === "right") toX += STEP;

    moveProgress = 0;
    moving = true;
    moveCount++;
    updateStats();
  }

  // Zažene novo igro
  function startGame() {
    gameRunning = true;
    moving = false;
    moveProgress = 0;
    lastTime = null;

    x = START.x;
    y = START.y;
    fromX = x;
    fromY = y;
    toX = x;
    toY = y;

    moveCount = 0;
    finishTime = 0;
    startTime = performance.now();

    keyOrder = [];

    // Pobrišemo stanje vseh tipk
    for (const key in pressedKeys) {
      pressedKeys[key] = false;
    }

    setPlayer(x, y);
    lockGoal();
    spawnKeys();
    collectKey();
    updateStats();
  }

  // Glavna animacijska zanka
  function animate(time) {
    requestAnimationFrame(animate);

    if (!gameRunning) {
      lastTime = time;
      return;
    }

    if (lastTime === null) {
      lastTime = time;
      updateStats();
      return;
    }

    const dt = time - lastTime;
    lastTime = time;

    updateStats();

    // Če se ne premikamo, poskusimo začeti nov premik
    if (!moving) {
      startMove();
      return;
    }

    // Napredujemo po animaciji
    moveProgress += dt / MOVE_TIME;

    if (moveProgress > 1) {
      moveProgress = 1;
    }

    // Smoothstep za bolj mehko animacijo
    const t = moveProgress;
    const smooth = t * t * (3 - 2 * t);

    const drawX = fromX + (toX - fromX) * smooth;
    const drawY = fromY + (toY - fromY) * smooth;

    setPlayer(drawX, drawY);

    // Ko animacija pride do konca, zaključimo premik
    if (moveProgress >= 1) {
      x = toX;
      y = toY;
      moving = false;
      moveProgress = 0;

      setPlayer(x, y);
      collectKey();
      checkWin();
      startMove();
    }
  }

  // Ko pritisnemo tipko
  window.addEventListener("keydown", function (e) {
    // F4 vklopi / izklopi cheat mode
    if (e.key === "F4") {
      e.preventDefault();
      cheatMode = !cheatMode;

      if (gameRunning) {
        updateStats();
      } else {
        showInstructions();

        if (cheatMode) {
          setStatsHtml("CHEAT MODE<br>Klikni START");
        } else {
          setStatsHtml("Ključi: 0 / 5<br>Premiki: 0<br>Čas: 0.0 s");
        }
      }

      return;
    }

    // Če tipka ni ena od puščic, ignoriramo
    if (!(e.key in pressedKeys)) return;

    e.preventDefault();

    // Če tipka še ni bila pritisnjena, jo dodamo v vrstni red
    if (!pressedKeys[e.key]) {
      keyOrder.push(e.key);
    }

    pressedKeys[e.key] = true;

    // Če igra teče in igralec trenutno miruje, takoj začnemo premik
    if (gameRunning && !moving) {
      startMove();
    }
  });

  // Ko spustimo tipko
  window.addEventListener("keyup", function (e) {
    if (!(e.key in pressedKeys)) return;

    e.preventDefault();
    pressedKeys[e.key] = false;

    // Odstranimo tipko iz vrstnega reda
    keyOrder = keyOrder.filter(function (key) {
      return key !== e.key;
    });
  });

  // Na začetku zgradimo zemljevid zidov
  buildWalls();

  // Postavimo cilj na pravo mesto
  goal.setAttribute("transform", `translate(${END.x},${END.y})`);

  // Nastavimo izgled igralca
  setSvgEmoji(player, "🥷", "16");
  lockGoal();
  setPlayer(x, y);
  showInstructions();
  setStatsHtml("Ključi: 0 / 5<br>Premiki: 0<br>Čas: 0.0 s");

  // Klik na START začne igro
  startBtn.addEventListener("click", startGame);
  mazeTitle.style.cursor = "pointer";

  // Klik na naslov pokaže credits
  mazeTitle.addEventListener("click", function () {
    if (typeof Swal === "undefined") {
      alert("Credits: Martin Furlan");
      return;
    }

    Swal.fire({
      title: "CREDITS",
      html: "Martin Furlan",
      confirmButtonText: "Zapri",
      buttonsStyling: false,
      customClass: {
        popup: "prison-popup",
        title: "prison-title",
        htmlContainer: "prison-text",
        confirmButton: "prison-confirm btn"
      },
      focusConfirm: false,
      scrollbarPadding: false,
      heightAuto: false
    });
  });

  // Zaženemo animacijsko zanko
  requestAnimationFrame(animate);
});