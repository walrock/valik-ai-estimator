// Elements
const burger = /** @type {HTMLButtonElement | null} */ (
  document.getElementById("burger")
);
const mobileNav = /** @type {HTMLElement | null} */ (
  document.getElementById("mobileNav")
);
const year = /** @type {HTMLElement | null} */ (document.getElementById("year"));

if (year) year.textContent = String(new Date().getFullYear());

/**
 * @param {boolean} isOpen
 */
function setBurgerLabel(isOpen) {
  if (!burger) return;
  const openLabel = burger.dataset.labelOpen || "Open menu";
  const closeLabel = burger.dataset.labelClose || "Close menu";
  burger.setAttribute("aria-label", isOpen ? closeLabel : openLabel);
}

// Safe close
function closeMobileNav() {
  if (!mobileNav || !burger) return;
  mobileNav.classList.remove("is-open");
  burger.setAttribute("aria-expanded", "false");
  setBurgerLabel(false);
}

if (burger && mobileNav) {
  setBurgerLabel(false);

  burger.addEventListener("click", () => {
    const isOpen = mobileNav.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", String(isOpen));
    setBurgerLabel(isOpen);
  });

  // Close on link click
  mobileNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMobileNav);
  });

  // Close on scroll
  window.addEventListener("scroll", () => {
    if (mobileNav.classList.contains("is-open")) closeMobileNav();
  });

  // Close by ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mobileNav.classList.contains("is-open")) {
      closeMobileNav();
    }
  });
}

// Gallery lightbox
const galleryGrid = /** @type {HTMLElement | null} */ (
  document.getElementById("galleryGrid")
);
const lightbox = /** @type {HTMLElement | null} */ (
  document.getElementById("lightbox")
);
const lightboxImg = /** @type {HTMLImageElement | null} */ (
  document.getElementById("lightboxImg")
);
const lightboxCount = /** @type {HTMLElement | null} */ (
  document.getElementById("lightboxCount")
);
const lightboxPrevBtn = /** @type {HTMLButtonElement | null} */ (
  document.querySelector("#lightbox .lightbox-prev")
);
const lightboxNextBtn = /** @type {HTMLButtonElement | null} */ (
  document.querySelector("#lightbox .lightbox-next")
);
const galleryImages = /** @type {HTMLImageElement[]} */ (
  galleryGrid
    ? Array.from(galleryGrid.querySelectorAll("img")).filter(
        (img) => img instanceof HTMLImageElement
      )
    : []
);
let activeGalleryIndex = -1;
const SWIPE_THRESHOLD_PX = 30;
const SWIPE_DIRECTION_RATIO = 1.1;
const WHEEL_THRESHOLD = 10;
const WHEEL_COOLDOWN_MS = 220;
const GALLERY_WHEEL_STEP = 260;
const GALLERY_WHEEL_COOLDOWN_MS = 140;
let swipeStartX = /** @type {number | null} */ (null);
let swipeStartY = /** @type {number | null} */ (null);
let wheelLockUntil = 0;
let galleryWheelLockUntil = 0;
let bodyScrollY = 0;
let isBodyScrollLocked = false;

function lockBodyScroll() {
  if (isBodyScrollLocked) return;

  bodyScrollY = window.scrollY || window.pageYOffset || 0;
  document.body.style.position = "fixed";
  document.body.style.top = `-${bodyScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
  document.body.style.overflow = "hidden";
  isBodyScrollLocked = true;
}

function unlockBodyScroll() {
  if (!isBodyScrollLocked) return;

  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  document.body.style.overflow = "";
  window.scrollTo(0, bodyScrollY);
  isBodyScrollLocked = false;
}

if (galleryGrid) {
  galleryImages.forEach((img) => {
    if (!img.hasAttribute("tabindex")) img.tabIndex = 0;
    img.setAttribute("role", "button");
    img.setAttribute("aria-label", `Otwórz podgląd: ${img.alt || "zdjęcie"}`);
  });

  galleryGrid.addEventListener(
    "wheel",
    (e) => {
      if (!galleryGrid.matches(":hover")) return;
      if (galleryGrid.scrollWidth <= galleryGrid.clientWidth) return;

      const dominantDelta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(dominantDelta) < WHEEL_THRESHOLD) return;

      e.preventDefault();

      const now = Date.now();
      if (now < galleryWheelLockUntil) return;
      galleryWheelLockUntil = now + GALLERY_WHEEL_COOLDOWN_MS;

      galleryGrid.scrollBy({
        left: dominantDelta > 0 ? GALLERY_WHEEL_STEP : -GALLERY_WHEEL_STEP,
        behavior: "smooth",
      });
    },
    { passive: false }
  );
}

/**
 * @param {number} index
 */
function setLightboxImage(index) {
  if (!lightboxImg || galleryImages.length === 0) return;
  const total = galleryImages.length;
  activeGalleryIndex = ((index % total) + total) % total;
  const currentImg = galleryImages[activeGalleryIndex];
  const full = currentImg.getAttribute("data-full") || currentImg.src;

  lightboxImg.src = full;
  lightboxImg.alt = currentImg.alt || "";

  if (lightboxCount) {
    lightboxCount.textContent = `${activeGalleryIndex + 1}/${total}`;
  }
}

/**
 * @param {number} index
 */
function openLightbox(index) {
  if (!lightbox || !lightboxImg || galleryImages.length === 0) return;
  setLightboxImage(index);
  lightbox.classList.add("is-open");
  lightbox.setAttribute("aria-hidden", "false");
  lockBodyScroll();
}

/**
 * @param {number} step
 */
function moveLightbox(step) {
  if (!lightbox || !lightbox.classList.contains("is-open")) return;
  if (activeGalleryIndex < 0 || galleryImages.length === 0) return;
  setLightboxImage(activeGalleryIndex + step);
}

function closeLightbox() {
  if (!lightbox || !lightboxImg) return;
  lightbox.classList.remove("is-open");
  lightbox.setAttribute("aria-hidden", "true");
  lightboxImg.src = "";
  activeGalleryIndex = -1;
  swipeStartX = null;
  swipeStartY = null;
  if (lightboxCount) lightboxCount.textContent = "";
  unlockBodyScroll();
}

if (galleryGrid && lightbox && lightboxImg && galleryImages.length > 0) {
  galleryGrid.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    const img = target.closest("img");
    if (!(img instanceof HTMLImageElement)) return;
    const clickedIndex = galleryImages.indexOf(img);
    if (clickedIndex < 0) return;
    openLightbox(clickedIndex);
  });

  galleryGrid.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;

    const target = e.target;
    if (!(target instanceof Element)) return;

    const img = target.closest("img");
    if (!(img instanceof HTMLImageElement)) return;

    const focusedIndex = galleryImages.indexOf(img);
    if (focusedIndex < 0) return;

    e.preventDefault();
    openLightbox(focusedIndex);
  });

  lightbox.addEventListener("click", (e) => {
    const rawTarget = e.target;
    const targetEl =
      rawTarget instanceof Element
        ? rawTarget
        : rawTarget instanceof Node
          ? rawTarget.parentElement
          : null;
    if (!targetEl) return;

    const actionEl = targetEl.closest("[data-close], [data-nav]");
    if (!(actionEl instanceof HTMLElement)) return;

    if (actionEl.dataset.close === "1") {
      closeLightbox();
      return;
    }

    const navStep = Number(actionEl.dataset.nav);
    if (!Number.isNaN(navStep)) moveLightbox(navStep);
  });

  if (lightboxPrevBtn) {
    lightboxPrevBtn.addEventListener("click", (e) => {
      e.preventDefault();
      moveLightbox(-1);
    });
  }

  if (lightboxNextBtn) {
    lightboxNextBtn.addEventListener("click", (e) => {
      e.preventDefault();
      moveLightbox(1);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("is-open")) return;

    if (e.key === "ArrowRight") {
      moveLightbox(1);
      return;
    }

    if (e.key === "ArrowLeft") {
      moveLightbox(-1);
      return;
    }

    if (e.key === "Escape") {
      closeLightbox();
    }
  });

  lightbox.addEventListener(
    "wheel",
    (e) => {
      if (!lightbox.classList.contains("is-open")) return;

      const dominantDelta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(dominantDelta) < WHEEL_THRESHOLD) return;

      e.preventDefault();

      const now = Date.now();
      if (now < wheelLockUntil) return;
      wheelLockUntil = now + WHEEL_COOLDOWN_MS;

      moveLightbox(dominantDelta > 0 ? 1 : -1);
    },
    { passive: false }
  );

  lightbox.addEventListener(
    "touchstart",
    (e) => {
      if (!lightbox.classList.contains("is-open")) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      swipeStartX = touch.clientX;
      swipeStartY = touch.clientY;
    },
    { passive: true }
  );

  lightbox.addEventListener(
    "touchend",
    (e) => {
      if (!lightbox.classList.contains("is-open")) return;
      if (swipeStartX === null || swipeStartY === null) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - swipeStartX;
      const deltaY = touch.clientY - swipeStartY;
      swipeStartX = null;
      swipeStartY = null;

      if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
      if (Math.abs(deltaX) < Math.abs(deltaY) * SWIPE_DIRECTION_RATIO) return;

      moveLightbox(deltaX < 0 ? 1 : -1);
    },
    { passive: true }
  );

  lightbox.addEventListener("touchcancel", () => {
    swipeStartX = null;
    swipeStartY = null;
  });
}

// FAQ accordion
const faqButtons = /** @type {NodeListOf<HTMLButtonElement>} */ (
  document.querySelectorAll(".faq-q")
);

faqButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const isOpen = btn.classList.contains("is-open");

    faqButtons.forEach((buttonEl) => {
      buttonEl.classList.remove("is-open");
      buttonEl.setAttribute("aria-expanded", "false");
    });

    if (!isOpen) {
      btn.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
    }
  });
});


