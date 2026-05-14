const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const pg = new Pool({ connectionString: process.env.DB_URL });
const redis = new Redis(process.env.REDIS_URL);

let cacheHits = 0;

app.get('/api/items', async (req, res) => {
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
});

app.post('/api/items', async (req, res) => {
    const { name, price } = req.body;

    if (!name || !price) {
        return res.status(400).json({ error: "Nie podano nazwy i/lub ceny!" });
    }

    try {
        await pg.query('INSERT INTO products (name, price) VALUES ($1, $2)', [name, price]);

        await redis.del('products');

        res.status(201).json({ message: "Produkt dodany pomyślnie"})
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Błąd podczas zapisywania danych" });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const query = await pg.query('SELECT COUNT(*) FROM products');
        const count = parseInt(query.rows[0].count);

        res.json({
            product_count: count,
            cache_hits: cacheHits
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Błąd podczas pobierania statystyk" });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: "ok" });
});

app.listen(PORT, () => {
    console.log(`Serwer nasłuchuje na porcie: ${PORT}`);
});