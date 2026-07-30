/* ============================================================
   Motion — GSAP core + ScrollTrigger + SplitText.
   The page reads as one call recording: scroll plays it back.
   ============================================================ */

gsap.registerPlugin(ScrollTrigger, SplitText);
gsap.defaults({ duration: 0.7, ease: "power3.out" });

/* ── waveform: one deterministic envelope, drawn twice ──────── */

const BARS = 150;
const VB_W = 1200;
const VB_H = 120;

function amplitude(i) {
  const t = i / (BARS - 1);
  // envelope: connect, settle into conversation, taper at hang-up
  const env = Math.min(1, t * 8) * Math.min(1, (1 - t) * 6) * (0.55 + 0.45 * Math.sin(t * Math.PI));
  // layered pseudo-noise, stable across reloads
  const n =
    0.5 * Math.sin(i * 0.7 + 1.3) +
    0.3 * Math.sin(i * 1.9 + 0.4) +
    0.2 * Math.sin(i * 4.3 + 2.1);
  return env * (0.34 + 0.66 * Math.abs(n));
}

function drawWave() {
  const base = document.getElementById("waveBase");
  const lit = document.getElementById("waveLit");
  if (!base || !lit) return [];
  const step = VB_W / BARS;
  const w = Math.max(1.6, step * 0.42);
  let markup = "";
  for (let i = 0; i < BARS; i++) {
    const h = Math.max(2, amplitude(i) * (VB_H - 8));
    const x = i * step + (step - w) / 2;
    const y = (VB_H - h) / 2;
    markup += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${(w / 2).toFixed(2)}"/>`;
  }
  base.innerHTML = markup;
  lit.innerHTML = markup;
  return Array.from(base.querySelectorAll("rect")).concat(
    Array.from(lit.querySelectorAll("rect"))
  );
}

const waveBars = drawWave();

/* ── playback: scroll progress drives clip, playhead, clock ─── */

const clipRect = document.getElementById("waveClipRect");
const head = document.getElementById("wavehead");
const timecode = document.getElementById("timecode");
const railbar = document.getElementById("railbar");

const pad = (n) => String(Math.floor(n)).padStart(2, "0");

function playback(p) {
  if (clipRect) clipRect.setAttribute("width", (VB_W * p).toFixed(1));
  if (head) head.style.transform = `translateX(${(p * 100).toFixed(3)}%)`;
  if (timecode) {
    const secs = p * 9 * 3600; // 09:00:00 → 18:00:00
    timecode.textContent = `${pad(9 + secs / 3600)}:${pad((secs / 60) % 60)}:${pad(secs % 60)}`;
  }
}

ScrollTrigger.create({
  trigger: document.body,
  start: 0,
  end: "max",
  onUpdate: (self) => {
    playback(self.progress);
    if (railbar) railbar.style.transform = `scaleX(${self.progress})`;
  }
});

/* ── section markers in the rail ─────────────────────────────── */

document.querySelectorAll(".rail__nav a").forEach((link) => {
  const target = document.querySelector(link.getAttribute("href"));
  if (!target) return;
  ScrollTrigger.create({
    trigger: target,
    start: "top 55%",
    end: "bottom 55%",
    onToggle: (self) => link.classList.toggle("is-on", self.isActive)
  });
});

/* ── counters ────────────────────────────────────────────────── */

document.querySelectorAll(".count").forEach((el) => {
  const to = parseFloat(el.dataset.to);
  const dec = parseInt(el.dataset.dec || "0", 10);
  ScrollTrigger.create({
    trigger: el,
    start: "top 88%",
    once: true,
    onEnter: () => {
      const obj = { v: 0 };
      gsap.to(obj, {
        v: to,
        duration: 1.5,
        ease: "power2.out",
        onUpdate: () => { el.textContent = obj.v.toFixed(dec); }
      });
    }
  });
});

/* ── everything that moves, behind matchMedia ────────────────── */

const mm = gsap.matchMedia();

mm.add(
  { motion: "(prefers-reduced-motion: no-preference)", still: "(prefers-reduced-motion: reduce)" },
  (ctx) => {
    const hidden = ".js-fade, .js-card, .js-row, .js-plate, .js-split";

    if (ctx.conditions.still) {
      gsap.set(hidden, { opacity: 1, clearProps: "transform" });
      return;
    }

    /* -- page load: the line connects -- */
    const heroFades = gsap.utils.toArray(".hero .js-fade");
    const intro = gsap.timeline({ defaults: { duration: 0.9, ease: "power3.out" } });

    intro
      .to(".hero .eyebrow", { opacity: 1, duration: 0.6 })
      .from(".hero .eyebrow", { y: 14, duration: 0.6 }, "<")
      .from(".hero__name-l", { yPercent: 104, duration: 1.05, stagger: 0.08, ease: "expo.out" }, "-=0.3")
      .to(".hero__lede", { opacity: 1 }, "-=0.55")
      .from(".hero__lede", { y: 18 }, "<")
      .to(".hero__cta", { opacity: 1, duration: 0.5 }, "-=0.6")
      .from(".hero__cta > *", { y: 14, stagger: 0.08, duration: 0.6 }, "<")
      .to(".plate", { opacity: 1 }, "-=0.95")
      .from(".plate", { y: 22 }, "<")
      .from(".plate__row", { opacity: 0, x: -10, stagger: 0.045, duration: 0.45 }, "-=0.55")
      .from(".plate__links a", { opacity: 0, stagger: 0.05, duration: 0.4 }, "-=0.25");

    /* the recording draws itself in from the middle out */
    if (waveBars.length) {
      intro.from(
        waveBars,
        { scaleY: 0, duration: 0.85, ease: "power2.out", stagger: { amount: 0.7, from: "center" } },
        "-=1.15"
      );
    }
    intro.from(".wave__meta > *", { opacity: 0, y: 8, stagger: 0.07, duration: 0.5 }, "-=0.95");

    /* -- headings split into masked lines -- */
    document.fonts.ready.then(() => {
      SplitText.create(".js-split", {
        type: "lines",
        mask: "lines",
        autoSplit: true,
        onSplit(self) {
          gsap.set(self.elements, { opacity: 1 });
          return gsap.from(self.lines, {
            yPercent: 108,
            duration: 0.95,
            ease: "expo.out",
            stagger: 0.07,
            scrollTrigger: { trigger: self.elements[0], start: "top 90%", once: true }
          });
        }
      });
      ScrollTrigger.refresh();
    });

    /* -- generic reveals (hero fades are owned by the intro) -- */
    gsap.utils.toArray(".js-fade").forEach((el) => {
      if (heroFades.includes(el)) return;
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        startAt: { y: 18 },
        scrollTrigger: { trigger: el, start: "top 90%", once: true }
      });
    });

    ScrollTrigger.batch(".js-card", {
      start: "top 88%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          opacity: 1, y: 0, duration: 0.85, stagger: 0.09, overwrite: true,
          startAt: { y: 26 }
        })
    });

    ScrollTrigger.batch(".js-row", {
      start: "top 94%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          opacity: 1, x: 0, duration: 0.6, stagger: 0.05, overwrite: true,
          startAt: { x: -14 }
        })
    });

    /* -- the BGIL flow: rail draws, nodes land -- */
    const track = document.querySelector(".flow__track");
    if (track) {
      const flow = gsap.timeline({
        scrollTrigger: { trigger: track, start: "top 82%", once: true }
      });
      flow
        .to(".flow__line", { scaleX: 1, duration: 1.1, ease: "power2.inOut" })
        .from(".flow__node", { opacity: 0, y: 16, stagger: 0.11, duration: 0.55 }, "-=0.85")
        .from(".flow__node .ic", { scale: 0.6, stagger: 0.11, duration: 0.45, ease: "back.out(2)" }, "<");

      /* a packet running the path — only while the diagram is on screen */
      const pulse = gsap.fromTo(
        ".flow__pulse",
        { x: 0, opacity: 1 },
        {
          x: () => track.scrollWidth - 7,
          duration: 3.4,
          ease: "none",
          repeat: -1,
          repeatDelay: 1.2,
          paused: true,
          immediateRender: false
        }
      );
      ScrollTrigger.create({
        trigger: track,
        start: "top 90%",
        end: "bottom 10%",
        onToggle: (self) => (self.isActive ? pulse.play() : pulse.pause())
      });
    }

    /* -- magnetic skill chips (pointer devices only) -- */
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      const RADIUS = 110;   // px of attraction
      const PULL = 0.38;    // fraction of the offset a chip travels
      const chips = gsap.utils.toArray(".spec__v span").map((el) => ({
        el,
        xTo: gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" }),
        yTo: gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" })
      }));

      const spec = document.querySelector(".spec");
      if (spec) {
        spec.addEventListener("mousemove", (e) => {
          for (const c of chips) {
            const r = c.el.getBoundingClientRect();
            const dx = e.clientX - (r.left + r.width / 2);
            const dy = e.clientY - (r.top + r.height / 2);
            const d = Math.hypot(dx, dy);
            if (d < RADIUS) {
              const f = (1 - d / RADIUS) * PULL;
              c.xTo(dx * f);
              c.yTo(dy * f);
            } else {
              c.xTo(0);
              c.yTo(0);
            }
          }
        });
        spec.addEventListener("mouseleave", () => {
          for (const c of chips) { c.xTo(0); c.yTo(0); }
        });
      }
    }

    return () => {};
  }
);

/* fonts and images shift layout; recalc once settled */
window.addEventListener("load", () => ScrollTrigger.refresh());
