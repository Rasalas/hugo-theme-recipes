document.addEventListener('DOMContentLoaded', async () => {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const allRecipes = document.getElementById('all-recipes');
    const resultTemplate = document.querySelector('.js-search-result-template').innerHTML;
    const imageTemplate = document.querySelector('.js-image-template').innerHTML;
    const noImageTemplate = document.querySelector('.js-no-image-template').innerHTML;
    
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
            img.setAttribute('alt', result.item.title);
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
        
        if (result.item.tags && result.item.tags.length > 0) {
            const tagsContainer = element.querySelector('.js-tags-container');
            tagsContainer.classList.add('flex', 'flex-wrap', 'gap-2');
            const tagsHtml = result.item.tags.map(tag => {
                return `<span class="badge badge-outline m-1 no-underline">${tag}</span>`;
            }).join('');
            tagsContainer.innerHTML = tagsHtml;
        }
        
        return element.outerHTML;
    }

    function showAllRecipes() {
        searchResults.classList.add('hidden');
        allRecipes.classList.remove('hidden');
        searchInput.value = '';
    }

    function highlightText(text, searchTerm) {
        if (!searchTerm) return text;
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<mark class="bg-amber-200 dark:bg-amber-700 dark:text-white">$1</mark>');
    }

    try {
        const response = await fetch('/index.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        const fuse = new Fuse(data, {
            keys: [
                { name: 'title', weight: 2 },
                { name: 'description', weight: 1.5 },
                { name: 'tags', weight: 1 }
            ],
            includeScore: true,
            threshold: 0.3,
            distance: 100,
            ignoreLocation: false,
            useExtendedSearch: true,
            minMatchCharLength: 2
        });
        
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const searchTerm = e.target.value.trim();
                if (searchTerm.length === 0) {
                    showAllRecipes();
                    return;
                }
                
                if (searchTerm.length < 2) {
                    return;
                }
                
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
            }, 300);
        });

        // Expose showAllRecipes to window for the button click
        window.showAllRecipes = showAllRecipes;
        
    } catch (error) {
        console.error('Error loading search index:', error);
        searchResults.innerHTML = '<p class="text-red-500 dark:text-red-400 text-center">Fehler beim Laden der Suche.</p>';
    }
}); 