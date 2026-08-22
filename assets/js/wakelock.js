(function () {
    let wakeLock = null;
    let lastError = '';

    function updateUI() {
        const active = wakeLock !== null;
        const legacyButton = document.getElementById('wakeLockButton');
        if (legacyButton) {
            legacyButton.setAttribute('aria-pressed', active ? 'true' : 'false');
            legacyButton.classList.toggle('active', active);
            legacyButton.setAttribute('aria-label', active ? 'Bildschirm bleibt an' : 'Bildschirm anlassen');
            legacyButton.setAttribute('title', active ? 'Bildschirm bleibt an' : 'Bildschirm anlassen');
        }
        document.querySelectorAll('[data-wake-lock-toggle]').forEach((button) => {
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
            button.classList.toggle('active', active);
            button.setAttribute('aria-label', active ? 'Bildschirm bleibt an' : 'Bildschirm anlassen');
            button.setAttribute('title', active ? 'Bildschirm bleibt an' : 'Bildschirm anlassen');
        });
        document.querySelectorAll('[data-wake-lock-status]').forEach((status) => {
            status.textContent = lastError || (active
                ? 'Bildschirm-Wachmodus ist aktiv.'
                : 'Bildschirm-Wachmodus ist aus.');
        });
        document.dispatchEvent(new CustomEvent('recipe:wake-lock', { detail: { active, error: lastError } }));
    }

    async function acquire() {
        lastError = '';
        if (wakeLock !== null) {
            updateUI();
            return true;
        }
        if (!('wakeLock' in navigator)) {
            lastError = 'Dieser Browser unterstützt den Bildschirm-Wachmodus nicht.';
            updateUI();
            return false;
        }
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                wakeLock = null;
                updateUI();
            }, { once: true });
            updateUI();
            return true;
        } catch (error) {
            wakeLock = null;
            lastError = 'Der Bildschirm-Wachmodus konnte nicht aktiviert werden.';
            updateUI();
            return false;
        }
    }

    async function release() {
        lastError = '';
        if (wakeLock !== null) {
            const lock = wakeLock;
            wakeLock = null;
            try {
                await lock.release();
            } catch (error) {
                lastError = 'Der Bildschirm-Wachmodus konnte nicht sauber beendet werden.';
            }
        }
        updateUI();
    }

    async function toggle() {
        return wakeLock === null ? acquire() : release();
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            release();
        }
    });

    window.recipeWakeLock = {
        acquire,
        release,
        toggle,
        isActive: () => wakeLock !== null,
    };
    window.toggleWakeLock = toggle;
    updateUI();
})();
