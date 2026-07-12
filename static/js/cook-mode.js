(function (global) {
    const fractions = [
        [0.125, '1/8'],
        [0.25, '1/4'],
        [1 / 3, '1/3'],
        [0.5, '1/2'],
        [2 / 3, '2/3'],
        [0.75, '3/4'],
    ];

    function formatNumber(value) {
        const rounded = Math.round(Number(value) * 1000) / 1000;
        if (!Number.isFinite(rounded)) return '';
        if (Number.isInteger(rounded)) return String(rounded);

        const whole = Math.trunc(rounded);
        const remainder = Math.abs(rounded - whole);
        const fraction = fractions.find(([number]) => Math.abs(remainder - number) < 0.0001);
        if (fraction) {
            return whole === 0 ? fraction[1] : `${whole} ${fraction[1]}`;
        }
        return rounded.toLocaleString('de-DE', { maximumFractionDigits: 3 });
    }

    function formatScaledAmount(amount, maximum, factor, originalText = '') {
        const scaledMinimum = formatNumber(Number(amount) * factor);
        const hasMaximum = maximum !== null && maximum !== undefined && maximum !== '';
        const scaled = hasMaximum
            ? `${scaledMinimum}–${formatNumber(Number(maximum) * factor)}`
            : scaledMinimum;
        const original = String(originalText || '').trim();
        if (factor === 1 && original !== '') return original;
        if (original === '') return scaled;

        const number = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)`;
        const range = new RegExp(`${number}(?:\s*[–-]\s*${number})?`);
        if (range.test(original)) return original.replace(range, scaled);
        return `${scaled} · ${original}`;
    }

    function formatTimer(seconds) {
        const safeSeconds = Math.max(0, Math.ceil(seconds));
        const hours = Math.floor(safeSeconds / 3600);
        const minutes = Math.floor((safeSeconds % 3600) / 60);
        const rest = safeSeconds % 60;
        return hours > 0
            ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
            : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
    }

    function shouldDismissSheet(distance, elapsedMilliseconds) {
        const safeDistance = Math.max(0, Number(distance) || 0);
        const safeElapsed = Math.max(1, Number(elapsedMilliseconds) || 0);
        return safeDistance >= 96 || safeDistance / safeElapsed >= .6;
    }

    const api = { formatNumber, formatScaledAmount, formatTimer, shouldDismissSheet };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof document === 'undefined') return;

    function init() {
        const recipe = document.getElementById('structuredRecipe');
        if (!recipe) return;

        const storageKey = `recipe-state:v1:${recipe.dataset.recipeKey}`;
        const baseServings = Number(recipe.dataset.baseServings || 0);
        const portionOutput = recipe.querySelector('[data-portion-current]');
        const portionContext = recipe.querySelector('[data-portion-context]');
        const checkboxes = Array.from(recipe.querySelectorAll('[data-ingredient-check]'));
        let state = loadState(storageKey);
        let currentServings = Number(state.servings) > 0 ? Number(state.servings) : baseServings;

        function saveState() {
            state = {
                servings: currentServings || undefined,
                checked: checkboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.dataset.ingredientCheck),
            };
            try {
                localStorage.setItem(storageKey, JSON.stringify(state));
            } catch (error) {
                // The recipe remains fully usable when storage is unavailable.
            }
        }

        const checked = new Set(Array.isArray(state.checked) ? state.checked : []);
        checkboxes.forEach((checkbox) => {
            checkbox.checked = checked.has(checkbox.dataset.ingredientCheck);
            checkbox.addEventListener('change', saveState);
        });

        function updatePortions() {
            if (!(baseServings > 0) || !(currentServings > 0)) return;
            const factor = currentServings / baseServings;
            if (portionOutput) portionOutput.textContent = formatNumber(currentServings);
            if (portionContext) {
                const original = recipe.dataset.servingOriginal || `${formatNumber(baseServings)} Portionen`;
                portionContext.textContent = `Original: ${original} · Faktor ${formatNumber(factor)}×`;
            }
            recipe.querySelectorAll('[data-amount]').forEach((amount) => {
                amount.textContent = formatScaledAmount(
                    Number(amount.dataset.amount),
                    amount.dataset.amountMax,
                    factor,
                    amount.dataset.originalText
                );
            });
        }

        recipe.querySelector('[data-portion-decrease]')?.addEventListener('click', () => {
            const minimum = Math.min(1, baseServings);
            currentServings = Math.max(minimum, currentServings - 1);
            updatePortions();
            saveState();
        });
        recipe.querySelector('[data-portion-increase]')?.addEventListener('click', () => {
            currentServings += 1;
            updatePortions();
            saveState();
        });

        const timerStates = new Map();
        const timerDefaults = new Map();
        const announcement = recipe.querySelector('[data-timer-announcement]');

        function timerButtons(timerID) {
            return recipe.querySelectorAll(`[data-timer-button="${timerID}"]`);
        }

        function rememberTimerButton(button) {
            const timerID = button.dataset.timerButton;
            if (!timerDefaults.has(timerID)) {
                timerDefaults.set(timerID, button.textContent.trim().replace(/\s+/g, ' '));
            }
        }

        function paintTimer(timerID, text, className = '') {
            timerButtons(timerID).forEach((button) => {
                rememberTimerButton(button);
                button.textContent = text;
                button.classList.toggle('is-running', className === 'is-running');
                button.classList.toggle('is-complete', className === 'is-complete');
            });
        }

        function resetTimer(timerID) {
            const timer = timerStates.get(timerID);
            if (timer?.interval) clearInterval(timer.interval);
            timerStates.delete(timerID);
            paintTimer(timerID, timerDefaults.get(timerID) || 'Timer starten');
        }

        function startTimer(button) {
            const timerID = button.dataset.timerButton;
            rememberTimerButton(button);
            if (timerStates.has(timerID)) {
                resetTimer(timerID);
                return;
            }
            const duration = Number(button.dataset.durationSeconds);
            if (!(duration > 0)) return;
            const label = button.dataset.timerLabel || 'Timer';
            const timer = { end: Date.now() + duration * 1000, interval: null };
            timerStates.set(timerID, timer);

            const tick = () => {
                const remaining = Math.max(0, Math.ceil((timer.end - Date.now()) / 1000));
                if (remaining === 0) {
                    clearInterval(timer.interval);
                    timerStates.delete(timerID);
                    paintTimer(timerID, `${label}: fertig`, 'is-complete');
                    if (announcement) announcement.textContent = `${label} ist fertig.`;
                    return;
                }
                paintTimer(timerID, `${label}: ${formatTimer(remaining)} · stoppen`, 'is-running');
            };
            tick();
            timer.interval = setInterval(tick, 1000);
        }

        recipe.querySelectorAll('[data-timer-button]').forEach(rememberTimerButton);
        recipe.addEventListener('click', (event) => {
            const timerButton = event.target.closest('[data-timer-button]');
            if (timerButton) startTimer(timerButton);
        });

        const dialog = recipe.querySelector('[data-cook-mode-dialog]');
        const originalSteps = Array.from(recipe.querySelectorAll('.recipe-steps > [data-cook-step]'));
        const cookContent = recipe.querySelector('[data-cook-mode-content]');
        const progress = recipe.querySelector('[data-cook-progress]');
        const progressBar = recipe.querySelector('[data-cook-progress-bar]');
        const previous = recipe.querySelector('[data-cook-previous]');
        const next = recipe.querySelector('[data-cook-next]');
        const dragHandle = recipe.querySelector('[data-cook-mode-drag-handle]');
        const mobileCookMode = global.matchMedia('(max-width: 760px)');
        const reducedMotion = global.matchMedia('(prefers-reduced-motion: reduce)');
        let currentStep = 0;
        let closing = false;

        function dialogIsOpen() {
            return dialog?.open || dialog?.hasAttribute('open');
        }

        function renderCookStep() {
            if (!cookContent || originalSteps.length === 0) return;
            const clone = originalSteps[currentStep].cloneNode(true);
            clone.removeAttribute('data-cook-step');
            clone.classList.add('cook-mode-clone');
            cookContent.replaceChildren(clone);
            clone.querySelectorAll('[data-timer-button]').forEach((button) => {
                const timerID = button.dataset.timerButton;
                const active = timerStates.get(timerID);
                if (active) {
                    const remaining = Math.max(0, Math.ceil((active.end - Date.now()) / 1000));
                    paintTimer(timerID, `${button.dataset.timerLabel || 'Timer'}: ${formatTimer(remaining)} · stoppen`, 'is-running');
                }
            });
            if (progress) progress.textContent = `Schritt ${currentStep + 1} von ${originalSteps.length}`;
            if (progressBar) progressBar.style.width = `${((currentStep + 1) / originalSteps.length) * 100}%`;
            if (previous) previous.disabled = currentStep === 0;
            if (next) next.textContent = currentStep === originalSteps.length - 1 ? 'Fertig ✓' : 'Weiter →';
        }

        async function openCookMode() {
            if (!dialog || originalSteps.length === 0) return;
            currentStep = 0;
            renderCookStep();
            if (mobileCookMode.matches && !reducedMotion.matches) {
                dialog.style.setProperty('--sheet-translate-y', '100%');
            }
            if (typeof dialog.showModal === 'function') dialog.showModal();
            else dialog.setAttribute('open', '');
            if (mobileCookMode.matches && !reducedMotion.matches) {
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    dialog.style.setProperty('--sheet-translate-y', '0px');
                }));
            }
            await global.recipeWakeLock?.acquire();
            dialog.querySelector('#cook-mode-title')?.focus();
        }

        async function closeCookMode() {
            if (!dialog || closing || !dialogIsOpen()) return;
            closing = true;
            if (mobileCookMode.matches && !reducedMotion.matches) {
                dialog.classList.remove('is-dragging');
                dialog.classList.add('is-closing');
                dialog.style.setProperty('--sheet-translate-y', '100%');
                await new Promise((resolve) => {
                    const timeout = setTimeout(resolve, 320);
                    dialog.addEventListener('transitionend', (event) => {
                        if (event.propertyName !== 'transform') return;
                        clearTimeout(timeout);
                        resolve();
                    }, { once: true });
                });
            }
            if (typeof dialog.close === 'function' && dialog.open) dialog.close();
            else dialog.removeAttribute('open');
            dialog.classList.remove('is-closing', 'is-dragging');
            dialog.style.removeProperty('--sheet-translate-y');
            closing = false;
            await global.recipeWakeLock?.release();
        }

        if (dragHandle) {
            let dragStartY = 0;
            let dragStartTime = 0;
            let dragDistance = 0;

            dragHandle.addEventListener('pointerdown', (event) => {
                if (!mobileCookMode.matches || closing || event.button !== 0) return;
                dragStartY = event.clientY;
                dragStartTime = performance.now();
                dragDistance = 0;
                dialog.classList.add('is-dragging');
                dragHandle.setPointerCapture(event.pointerId);
            });

            global.addEventListener('pointermove', (event) => {
                if (!dialog.classList.contains('is-dragging')) return;
                dragDistance = Math.max(0, event.clientY - dragStartY);
                dialog.style.setProperty('--sheet-translate-y', `${dragDistance}px`);
            });

            const finishDrag = (event) => {
                if (!dialog.classList.contains('is-dragging')) return;
                if (dragHandle.hasPointerCapture(event.pointerId)) dragHandle.releasePointerCapture(event.pointerId);
                dialog.classList.remove('is-dragging');
                const elapsed = Math.max(1, performance.now() - dragStartTime);
                if (shouldDismissSheet(dragDistance, elapsed)) closeCookMode();
                else dialog.style.setProperty('--sheet-translate-y', '0px');
            };

            global.addEventListener('pointerup', finishDrag);
            global.addEventListener('pointercancel', finishDrag);
        }

        recipe.querySelector('[data-cook-mode-open]')?.addEventListener('click', openCookMode);
        recipe.querySelector('[data-cook-mode-close]')?.addEventListener('click', closeCookMode);
        previous?.addEventListener('click', () => {
            if (currentStep > 0) currentStep -= 1;
            renderCookStep();
        });
        next?.addEventListener('click', () => {
            if (currentStep >= originalSteps.length - 1) closeCookMode();
            else {
                currentStep += 1;
                renderCookStep();
            }
        });
        dialog?.addEventListener('cancel', (event) => {
            event.preventDefault();
            closeCookMode();
        });
        dialog?.addEventListener('close', () => global.recipeWakeLock?.release());
        recipe.querySelector('[data-wake-lock-toggle]')?.addEventListener('click', () => global.recipeWakeLock?.toggle());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && dialogIsOpen()) global.recipeWakeLock?.acquire();
        });

        recipe.querySelector('[data-recipe-reset]')?.addEventListener('click', () => {
            try { localStorage.removeItem(storageKey); } catch (error) { /* no-op */ }
            checkboxes.forEach((checkbox) => { checkbox.checked = false; });
            currentServings = baseServings;
            Array.from(timerDefaults.keys()).forEach(resetTimer);
            updatePortions();
            closeCookMode();
            saveState();
        });

        updatePortions();
    }

    function loadState(key) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || '{}');
            return value && typeof value === 'object' ? value : {};
        } catch (error) {
            return {};
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    global.recipeCookMode = api;
})(typeof window !== 'undefined' ? window : globalThis);
