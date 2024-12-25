document.addEventListener('DOMContentLoaded', async () => {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    
    function highlightText(text, searchTerm) {
        if (!searchTerm) return text;
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<mark class="bg-amber-200 dark:bg-amber-700 dark:text-white">$1</mark>');
    }

    function getContextSnippet(content, searchTerm, maxLength = 200) {
        if (!content || !searchTerm) return '';
        
        const lowerContent = content.toLowerCase();
        const lowerSearchTerm = searchTerm.toLowerCase();
        const index = lowerContent.indexOf(lowerSearchTerm);
        
        if (index === -1) return content.slice(0, maxLength) + '...';
        
        const start = Math.max(0, index - 100);
        const end = Math.min(content.length, index + 100);
        let snippet = content.slice(start, end);
        
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';
        
        return highlightText(snippet, searchTerm);
    }
    
    try {
        const response = await fetch('/index.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        const fuse = new Fuse(data, {
            keys: [
                { name: 'title', weight: 2 },
                { name: 'content', weight: 1 },
                { name: 'tags', weight: 2 }
            ],
            includeScore: true,
            threshold: 0.3,
            distance: 100,
            ignoreLocation: false,
            useExtendedSearch: true,
            minMatchCharLength: 3,
            findAllMatches: false
        });
        
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const searchTerm = e.target.value;
                if (searchTerm.length < 2) {
                    searchResults.innerHTML = '';
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
                }, []).slice(0, 5);

                const gridClasses = uniqueResults.length === 1 ? 'grid-cols-1 max-w-md mx-auto' :
                                  uniqueResults.length === 2 ? 'sm:grid-cols-2 max-w-2xl mx-auto' :
                                  'sm:grid-cols-2 lg:grid-cols-3';
                searchResults.className = `grid grid-cols-1 gap-6 text-left ${gridClasses}`;
                
                searchResults.innerHTML = uniqueResults.length ? 
                    uniqueResults.map(result => `
                        <a href="${result.item.permalink}" class="group block overflow-hidden rounded-lg bg-white dark:bg-neutral shadow-sm hover:shadow-md transition-shadow">
                            ${result.item.images && result.item.images.thumb ? 
                                `<div class="aspect-video w-full overflow-hidden">
                                    <img src="${result.item.images.thumb}" 
                                         alt="${result.item.title}" 
                                         class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                                </div>` : 
                                `<div class="aspect-video w-full bg-gray-200 dark:bg-neutral-800 flex items-center justify-center">
                                    <svg class="w-12 h-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>`
                            }
                            <div class="p-4">
                                <h3 class="text-lg font-semibold mb-2 text-neutral-700 hover:text-neutral-900 dark:text-white">
                                    ${highlightText(result.item.title, searchTerm)}
                                </h3>
                                <p class="text-neutral-600 dark:text-neutral-300 mb-2 text-sm">
                                    ${getContextSnippet(result.item.content, searchTerm)}
                                </p>
                                ${result.item.tags ? 
                                    `<div class="flex flex-wrap gap-2">
                                        ${result.item.tags.slice(0, 3).map(tag => 
                                            `<span class="px-2 py-1 bg-gray-200 dark:bg-neutral-700 text-sm rounded-full dark:text-white">${tag}</span>`
                                        ).join('')}
                                    </div>` : ''
                                }
                            </div>
                        </a>
                    `).join('') :
                    '<p class="text-neutral-500 dark:text-neutral-400 text-center col-span-full">Keine Ergebnisse gefunden.</p>';
            }, 300);
        });
        
    } catch (error) {
        console.error('Error loading search index:', error);
        searchResults.innerHTML = '<p class="text-red-500 dark:text-red-400 text-center">Fehler beim Laden der Suche.</p>';
    }
}); 