// ── Navbar scroll effect ────────────────────────────────────────────
const navbar = document.getElementById("navbar");
function updateNavbar() {
  if (!navbar) return;
  navbar.classList.toggle("scrolled", window.scrollY > 10);
}
window.addEventListener("scroll", updateNavbar, { passive: true });
updateNavbar();

// ── Mobile hamburger ────────────────────────────────────────────────
const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("nav-links");
hamburger?.addEventListener("click", () => {
  navLinks?.classList.toggle("open");
});
// Close on link click
navLinks?.querySelectorAll("a").forEach((a) => {
  a.addEventListener("click", () => navLinks.classList.remove("open"));
});

// ── Scroll-reveal ─────────────────────────────────────────────────
const revealEls = document.querySelectorAll<HTMLElement>(
  ".feature-card, .step, .arch-layer, .arch-feat, .doc-card, .qs-step, .hero__stats"
);
revealEls.forEach((el) => el.classList.add("reveal"));

const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        (entry.target as HTMLElement).classList.add("visible");
        io.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);
revealEls.forEach((el) => io.observe(el));

// ── Stagger feature cards ──────────────────────────────────────────
document.querySelectorAll<HTMLElement>(".feature-card").forEach((el, i) => {
  el.style.transitionDelay = `${i * 60}ms`;
});
document.querySelectorAll<HTMLElement>(".doc-card").forEach((el, i) => {
  el.style.transitionDelay = `${i * 50}ms`;
});

// ── Quick start tabs ───────────────────────────────────────────────
const tabBtns = document.querySelectorAll<HTMLButtonElement>(".qs-tab-btn");
const tabPanels = document.querySelectorAll<HTMLElement>(".qs-tab-panel");

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    tabBtns.forEach((b) => b.classList.remove("active"));
    tabPanels.forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    const panel = document.getElementById(`qs-${target}`);
    panel?.classList.add("active");
  });
});

// ── Copy buttons ────────────────────────────────────────────────────
document.querySelectorAll<HTMLButtonElement>(".copy-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const targetId = btn.dataset.target;
    if (!targetId) return;
    const pre = document.getElementById(targetId);
    if (!pre) return;
    const text = pre.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text.trim());
      btn.textContent = "已复制 ✓";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = "复制";
        btn.classList.remove("copied");
      }, 2000);
    } catch {
      btn.textContent = "复制失败";
    }
  });
});

// ── Smooth active nav highlight ────────────────────────────────────
const sections = document.querySelectorAll<HTMLElement>("section[id]");
const navAnchors = document.querySelectorAll<HTMLAnchorElement>(".navbar__links a");

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navAnchors.forEach((a) => {
          a.style.color = a.getAttribute("href") === `#${id}` ? "var(--primary)" : "";
        });
      }
    });
  },
  { rootMargin: "-40% 0px -55% 0px" }
);
sections.forEach((s) => sectionObserver.observe(s));

// ── DAG node entrance animation stagger ────────────────────────────
document.querySelectorAll<HTMLElement>(".dag-node").forEach((node, i) => {
  node.style.animationDelay = `${i * 150 + 300}ms`;
});
