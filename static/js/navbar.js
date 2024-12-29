let lastScrollTop = 0;
let lastScrollTime = Date.now();
let lastShowTime = 0;
const navbar = document.querySelector('header');
const SCROLL_THRESHOLD = 100; // Basis-Schwellenwert
const VELOCITY_THRESHOLD = 50; // Pixel pro 100ms für "schnelles" Scrollen
const STICKY_DURATION = 1000; // Navbar bleibt mindestens 1 Sekunde sichtbar
let scrollDirection = 'none';

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
    const currentTime = Date.now();
    const timeDiff = currentTime - lastScrollTime;
    const scrollDiff = Math.abs(currentScroll - lastScrollTop);
    
    // Berechne Scroll-Geschwindigkeit (Pixel pro 100ms)
    const velocity = (scrollDiff / timeDiff) * 100;
    
    // Dynamischer Schwellenwert basierend auf Geschwindigkeit
    const dynamicThreshold = velocity > VELOCITY_THRESHOLD ? 
        SCROLL_THRESHOLD * 0.3 : // Bei schnellem Scrollen: reduzierter Schwellenwert
        SCROLL_THRESHOLD;        // Bei langsamem Scrollen: normaler Schwellenwert
    
    // Prüfe, ob die Sticky-Duration noch aktiv ist
    const isSticky = (currentTime - lastShowTime) < STICKY_DURATION;
    
    // Immer anzeigen, wenn ganz oben
    if (currentScroll <= 0) {
        scrollDirection = 'up';
        navbar.style.transform = 'translateY(0)';
        navbar.style.transition = 'transform 0.3s ease-in-out';
        lastShowTime = currentTime;
    } else if (currentScroll > lastScrollTop && !isSticky) {
        // Nach unten scrollen (nur wenn nicht sticky und nicht ganz oben)
        if (scrollDirection !== 'down') {
            scrollDirection = 'down';
            navbar.style.transform = 'translateY(-100%)';
            navbar.style.transition = 'transform 0.3s ease-in-out';
        }
    } else if (currentScroll < lastScrollTop) {
        // Nach oben scrollen
        if (currentScroll < (lastScrollTop - dynamicThreshold)) {
            if (scrollDirection !== 'up') {
                scrollDirection = 'up';
                navbar.style.transform = 'translateY(0)';
                navbar.style.transition = 'transform 0.3s ease-in-out';
                lastShowTime = currentTime;
            }
        }
    }
    
    lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
    lastScrollTime = currentTime;
}); 