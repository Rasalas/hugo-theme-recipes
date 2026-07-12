document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.site-header');
    const menuButton = document.getElementById('mobile-menu-button');
    const menu = document.getElementById('mobile-menu');
    if (!header || !menuButton || !menu) return;

    let lastScroll = window.scrollY;
    let ticking = false;

    function setMenu(open) {
        menu.dataset.open = String(open);
        menuButton.setAttribute('aria-expanded', String(open));
        menuButton.querySelector('.sr-only').textContent = open ? 'Navigation schließen' : 'Navigation öffnen';
        document.body.classList.toggle('menu-open', open);
        header.classList.remove('is-hidden');
    }

    menuButton.addEventListener('click', () => setMenu(menu.dataset.open !== 'true'));
    menu.addEventListener('click', (event) => {
        if (event.target.closest('a, [data-search-open]')) setMenu(false);
    });
    document.addEventListener('recipe-search-opened', () => setMenu(false));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && menu.dataset.open === 'true') {
            setMenu(false);
            menuButton.focus();
        }
    });

    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            const current = window.scrollY;
            const shouldHide = current > 140 && current > lastScroll + 4 && menu.dataset.open !== 'true';
            const shouldShow = current < lastScroll - 4 || current < 40;
            if (shouldHide) header.classList.add('is-hidden');
            if (shouldShow) header.classList.remove('is-hidden');
            header.classList.toggle('is-scrolled', current > 16);
            lastScroll = current;
            ticking = false;
        });
    }, { passive: true });
});
