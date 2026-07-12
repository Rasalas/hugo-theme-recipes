document.addEventListener('DOMContentLoaded', async () => {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const allRecipes = document.getElementById('all-recipes');
    const noResults = document.getElementById('no-results');
    const resultTemplate = document.querySelector('.js-search-result-template').innerHTML;
    const imageTemplate = document.querySelector('.js-image-template').innerHTML;
    const noImageTemplate = document.querySelector('.js-no-image-template').innerHTML;
    const toTopButton = document.getElementById('toTopButton');
    const clearButton = document.getElementById('search-clear');
    
    let fuse; // Declare fuse at the top level of our scope

    function showAllRecipes() {
        searchResults.classList.add('hidden');
        allRecipes.classList.remove('hidden');
        noResults.classList.add('hidden');
        searchInput.value = '';
        // Clear button visibility is now handled in search-input.html
    }

    // Function to update URL with search term
    function updateURL(searchTerm) {
        const url = new URL(window.location);
        if (searchTerm) {
            url.searchParams.set('q', searchTerm);
            window.history.pushState({ searchTerm }, '', url);
        } else {
            url.searchParams.delete('q');
            window.history.pushState({ searchTerm: null }, '', url);
        }
    }

    function appendHighlightedText(target, text, searchTerm) {
        target.replaceChildren();
        window.recipeSearchUtils.highlightSegments(text, searchTerm).forEach((segment) => {
            if (!segment.highlighted) {
                target.append(document.createTextNode(segment.text));
                return;
            }
            const mark = document.createElement('mark');
            mark.className = 'bg-amber-200 dark:bg-amber-700 dark:text-white';
            mark.textContent = segment.text;
            target.append(mark);
        });
    }

    function createSearchResult(result, searchTerm) {
        const container = document.createElement('div');
        container.innerHTML = resultTemplate;
        const element = container.firstElementChild;
        
        element.setAttribute('href', result.item.permalink);
        appendHighlightedText(element.querySelector('[data-title]'), result.item.title, searchTerm);
        
        const imageContainer = element.querySelector('.js-image-container');
        if (result.item.images && result.item.images.thumb) {
            const imgContainer = document.createElement('div');
            imgContainer.innerHTML = imageTemplate;
            const img = imgContainer.querySelector('img');
            img.setAttribute('src', result.item.images.thumb);
            img.setAttribute('data-src', result.item.images.thumb);
            img.setAttribute('alt', result.item.title);
            img.setAttribute('data-alt', result.item.title);
            imageContainer.appendChild(imgContainer.firstElementChild);
        } else {
            const noImgContainer = document.createElement('div');
            noImgContainer.innerHTML = noImageTemplate;
            noImgContainer.querySelector('[data-placeholder-letter]').textContent = result.item.title.trim().charAt(0).toUpperCase();
            
            imageContainer.appendChild(noImgContainer.firstElementChild);
        }
        
        if (result.item.description) {
            appendHighlightedText(element.querySelector('[data-description]'), result.item.description, searchTerm);
        } else if (result.item.content) {
            const preview = result.item.content.substring(0, 200) + '...';
            appendHighlightedText(element.querySelector('[data-description]'), preview, searchTerm);
        }

        if (result.item.aka && result.item.aka.length > 0) {
            const descriptionElement = element.querySelector('[data-description]');
            const aka = document.createElement('div');
            aka.className = 'text-neutral-600 dark:text-neutral-400 mt-1 text-sm mb-3';
            aka.append(document.createTextNode('aka: '));
            result.item.aka.forEach((name, index) => {
                if (index > 0) aka.append(document.createTextNode(', '));
                const highlightedName = document.createElement('span');
                appendHighlightedText(highlightedName, name, searchTerm);
                aka.append(highlightedName);
            });
            descriptionElement.append(aka);
        } else {
            element.querySelector('[data-description]').classList.add('mb-3');
        }
        
        if (result.item.tags && result.item.tags.length > 0) {
            const tagsContainer = element.querySelector('.js-tags-container');
            result.item.tags.forEach((tag) => {
                const badge = document.createElement('span');
                badge.className = 'badge badge-outline my-1 no-underline';
                badge.textContent = tag;
                tagsContainer.append(badge);
            });
        }
        
        return element.outerHTML;
    }

    // Function to perform search
    async function performSearch(searchTerm, updateHistory = true) {
        if (!fuse) return; // Guard clause if fuse isn't initialized yet

        if (updateHistory) {
            updateURL(searchTerm);
        }

        if (!searchTerm) {
            showAllRecipes();
            return;
        }

        if (searchTerm.length < 2) {
            return;
        }

        // Scroll nach oben wenn wir suchen
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });

        const results = fuse.search(searchTerm);
        const filteredResults = results.filter(result => result.score < 0.4);
        
        const uniqueResults = filteredResults.reduce((acc, current) => {
            const x = acc.find(item => item.item.permalink === current.item.permalink);
            if (!x) {
                return acc.concat([current]);
            } else {
                return acc;
            }
        }, []);

        searchResults.classList.remove('hidden');
        allRecipes.classList.add('hidden');
        
        if (uniqueResults.length) {
            searchResults.innerHTML = uniqueResults.map(result => createSearchResult(result, searchTerm)).join('');
            noResults.classList.add('hidden');
        } else {
            searchResults.innerHTML = '';
            noResults.classList.remove('hidden');
        }
    }

    try {
        // Use recipe hash if available, otherwise fallback to timestamp
        const hash = window.RECIPE_HASH || new Date().getTime();
        const response = await fetch(`/index.json?h=${hash}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        // Initialize Fuse
        fuse = new Fuse(data, {
            keys: [
                { name: 'title', weight: 2 },
                { name: 'description', weight: 1.5 },
                { name: 'tags', weight: 1 },
                { name: 'aka', weight: 1.8 },
                { name: 'content', weight: 0.7 }
            ],
            includeScore: true,
            threshold: 0.3,
            distance: 100,
            ignoreLocation: true,
            ignoreFieldNorm: true,
            useExtendedSearch: true,
            minMatchCharLength: 2
        });

        // Check for search term in URL on page load
        const urlParams = new URLSearchParams(window.location.search);
        const initialSearchTerm = urlParams.get('q')?.slice(0, 100);
        if (initialSearchTerm) {
            searchInput.value = initialSearchTerm;
            clearButton?.classList.remove('hidden');
            performSearch(initialSearchTerm, false); // Direkt suchen, ohne History-Update
        }
        
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const searchTerm = e.target.value.trim().slice(0, 100);
                performSearch(searchTerm);
            }, 300);
        });

        // Handle browser back/forward
        window.addEventListener('popstate', (event) => {
            const searchTerm = event.state?.searchTerm || '';
            searchInput.value = searchTerm;
            if (searchTerm) {
                clearButton.classList.remove('hidden');
            } else {
                clearButton.classList.add('hidden');
            }
            performSearch(searchTerm, false);
        });

        // Update showAllRecipes to handle URL
        window.showAllRecipes = function() {
            searchResults.classList.add('hidden');
            allRecipes.classList.remove('hidden');
            noResults.classList.add('hidden');
            searchInput.value = '';
            clearButton.classList.add('hidden');
            updateURL('');
        }
        
    } catch (error) {
        console.error('Error loading search index:', error);
        searchResults.innerHTML = '<p class="text-red-500 dark:text-red-400 text-center">Fehler beim Laden der Suche.</p>';
    }

    // Nach oben Button Funktionalität
    window.addEventListener('scroll', () => {
        if (window.scrollY > 200) {
            toTopButton.classList.remove('opacity-0', 'invisible');
            toTopButton.classList.add('opacity-100');
        } else {
            toTopButton.classList.add('opacity-0', 'invisible');
            toTopButton.classList.remove('opacity-100');
        }
    });

    function scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    // Expose scrollToTop to window for the button click
    window.scrollToTop = scrollToTop;

    // Füge Event Listener für Browser-Navigation hinzu
    window.addEventListener('popstate', function() {
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');
        const allRecipes = document.getElementById('all-recipes');
        
        // Setze Suche zurück
        searchInput.value = '';
        searchResults.classList.add('hidden');
        allRecipes.classList.remove('hidden');
    });
});
