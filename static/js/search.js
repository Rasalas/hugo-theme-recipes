document.addEventListener('DOMContentLoaded', () => {
    const dialog = document.getElementById('recipe-search-dialog');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const searchIdle = document.getElementById('search-idle');
    const noResults = document.getElementById('no-results');
    const resultTemplate = document.getElementById('search-result-template');
    const imageTemplate = document.getElementById('search-image-template');
    const noImageTemplate = document.getElementById('search-no-image-template');
    const tagFilter = document.getElementById('search-tag-filter');
    const durationFilter = document.getElementById('search-duration-filter');
    const durationControl = document.getElementById('search-duration-control');
    const searchControls = document.getElementById('search-controls');
    const searchStatus = document.getElementById('search-status');
    const clearButton = document.getElementById('search-clear');
    const utils = window.recipeSearchUtils;

    if (!dialog || !searchInput || !searchResults || !resultTemplate || !utils) return;

    let fuse;
    let recipes = [];
    let debounceTimer;
    let suppressCloseReset = false;

    function safeUrl(value) {
        try {
            const url = new URL(String(value ?? ''), window.location.origin);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
        } catch {
            return '#';
        }
    }

    function appendHighlightedText(target, text, query) {
        const fragment = document.createDocumentFragment();
        utils.highlightSegments(text, query).forEach((segment) => {
            if (!segment.highlighted) {
                fragment.append(document.createTextNode(segment.text));
                return;
            }
            const mark = document.createElement('mark');
            mark.textContent = segment.text;
            fragment.append(mark);
        });
        target.replaceChildren(fragment);
    }

    function createSearchResult(result, query) {
        const element = resultTemplate.content.firstElementChild.cloneNode(true);
        element.href = safeUrl(result.item.permalink);
        appendHighlightedText(element.querySelector('[data-title]'), result.item.title, query);

        const imageContainer = element.querySelector('.js-image-container');
        if (result.item.images?.thumb && imageTemplate) {
            const image = imageTemplate.content.firstElementChild.cloneNode(true);
            const img = image.querySelector('img');
            const imageUrl = safeUrl(result.item.images.thumb);
            img.src = imageUrl;
            img.dataset.src = imageUrl;
            img.alt = result.item.title;
            img.dataset.alt = result.item.title;
            imageContainer.append(image);
        } else if (noImageTemplate) {
            const placeholder = noImageTemplate.content.firstElementChild.cloneNode(true);
            placeholder.querySelector('[data-placeholder-letter]').textContent = result.item.title.trim().charAt(0).toUpperCase();
            imageContainer.append(placeholder);
        }

        const description = element.querySelector('[data-description]');
        const preview = result.item.description || String(result.item.content || '').substring(0, 180);
        appendHighlightedText(description, preview, query);

        if (result.item.aka?.length) {
            const aka = document.createElement('span');
            aka.className = 'search-result-aka';
            aka.textContent = `Auch: ${result.item.aka.join(', ')}`;
            description.append(aka);
        }

        const tagsContainer = element.querySelector('.js-tags-container');
        (result.item.tags || []).slice(0, 4).forEach((tag) => {
            const badge = document.createElement('span');
            badge.className = 'badge badge-outline my-1 no-underline';
            badge.textContent = tag;
            tagsContainer.append(badge);
        });
        return element;
    }

    function normalizedState(rawState) {
        const duration = String(rawState.duration ?? '');
        const knownDuration = durationFilter && [...durationFilter.options].some((option) => option.value === duration);
        return {
            query: utils.normalizeSearchTerm(rawState.query),
            tag: String(rawState.tag ?? '').trim().slice(0, 100),
            duration: knownDuration && !durationControl?.classList.contains('hidden') ? duration : '',
        };
    }

    function syncHistory(state, mode) {
        if (mode === 'none') return;
        const url = utils.buildSearchUrl(window.location.href, state);
        window.history[mode === 'push' ? 'pushState' : 'replaceState'](state, '', url);
    }

    function showIdle() {
        searchResults.replaceChildren();
        searchResults.classList.add('hidden');
        noResults.classList.add('hidden');
        searchIdle.classList.remove('hidden');
        searchStatus.textContent = fuse ? 'Bereit zum Suchen.' : 'Suchindex wird geladen …';
    }

    function renderResults(results, query) {
        const fragment = document.createDocumentFragment();
        results.forEach((result) => fragment.append(createSearchResult(result, query)));
        searchResults.replaceChildren(fragment);
        searchResults.classList.toggle('hidden', results.length === 0);
        noResults.classList.toggle('hidden', results.length > 0);
        searchIdle.classList.add('hidden');
        searchStatus.textContent = results.length === 1 ? '1 Rezept gefunden' : `${results.length} Rezepte gefunden`;
    }

    function applySearchState(rawState, historyMode = 'none', syncControls = true) {
        const state = normalizedState(rawState);
        if (syncControls) searchInput.value = state.query;
        if (tagFilter) tagFilter.value = [...tagFilter.options].some((option) => option.value === state.tag) ? state.tag : '';
        state.tag = tagFilter?.value || '';
        if (durationFilter) durationFilter.value = state.duration;
        clearButton?.classList.toggle('hidden', !searchInput.value.trim());
        syncHistory(state, historyMode);

        if (!fuse || (!state.query && !state.tag && !state.duration)) {
            showIdle();
            return;
        }

        const matches = state.query
            ? fuse.search(state.query).filter((result) => result.score < 0.4)
            : recipes.map((item) => ({ item, score: 0 }));
        const tagged = utils.filterResultsByTag(matches, state.tag);
        const filtered = utils.filterResultsByDuration(tagged, state.duration);
        renderResults(utils.uniqueResults(filtered), state.query);
    }

    function openSearch() {
        if (!dialog.open) dialog.showModal();
        document.dispatchEvent(new CustomEvent('recipe-search-opened'));
        requestAnimationFrame(() => searchInput.focus());
    }

    function closeSearchWithoutReset() {
        suppressCloseReset = true;
        if (dialog.open) dialog.close();
    }

    function resetSearch(historyMode = 'replace') {
        searchInput.value = '';
        if (tagFilter) tagFilter.value = '';
        if (durationFilter) durationFilter.value = '';
        applySearchState({ query: '', tag: '', duration: '' }, historyMode);
    }

    document.querySelectorAll('[data-search-open]').forEach((button) => button.addEventListener('click', openSearch));
    dialog.querySelector('[data-search-close]')?.addEventListener('click', () => dialog.close());
    dialog.querySelector('[data-search-reset]')?.addEventListener('click', () => {
        resetSearch();
        searchInput.focus();
    });
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
        if (suppressCloseReset) {
            suppressCloseReset = false;
            return;
        }
        resetSearch('replace');
    });

    searchInput.addEventListener('input', (event) => {
        clearTimeout(debounceTimer);
        clearButton?.classList.toggle('hidden', !event.target.value.trim());
        debounceTimer = setTimeout(() => applySearchState({
            query: event.target.value,
            tag: tagFilter?.value,
            duration: durationFilter?.value,
        }, 'replace', false), 180);
    });
    clearButton?.addEventListener('click', () => {
        resetSearch();
        searchInput.focus();
    });
    tagFilter?.addEventListener('change', () => applySearchState({
        query: searchInput.value,
        tag: tagFilter.value,
        duration: durationFilter?.value,
    }, 'replace'));
    durationFilter?.addEventListener('change', () => applySearchState({
        query: searchInput.value,
        tag: tagFilter?.value,
        duration: durationFilter.value,
    }, 'replace'));

    dialog.addEventListener('keydown', (event) => {
        if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
        const links = [...searchResults.querySelectorAll('a')];
        if (links.length === 0) return;
        event.preventDefault();
        const current = links.indexOf(document.activeElement);
        const next = event.key === 'ArrowDown'
            ? (current + 1) % links.length
            : (current <= 0 ? links.length - 1 : current - 1);
        links[next].focus();
    });

    document.addEventListener('keydown', (event) => {
        const target = event.target;
        const isTyping = target instanceof HTMLElement
            && (target.matches('input, textarea, select') || target.isContentEditable);
        const commandShortcut = (event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k';
        const slashShortcut = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey
            && !event.shiftKey && !isTyping && !dialog.open;
        if (commandShortcut || slashShortcut) {
            event.preventDefault();
            openSearch();
        }
    });
    window.addEventListener('popstate', () => {
        const state = utils.parseSearchState(window.location.search);
        if (state.query || state.tag || state.duration) {
            openSearch();
            applySearchState(state);
        } else {
            closeSearchWithoutReset();
        }
    });

    async function initializeSearch() {
        showIdle();
        try {
            const response = await fetch(`/index.json?h=${encodeURIComponent(window.RECIPE_HASH || 'dev')}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            recipes = await response.json();
            fuse = new Fuse(recipes, {
                keys: [
                    { name: 'title', weight: 2 },
                    { name: 'aka', weight: 1.8 },
                    { name: 'description', weight: 1.5 },
                    { name: 'tags', weight: 1 },
                    { name: 'content', weight: 0.7 },
                ],
                includeScore: true,
                threshold: 0.3,
                distance: 100,
                ignoreLocation: true,
                ignoreFieldNorm: true,
                useExtendedSearch: false,
                minMatchCharLength: 2,
            });

            const tags = [...new Set(recipes.flatMap((recipe) => recipe.tags || []))].sort((a, b) => a.localeCompare(b, 'de'));
            tags.forEach((tag) => {
                const option = document.createElement('option');
                option.value = tag;
                option.textContent = tag;
                tagFilter?.append(option);
            });
            searchControls?.classList.remove('hidden');
            durationControl?.classList.toggle('hidden', !utils.durationFilterAvailable(recipes));

            const initialState = utils.parseSearchState(window.location.search);
            if (initialState.query || initialState.tag || initialState.duration || document.querySelector('[data-search-autostart]')) {
                openSearch();
                applySearchState(initialState);
            } else {
                showIdle();
            }
        } catch (error) {
            console.error('Error loading search index:', error);
            searchIdle.classList.remove('hidden');
            searchIdle.querySelector('p').textContent = 'Die Suche konnte nicht geladen werden.';
            searchIdle.querySelector('small').textContent = 'Bitte lade die Seite erneut.';
            searchStatus.textContent = 'Suchindex nicht verfügbar.';
        }
    }

    initializeSearch();
});
