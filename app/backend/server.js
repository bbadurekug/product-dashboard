const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const pg = new Pool({ connectionString: process.env.DB_URL });
const redis = new Redis(process.env.REDIS_URL);

let cacheHits = 0;

function validateProduct(name, price) {
    const nameValidation = validateProductName(name);
    if (!nameValidation.isValid) {
        return { isValid: false, error: nameValidation.error };
    }

    const priceValidation = validateProductPrice(price);
    if (!priceValidation.isValid) {
        return { isValid: false, error: priceValidation.error };
    }

    return { isValid: true, cleanName: name.trim() }
}

function validateProductName(name) {
    if (name === undefined || name === null) {
        return { isValid: false, error: "Nie podano nazwy!" };
    }

    if (typeof name !== 'string') {
        return { isValid: false, error: "Nazwa musi być ciągiem znaków!" };
    }

    const cleanName = name.trim();

    if (cleanName === "") {
        return { isValid: false, error: "Nazwa nie może być pusta!" };
    }

    return { isValid: true }
}

function validateProductPrice(price) {
    if (price === undefined || price === null) {
        return { isValid: false, error: "Nie podano ceny!" };
    }

    if (typeof price !== 'number') {
        return { isValid: false, error: "Cena musi być liczbą!" };
    }

    if (price <= 0) {
        return { isValid: false, error: "Cena musi być większa od zera!" };
    }

    return { isValid: true }
}

function calculateStats(rawCount, hits) {
    if (rawCount === undefined || rawCount === null || hits === undefined || hits === null) {
        throw new Error("Brak wymaganych danych do wyliczenia statystyk!");
    }

    const countAsNumber = parseInt(rawCount, 10);
    
    if (Number.isNaN(countAsNumber) || Number.isNaN(hits)) {
        throw new Error("Dane statystyk nie są poprawnymi liczbami!");
    }

    if (countAsNumber < 0 || hits < 0) {
        throw new Error("Statystyki nie mogą mieć wartości ujemnych!");
    }

    return {
        product_count: countAsNumber,
        cache_hits: hits
    };
}

async function handleGetItems(req, res) {
    try {
        const cachedData = await redis.get('products');

        if (cachedData) {
            cacheHits++;
            return res.json(JSON.parse(cachedData));
        }

        const query = await pg.query('SELECT * FROM products');
        const products = query.rows;

        await redis.set('products', JSON.stringify(products), 'EX', 30); //cache na 30 sekund

        res.json(products);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Błąd podczas wczytywania danych" });
    }
}

async function handlePostItems(req, res) {
    let { name, price } = req.body;

    const validation = validateProduct(name, price);

    if (!validation.isValid) {
        return res.status(400).json({ error: validation.error });
    }

    name = validation.cleanName;

    try {
        await pg.query('INSERT INTO products (name, price) VALUES ($1, $2)', [name, price]);

        await redis.del('products');

        res.status(201).json({ message: "Produkt dodany pomyślnie"})
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Błąd podczas zapisywania danych" });
    }
}

async function handleGetStats(req, res) {
    try {
        const query = await pg.query('SELECT COUNT(*) FROM products');
        
        const count = query.rows[0].count;

        const stats = calculateStats(count, cacheHits);

        res.json(stats);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Błąd podczas pobierania statystyk" });
    }
}

app.get('/api/items', handleGetItems);

app.post('/api/items', handlePostItems);

app.get('/api/stats', handleGetStats);

app.get('/api/health', (req, res) => {
    res.json({ status: "ok" });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Serwer nasłuchuje na porcie: ${PORT}`);
    });
}

module.exports = {
    validateProduct,
    validateProductName,
    validateProductPrice,
    calculateStats,
    handleGetItems,
    handlePostItems,
    handleGetStats,
    pg,
    redis
};