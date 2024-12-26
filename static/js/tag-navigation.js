document.addEventListener('DOMContentLoaded', () => {
    // Event-Delegation für Tag-Klicks
    document.addEventListener('click', (e) => {
        const tagElement = e.target.closest('[data-href]');
        if (!tagElement) return;

        // Verhindern der Event-Bubble-Up zum umschließenden Link
        e.preventDefault();
        e.stopPropagation();

        // Zur Tag-Seite navigieren
        window.location.href = tagElement.dataset.href;
    });
}); 