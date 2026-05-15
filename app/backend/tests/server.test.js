const test = require('node:test');
const assert = require('node:assert');

const {
    validateProduct,
    validateProductName,
    validateProductPrice,
    calculateStats,
    handleGetItems,
    handlePostItems,
    handleGetStats,
    pg,
    redis
} = require('../server.js');

if (pg && typeof pg.end === 'function') pg.end().catch(() => {});
if (redis && typeof redis.disconnect === 'function') redis.disconnect();

function createMockResponse(t) {
    const res = {
        status: () => res,
        json: () => res
    };
    t.mock.method(res, 'status');
    t.mock.method(res, 'json');
    return res;
}

//Walidacja
test('Walidacja nazwy nowego produktu', () => {
    assert.strictEqual(validateProductName('   ').isValid, false);
    assert.strictEqual(validateProductName(null).isValid, false);
    assert.strictEqual(validateProductName(undefined).isValid, false);
    assert.strictEqual(validateProductName(123).isValid, false);
    assert.strictEqual(validateProductName('Test').isValid, true);
    assert.strictEqual(validateProductName('  Test      ').isValid, true);
});

test('Walidacja ceny nowego produktu', () => {
    assert.strictEqual(validateProductPrice(null).isValid, false);
    assert.strictEqual(validateProductPrice(undefined).isValid, false);
    assert.strictEqual(validateProductPrice('Trzy').isValid, false);
    assert.strictEqual(validateProductPrice(-5.0).isValid, false);
    assert.strictEqual(validateProductPrice(0).isValid, false);
    assert.strictEqual(validateProductPrice(50.0).isValid, true);
});

test('Walidacja wartości nowego produktu', () => {
    const successResult = validateProduct('Test', 1);
    assert.strictEqual(successResult.isValid, true);
    assert.strictEqual(successResult.cleanName, 'Test');

    const trimResult = validateProduct('   Test   ', 1);
    assert.strictEqual(trimResult.isValid, true);
    assert.strictEqual(trimResult.cleanName, 'Test');

    const failNameResult = validateProduct('', 1);
    assert.strictEqual(failNameResult.isValid, false);

    const failPriceResult = validateProduct('Test', -3);
    assert.strictEqual(failPriceResult.isValid, false);
});

//Obliczenia
test('Przetwarzanie surowych danych na statystyki', () => {
    const successStringResult = calculateStats('10', 5);
    assert.strictEqual(successStringResult.product_count, 10);
    assert.strictEqual(successStringResult.cache_hits, 5);

    const successNumberResult = calculateStats(10, 5);
    assert.strictEqual(successNumberResult.product_count, 10);
    assert.strictEqual(successNumberResult.cache_hits, 5);

    assert.throws(() => {
        calculateStats('5', -1);
    });

    assert.throws(() => {
        calculateStats('', 13);
    });

    assert.throws(() => {
        calculateStats('Dwa', 5);
    });
});

//API
test('GET /api/items - 200 - cache hit', async (t) => {
    const cachedItems = [{ name: 'Test', price: 10 }];
    
    t.mock.method(redis, 'get', async () => JSON.stringify(cachedItems));

    const req = {};
    const res = createMockResponse(t);

    await handleGetItems(req, res);

    const jsonArgs = res.json.mock.calls[0].arguments[0];

    assert.strictEqual(jsonArgs.length, 1);
    assert.strictEqual(jsonArgs[0].name, 'Test');
    assert.strictEqual(jsonArgs[0].price, 10);
});

test('GET /api/items - 200 - bez cache hit', async (t) => {
    const databaseItems = [{ name: 'Test', price: 10 }];

    t.mock.method(redis, 'get', async () => null);
    t.mock.method(redis, 'set', async () => 'OK');
    t.mock.method(pg, 'query', async () => ({ rows: databaseItems }));

    const req = {};
    const res = createMockResponse(t);

    await handleGetItems(req, res);

    const jsonArgs = res.json.mock.calls[0].arguments[0];

    assert.strictEqual(jsonArgs.length, 1);
    assert.strictEqual(jsonArgs[0].name, 'Test');
    assert.strictEqual(jsonArgs[0].price, 10);

    const redisCacheArgs = redis.set.mock.calls[0].arguments;

    assert.strictEqual(redisCacheArgs[0], 'products');
    assert.strictEqual(redisCacheArgs[2], 'EX');
    assert.strictEqual(redisCacheArgs[3], 30);
});

test('GET /api/items - 500', async (t) => {
    t.mock.method(redis, 'get', async () => null);
    t.mock.method(pg, 'query', async () => { throw new Error('Połączenie z bazą danych pg przerwane!') });

    const req = {};
    const res = createMockResponse(t);

    await handleGetItems(req, res);

    const statusArgs = res.status.mock.calls[0].arguments;

    assert.strictEqual(statusArgs[0], 500);
});

test('POST /api/items - 201', async (t) => {
    t.mock.method(pg, 'query', async () => ({ rows: [] }));
    t.mock.method(redis, 'del', async () => 1);

    const req = { body: { name: 'Test', price: 10 } };
    const res = createMockResponse(t);

    await handlePostItems(req, res);

    const statusArgs = res.status.mock.calls[0].arguments[0];
    assert.strictEqual(statusArgs, 201);
});

test('POST /api/items - 400', async (t) => {
    const req = { body: { name: 'Test', price: -10 } };
    const res = createMockResponse(t);

    await handlePostItems(req, res);

    const statusArgs = res.status.mock.calls[0].arguments[0];
    assert.strictEqual(statusArgs, 400);
});

test('POST /api/items - 500', async (t) => {
    t.mock.method(pg, 'query', async () => { throw new Error('Połączenie z bazą danych pg przerwane!') });
    t.mock.method(redis, 'del', async () => null);

    const req = { body: { name: 'Test', price: 10 } };
    const res = createMockResponse(t);

    await handlePostItems(req, res);

    const statusArgs = res.status.mock.calls[0].arguments[0];
    assert.strictEqual(statusArgs, 500);
});

test('GET /api/stats - 200', async (t) => {
    t.mock.method(pg, 'query', async () => ({ rows: [{ count: '10' }] }));

    const req = {};
    const res = createMockResponse(t);

    await handleGetStats(req, res);

    const jsonArgs = res.json.mock.calls[0].arguments[0];
    
    assert.strictEqual(jsonArgs.product_count, 10);
});

test('GET /api/stats - 500 - błąd bazy', async (t) => {
    t.mock.method(pg, 'query', async () => { throw new Error('Połączenie z bazą danych pg przerwane!') });

    const req = {};
    const res = createMockResponse(t);

    await handleGetStats(req, res);

    const statusArgs = res.status.mock.calls[0].arguments[0];
    assert.strictEqual(statusArgs, 500);
});