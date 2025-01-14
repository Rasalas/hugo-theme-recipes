document.addEventListener('DOMContentLoaded', async () => {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const allRecipes = document.getElementById('all-recipes');
    const resultTemplate = document.querySelector('.js-search-result-template').innerHTML;
    const imageTemplate = document.querySelector('.js-image-template').innerHTML;
    const noImageTemplate = document.querySelector('.js-no-image-template').innerHTML;
    const toTopButton = document.getElementById('toTopButton');
    const clearButton = document.getElementById('search-clear');
    
    let fuse; // Declare fuse at the top level of our scope

    // Clear button functionality
    searchInput.addEventListener('input', function() {
        if (this.value) {
            clearButton.classList.remove('hidden');
        } else {
            clearButton.classList.add('hidden');
        }
    });

    function showAllRecipes() {
        searchResults.classList.add('hidden');
        allRecipes.classList.remove('hidden');
        searchInput.value = '';
        clearButton.classList.add('hidden');
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

    function highlightText(text, searchTerm) {
        if (!searchTerm) return text;
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<mark class="bg-amber-200 dark:bg-amber-700 dark:text-white">$1</mark>');
    }

    function createSearchResult(result, searchTerm) {
        const container = document.createElement('div');
        container.innerHTML = resultTemplate;
        const element = container.firstElementChild;
        
        element.setAttribute('href', result.item.permalink);
        element.querySelector('[data-title]').innerHTML = highlightText(result.item.title, searchTerm);
        
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
            const titleBackground = noImgContainer.querySelector('[data-title-background]');
            
            // Clean and prepare the title
            const cleanTitle = result.item.title
                .replace(/[^a-zA-ZäöüßÄÖÜẞ0-9\s]/g, '')
                .replace(/\s+/g, ' ')
                .replace(/ß/g, 'ẞ')
                .toUpperCase();
            
            // Create repeated title
            const repeatedTitle = Array(30).fill(cleanTitle).join(' ');
            
            // Create rows with different offsets
            for (let i = 0; i < 12; i++) {
                const offset = i * 4 - 36;
                const row = document.createElement('div');
                row.className = 'w-full whitespace-nowrap text-2xl font-bold font-mono text-white';
                row.style.transform = `translateX(${offset}rem)`;
                row.textContent = repeatedTitle;
                titleBackground.appendChild(row);
            }
            
            imageContainer.appendChild(noImgContainer.firstElementChild);
        }
        
        if (result.item.description) {
            element.querySelector('[data-description]').innerHTML = highlightText(result.item.description, searchTerm);
        } else if (result.item.content) {
            const preview = result.item.content.substring(0, 200) + '...';
            element.querySelector('[data-description]').innerHTML = highlightText(preview, searchTerm);
        }

        if (result.item.aka && result.item.aka.length > 0) {
            const descriptionElement = element.querySelector('[data-description]');
            const akaText = `<div class="text-neutral-600 dark:text-neutral-400 mt-1 text-sm mb-3">aka: ${result.item.aka.map(a => highlightText(a, searchTerm)).join(', ')}</div>`;
            descriptionElement.insertAdjacentHTML('beforeend', akaText);
        } else {
            element.querySelector('[data-description]').classList.add('mb-3');
        }
        
        if (result.item.tags && result.item.tags.length > 0) {
            const tagsContainer = element.querySelector('.js-tags-container');
            tagsContainer.classList.add('flex', 'flex-wrap', 'gap-2', 'mt-auto');
            const tagsHtml = result.item.tags.map(tag => {
                return `<span class="badge badge-outline my-1 no-underline">${tag}</span>`;
            }).join('');
            tagsContainer.innerHTML = tagsHtml;
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
        } else {
            searchResults.innerHTML = `
                <div class="col-span-full text-center">
                    <p class="text-neutral-500 dark:text-neutral-400 mb-4">Keine Ergebnisse gefunden.</p>
                    <button onclick="window.showAllRecipes()" 
                            class="btn btn-outline btn-neutral">
                        Alle Rezepte anzeigen
                    </button>
                </div>
            `;
        }
    }

    try {
        const response = await fetch('/index.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        // Initialize Fuse
        fuse = new Fuse(data, {
            keys: [
                { name: 'title', weight: 2 },
                { name: 'description', weight: 1.5 },
                { name: 'tags', weight: 1 },
                { name: 'aka', weight: 1.8 }
            ],
            includeScore: true,
            threshold: 0.3,
            distance: 100,
            ignoreLocation: false,
            useExtendedSearch: true,
            minMatchCharLength: 2
        });

        // Check for search term in URL on page load
        const urlParams = new URLSearchParams(window.location.search);
        const initialSearchTerm = urlParams.get('q');
        if (initialSearchTerm) {
            searchInput.value = initialSearchTerm;
            clearButton?.classList.remove('hidden');
            performSearch(initialSearchTerm, false); // Direkt suchen, ohne History-Update
        }
        
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const searchTerm = e.target.value.trim();
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