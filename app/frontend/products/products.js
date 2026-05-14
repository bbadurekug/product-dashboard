const form = document.getElementById('product-form');
const productNameInput = document.getElementById('product-form-name');
const productPriceInput = document.getElementById('product-form-price');

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const productName = productNameInput.value.trim();
    const productPrice = parseFloat(productPriceInput.value);

    const newProduct = { name: productName, price: productPrice };

    const success = await dodajProdukt(newProduct);

    if (success) {
        productNameInput.value = '';
        productPriceInput.value = '';
        await odswierzListe();
    }
});

async function pobierzDane() {
    try {
        const response = await fetch('/api/items');
        
        if (!response.ok) {
            throw new Error(`Błąd serwera: ${response.status}`);
        }

        const data = await response.json();

        return data;
    } catch (error) {
        console.error("Wystąpił błąd podczas pobierania:", error);
    }
}

async function odswierzListe() {
    const lista = document.getElementById('product-list');

    const data = await pobierzDane();

    lista.innerHTML = '';

    if (!data) return;

    data.forEach(product => {
        const li = document.createElement('li');
            
        li.textContent = `${product.name} (${product.price} zł)`;

        lista.appendChild(li);
    });
}

async function dodajProdukt(newProduct) {
    try {
        const response = await fetch('/api/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newProduct.name, price: newProduct.price })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error(`Błąd: ${errorData.message || response.status}`);
            return false;
        }

        return true;
    } catch (error) {
        console.error("Wystąpił błąd podczas dodawania produktu:", error);
        return false;
    }
}

odswierzListe();