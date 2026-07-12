document.addEventListener('DOMContentLoaded', async () => {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const allRecipes = document.getElementById('all-recipes');
    const noResults = document.getElementById('no-results');
    const resultTemplate = document.getElementById('search-result-template');
    const imageTemplate = document.getElementById('search-image-template');
    const noImageTemplate = document.getElementById('search-no-image-template');
    const tagFilter = document.getElementById('search-tag-filter');
    const durationFilter = document.getElementById('search-duration-filter');
    const durationControl = document.getElementById('search-duration-control');
    const searchControls = document.getElementById('search-controls');
    const searchStatus = document.getElementById('search-status');
    const toTopButton = document.getElementById('toTopButton');
    const clearButton = document.getElementById('search-clear');
    const utils = window.recipeSearchUtils;

    if (!searchInput || !searchResults || !allRecipes || !noResults || !resultTemplate || !utils) return;

    let fuse;
    let recipes = [];

    function appendHighlightedText(target, text, searchTerm) {
        const fragment = document.createDocumentFragment();
        utils.highlightSegments(text, searchTerm).forEach((segment) => {
            if (!segment.highlighted) {
                fragment.append(document.createTextNode(segment.text));
                return;
            }
            const mark = document.createElement('mark');
            mark.className = 'bg-amber-200 dark:bg-amber-700 dark:text-white';
            mark.textContent = segment.text;
            fragment.append(mark);
        });
        target.replaceChildren(fragment);
    }

    function safeUrl(value) {
        try {
            const url = new URL(String(value ?? ''), window.location.origin);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
        } catch {
            return '#';
        }
    }

    function createSearchResult(result, searchTerm) {
        const element = resultTemplate.content.firstElementChild.cloneNode(true);
        element.href = safeUrl(result.item.permalink);
        appendHighlightedText(element.querySelector('[data-title]'), result.item.title, searchTerm);

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
        if (result.item.description) {
            appendHighlightedText(description, result.item.description, searchTerm);
        } else if (result.item.content) {
            const suffix = result.item.content.length > 200 ? '…' : '';
            appendHighlightedText(description, result.item.content.substring(0, 200) + suffix, searchTerm);
        }

        if (result.item.aka?.length) {
            const aka = document.createElement('div');
            aka.className = 'text-neutral-600 dark:text-neutral-400 mt-1 text-sm mb-3';
            aka.append(document.createTextNode('aka: '));
            result.item.aka.forEach((name, index) => {
                if (index > 0) aka.append(document.createTextNode(', '));
                const highlightedName = document.createElement('span');
                appendHighlightedText(highlightedName, name, searchTerm);
                aka.append(highlightedName);
            });
            description.append(aka);
        } else {
            description.classList.add('mb-3');
        }

        const tagsContainer = element.querySelector('.js-tags-container');
        (result.item.tags || []).forEach((tag) => {
            const badge = document.createElement('span');
            badge.className = 'badge badge-outline my-1 no-underline';
            badge.textContent = tag;
            tagsContainer.append(badge);
        });
        return element;
    }

    function syncHistory(state, mode) {
        if (mode === 'none') return;
        const url = utils.buildSearchUrl(window.location.href, state);
        window.history[mode === 'push' ? 'pushState' : 'replaceState'](state, '', url);
    }

    function showAllRecipes() {
        searchResults.replaceChildren();
        searchResults.classList.add('hidden');
        allRecipes.classList.remove('hidden');
        noResults.classList.add('hidden');
        searchStatus.textContent = `${recipes.length} Rezepte werden angezeigt.`;
    }

    function renderResults(results, query) {
        const fragment = document.createDocumentFragment();
        results.forEach((result) => fragment.append(createSearchResult(result, query)));
        searchResults.replaceChildren(fragment);
        searchResults.classList.remove('hidden');
        allRecipes.classList.add('hidden');
        noResults.classList.toggle('hidden', results.length > 0);
        searchStatus.textContent = results.length === 1 ? '1 Rezept gefunden.' : `${results.length} Rezepte gefunden.`;
    }

    function applySearchState(rawState, historyMode = 'none', syncControls = true) {
        if (!fuse) return;
        const state = {
            query: utils.normalizeSearchTerm(rawState.query),
            tag: String(rawState.tag ?? '').trim().slice(0, 100),
            duration: String(rawState.duration ?? ''),
        };
        if (syncControls) searchInput.value = state.query;
        if (tagFilter) tagFilter.value = [...tagFilter.options].some((option) => option.value === state.tag) ? state.tag : '';
        state.tag = tagFilter?.value || '';
        if (durationFilter) durationFilter.value = [...durationFilter.options].some((option) => option.value === state.duration) ? state.duration : '';
        state.duration = durationControl?.classList.contains('hidden') ? '' : (durationFilter?.value || '');
        clearButton?.classList.toggle('hidden', !searchInput.value.trim());
        syncHistory(state, historyMode);

        if (!state.query && !state.tag && !state.duration) {
            showAllRecipes();
            return;
        }

        const matches = state.query ? fuse.search(state.query).filter((result) => result.score < 0.4) : recipes.map((item) => ({ item, score: 0 }));
        const tagged = utils.filterResultsByTag(matches, state.tag);
        renderResults(utils.uniqueResults(utils.filterResultsByDuration(tagged, state.duration)), state.query);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function populateTags() {
        if (!tagFilter) return;
        const tags = [...new Set(recipes.flatMap((recipe) => recipe.tags || []))].sort((a, b) => a.localeCompare(b, 'de'));
        tags.forEach((tag) => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            tagFilter.append(option);
        });
        searchControls?.classList.remove('hidden');
        durationControl?.classList.toggle('hidden', !utils.durationFilterAvailable(recipes));
    }

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

        populateTags();
        applySearchState(utils.parseSearchState(window.location.search));

        let debounceTimer;
        searchInput.addEventListener('input', (event) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => applySearchState({
                query: event.target.value,
                tag: tagFilter?.value,
                duration: durationFilter?.value,
            }, 'replace', false), 300);
        });
        tagFilter?.addEventListener('change', () => applySearchState({
            query: searchInput.value,
            tag: tagFilter.value,
            duration: durationFilter?.value,
        }, 'push'));
        durationFilter?.addEventListener('change', () => applySearchState({
            query: searchInput.value,
            tag: tagFilter?.value,
            duration: durationFilter.value,
        }, 'push'));
        window.addEventListener('popstate', () => applySearchState(utils.parseSearchState(window.location.search)));

        window.showAllRecipes = function () {
            searchInput.value = '';
            if (tagFilter) tagFilter.value = '';
            if (durationFilter) durationFilter.value = '';
            clearButton?.classList.add('hidden');
            applySearchState({ query: '', tag: '', duration: '' }, 'push');
        };
    } catch (error) {
        console.error('Error loading search index:', error);
        const message = document.createElement('p');
        message.className = 'text-red-500 dark:text-red-400 text-center';
        message.textContent = 'Fehler beim Laden der Suche.';
        searchResults.replaceChildren(message);
        searchResults.classList.remove('hidden');
        searchStatus.textContent = 'Die Suche konnte nicht geladen werden.';
    }

    window.addEventListener('scroll', () => {
        if (!toTopButton) return;
        const scrolled = window.scrollY > 200;
        toTopButton.classList.toggle('opacity-0', !scrolled);
        toTopButton.classList.toggle('invisible', !scrolled);
        toTopButton.classList.toggle('opacity-100', scrolled);
    });
    window.scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
});
