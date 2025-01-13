let wakeLock = null;

async function toggleWakeLock() {
    const button = document.getElementById('wakeLockButton');

    try {
        if (wakeLock === null) {
            // Request wake lock
            wakeLock = await navigator.wakeLock.request('screen');
            button.setAttribute('aria-pressed', 'true');
            button.classList.add('active');
        } else {
            // Release wake lock
            await wakeLock.release();
            wakeLock = null;
            button.setAttribute('aria-pressed', 'false');
            button.classList.remove('active');
        }
    } catch (err) {
        console.error(`${err.name}, ${err.message}`);
    }
}

// Release wake lock when page becomes hidden
document.addEventListener('visibilitychange', () => {
    if (wakeLock !== null && document.visibilityState === 'hidden') {
        wakeLock.release();
        wakeLock = null;
        const button = document.getElementById('wakeLockButton');
        button.setAttribute('aria-pressed', 'false');
        button.classList.remove('active');
    }
}); 