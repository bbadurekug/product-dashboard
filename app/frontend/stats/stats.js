async function pobierzDane() {
    try {
        const response = await fetch('/api/stats/');
        
        if (!response.ok) {
            throw new Error(`Błąd serwera: ${response.status}`);
        }

        const data = await response.json();

        return data;
    } catch (error) {
        console.error("Wystąpił błąd podczas pobierania:", error);
    }
}

async function odswierzDane() {
    const data = await pobierzDane();

    const productCountP = document.getElementById('product-count');
    const cacheHitsP = document.getElementById('cache-hits');

    productCountP.innerHTML = data.product_count;
    cacheHitsP.innerHTML = data.cache_hits;
}

odswierzDane();