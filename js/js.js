// js/js.js
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

  // solution je samo “pot” (skrita)
  solution.style.opacity = "0";

  // ===== HUD =====
  const hud = document.createElement("div");
  hud.className = "hud";
  document.body.appendChild(hud);

  function setHud(text) {
    hud.textContent = text;
  }

  // ===== SPACE CONTROL (premik samo ko držiš SPACE) =====
  let spacePressed = false;
  let modalOpen = false; // ✅ da SPACE ne zapre SweetAlert

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (modalOpen) return;
      spacePressed = true;
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (modalOpen) return;
      spacePressed = false;
    }
  });

  // ===== GOAL LOCK / UNLOCK =====
  let goalUnlocked = false;

  function lockGoal() {
    goalUnlocked = false;
    goal.setAttribute("fill", "#9aa0a6");
    goal.setAttribute("opacity", "0.65");
    hud.classList.remove("hud--done", "hud--pulse");
  }

  function unlockGoal() {
    goalUnlocked = true;
    goal.setAttribute("fill", "dodgerblue");
    goal.setAttribute("opacity", "1");

    // mali bounce
    goal.style.transition = "transform 0.2s ease";
    goal.style.transformOrigin = "center";
    goal.style.transform = "scale(1.25)";
    setTimeout(() => (goal.style.transform = "scale(1)"), 200);

    // izpis zgoraj
    hud.textContent = "VSE TOČKE POBRANE! Pojdi do cilja 🔓";
    hud.classList.add("hud--done", "hud--pulse");
    setTimeout(() => hud.classList.remove("hud--pulse"), 700);
  }

  // ===== PARSE PATH POINTS =====
  function parsePoints(polyline) {
    const raw = (polyline.getAttribute("points") || "").trim();
    const tokens = raw.replace(/\s+/g, " ").split(" ").filter(Boolean);
    const pts = [];
    for (const t of tokens) {
      const [xs, ys] = t.split(",");
      const x = parseFloat(xs);
      const y = parseFloat(ys);
      if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y });
    }
    return pts;
  }

  const pts = parsePoints(solution);
  if (pts.length < 2) {
    console.error("Solution polyline nima dovolj točk.");
    return;
  }

  // ===== TRAIL (zelena črta za igralcem) =====
  const trail = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  trail.setAttribute("fill", "none");
  trail.setAttribute("stroke", "green");
  trail.setAttribute("stroke-width", "3");
  trail.setAttribute("stroke-linecap", "round");
  trail.setAttribute("stroke-linejoin", "round");
  trail.style.pointerEvents = "none";
  svg.insertBefore(trail, player);

  let trailPts = [];

  function resetTrail() {
    trailPts = [];
    trail.setAttribute("points", "");
  }

  function addTrail(x, y) {
    const last = trailPts[trailPts.length - 1];
    if (last && Math.hypot(x - last.x, y - last.y) < 2) return;
    trailPts.push({ x, y });
    trail.setAttribute("points", trailPts.map(p => `${p.x},${p.y}`).join(" "));
  }

  function setPlayer(x, y) {
    player.setAttribute("cx", String(x));
    player.setAttribute("cy", String(y));
    addTrail(x, y);
  }

  // ===== TOČKE =====
  let dots = []; // {el, x, y}
  let collected = 0;

  function clearDots() {
    for (const d of dots) d.el.remove();
    dots = [];
    collected = 0;
  }

  function makeDot(x, y) {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", String(x));
    c.setAttribute("cy", String(y));
    c.setAttribute("r", "4");
    c.setAttribute("fill", "red");
    c.setAttribute("opacity", "0.95");
    c.style.pointerEvents = "none";
    svg.insertBefore(c, player);
    return c;
  }

  function spawnRandomDots(count) {
    clearDots();

    const totalLen = solution.getTotalLength();
    const minL = totalLen * 0.03;
    const maxL = totalLen * 0.97;

    const chosen = [];
    const minAlong = totalLen / (count * 1.2);

    let tries = 0;
    while (chosen.length < count && tries < count * 60) {
      tries++;
      const l = minL + Math.random() * (maxL - minL);

      let ok = true;
      for (const cl of chosen) {
        if (Math.abs(cl - l) < minAlong) { ok = false; break; }
      }
      if (!ok) continue;

      chosen.push(l);
    }

    chosen.sort((a, b) => a - b);

    for (const l of chosen) {
      const p = solution.getPointAtLength(l);
      const el = makeDot(p.x, p.y);
      dots.push({ el, x: p.x, y: p.y });
    }

    setHud(`TOČKE: 0 / ${dots.length}`);
  }

  function eatDotsIfTouching() {
    const px = parseFloat(player.getAttribute("cx"));
    const py = parseFloat(player.getAttribute("cy"));
    const pr = parseFloat(player.getAttribute("r")) || 5;

    const DOT_R = 4;
    const EAT_DIST = pr + DOT_R + 1;

    let changed = false;

    dots = dots.filter(d => {
      const hit = Math.hypot(px - d.x, py - d.y) <= EAT_DIST;
      if (hit) {
        d.el.remove();
        collected++;
        changed = true;
        return false;
      }
      return true;
    });

    if (changed && !goalUnlocked) {
      setHud(`TOČKE: ${collected} / ${collected + dots.length}`);
    }

    if (!goalUnlocked && dots.length === 0) {
      unlockGoal();
    }
  }

  function checkWin() {
    if (!goalUnlocked) return false;

    const px = parseFloat(player.getAttribute("cx"));
    const py = parseFloat(player.getAttribute("cy"));
    const pr = parseFloat(player.getAttribute("r")) || 5;

    const gx = parseFloat(goal.getAttribute("cx"));
    const gy = parseFloat(goal.getAttribute("cy"));
    const gr = parseFloat(goal.getAttribute("r")) || 7;

    const onGoal = Math.hypot(px - gx, py - gy) <= pr + gr;
    if (!onGoal) return false;

    // ✅ ustavi igro + reset SPACE + prepreči da SPACE zapre alert
    running = false;
    spacePressed = false;
    modalOpen = true;

    // če SweetAlert ni naložen, vsaj ne crasha
    if (typeof Swal === "undefined") {
      alert("SUPER! (SweetAlert2 ni naložen – preveri script v HTML)");
      location.reload();
      return true;
    }

    Swal.fire({
		title: "SUPER! 🎉",
		text: "Pobral si vse TOČKE in prišel do cilja!",
		icon: "success",
		confirmButtonText: "Igraj znova",
		

		focusConfirm: false,
		allowOutsideClick: false,
		allowEscapeKey: false,

		scrollbarPadding: false,   // 🔥 prepreči premik layouta
		heightAuto: false,         // 🔥 še dodatna stabilizacija

		didOpen: () => {
			const el = document.activeElement;
			if (el && typeof el.blur === "function") el.blur();
		}
		}).then(() => {
		modalOpen = false;
		location.reload();
		});

	return true;

  }

  // ===== GAME STATE =====
  let running = false;
  let seg = 0;
  let tOnSeg = 0;
  let lastTime = null;

  function startGame() {
    running = true;
    seg = 0;
    tOnSeg = 0;
    lastTime = null;

    resetTrail();
    lockGoal();
    spawnRandomDots(25);

    // STOJI na začetku
    setPlayer(pts[0].x, pts[0].y);

    setHud("Drži SPACE za premikanje");
  }

  // ===== ANIMATION LOOP (premika se samo ko držiš SPACE) =====
  function animate(timestamp) {
    requestAnimationFrame(animate);

    if (!running) return;

    if (!spacePressed) {
      lastTime = null; // da ne skoči, ko spet držiš space
      return;
    }

    if (lastTime == null) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    const SPEED = 120; // px/s
    if (seg >= pts.length - 1) return;

    let move = SPEED * dt;

    while (move > 0 && seg < pts.length - 1) {
      const a = pts[seg];
      const b = pts[seg + 1];

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 0.00001;

      const remaining = len - tOnSeg;
      const take = Math.min(move, remaining);

      tOnSeg += take;
      move -= take;

      const u = tOnSeg / len;
      const x = a.x + dx * u;
      const y = a.y + dy * u;

      setPlayer(x, y);
      eatDotsIfTouching();
      if (checkWin()) return;

      if (tOnSeg >= len - 1e-6) {
        seg++;
        tOnSeg = 0;
      }
    }
  }

  requestAnimationFrame(animate);

  // ===== START =====
  btn.addEventListener("click", startGame);

  // init
  lockGoal();
  setHud("Klikni START (potem drži SPACE)");
});
