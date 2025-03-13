'use strict';

const mdbx = require('../lib');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Create a unique temp directory for tests
const TEST_DIR = path.join(os.tmpdir(), 'mdbxjs-test-' + Date.now());

// Setup and teardown
beforeAll(() => {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
});

afterAll(() => {
  // Clean up test directory
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe('Basic MDBXJS operations', () => {
  let env;
  
  beforeEach(() => {
    // Create new environment for each test
    env = mdbx.open(path.join(TEST_DIR, 'basic-test-' + Date.now()));
  });
  
  afterEach(() => {
    // Close environment after each test
    env.close();
  });

  test('Environment can be created and closed', () => {
    expect(env).toBeDefined();
    env.close();
  });

  test('Simple collection API for put/get/del', () => {
    const collection = mdbx.collection(env, 'test');
    
    // Put data
    collection.put('key1', 'value1');
    collection.put('key2', { name: 'Test Object' });
    
    // Get data
    expect(collection.get('key1')).toBe('value1');
    expect(collection.get('key2')).toEqual({ name: 'Test Object' });
    
    // Delete data
    expect(collection.del('key1')).toBe(true);
    expect(collection.get('key1')).toBeNull();
    
    // Try deleting non-existent key
    expect(collection.del('nonexistent')).toBe(false);
    
    // Count
    expect(collection.count()).toBe(1);
  });

  test('Collection find method with range queries', () => {
    const collection = mdbx.collection(env, 'range-test');
    
    // Insert test data
    for (let i = 1; i <= 10; i++) {
      collection.put(`key${i.toString().padStart(2, '0')}`, `value${i}`);
    }
    
    // Test range query with gte/lte
    const result1 = collection.find({ gte: 'key03', lte: 'key07' });
    expect(result1.length).toBe(5);
    expect(result1[0].key).toBe('key03');
    expect(result1[4].key).toBe('key07');
    
    // Test query with gt/lt (exclusive bounds)
    const result2 = collection.find({ gt: 'key03', lt: 'key07' });
    expect(result2.length).toBe(3);
    expect(result2[0].key).toBe('key04');
    expect(result2[2].key).toBe('key06');
    
    // Test with limit
    const result3 = collection.find({ gte: 'key01', limit: 3 });
    expect(result3.length).toBe(3);
    
    // Test with reverse order
    const result4 = collection.find({ lte: 'key10', gte: 'key01', reverse: true });
    expect(result4.length).toBe(10);
    expect(result4[0].key).toBe('key10');
    expect(result4[9].key).toBe('key01');
  });

  test('Numbers can be used as keys and values', () => {
    const collection = mdbx.collection(env, 'number-test');
    
    // Use numbers as keys
    collection.put(1, 'one');
    collection.put(2, 'two');
    collection.put(3, 'three');
    
    expect(collection.get(1)).toBe('one');
    expect(collection.get(2)).toBe('two');
    
    // Use numbers as values
    collection.put('count1', 100);
    collection.put('count2', 200);
    
    expect(collection.get('count1')).toBe(100);
    expect(collection.get('count2')).toBe(200);
    
    // Find by number keys
    const result = collection.find({ gte: 1, lte: 2 });
    expect(result.length).toBe(2);
    expect(result[0].value).toBe('one');
    expect(result[1].value).toBe('two');
  });

  test('Collection clear method', () => {
    const collection = mdbx.collection(env, 'clear-test');
    
    // Insert test data
    for (let i = 1; i <= 5; i++) {
      collection.put(`key${i}`, `value${i}`);
    }
    
    expect(collection.count()).toBe(5);
    
    // Clear the collection
    collection.clear();
    
    expect(collection.count()).toBe(0);
    expect(collection.get('key1')).toBeNull();
  });
});

describe('Advanced MDBXJS operations', () => {
  let env;
  
  beforeEach(() => {
    // Create a new environment with custom options
    env = new mdbx.Environment();
    env.open({
      path: path.join(TEST_DIR, 'advanced-test-' + Date.now()),
      mapSize: 10 * 1024 * 1024, // 10MB
      maxDbs: 5
    });
  });
  
  afterEach(() => {
    env.close();
  });

  test('Manual transactions and database operations', () => {
    // Start transaction
    const txn = env.beginTransaction();
    
    // Open a database
    const db = env.openDatabase({ name: 'test-db', create: true });
    
    // Put and get data directly with transaction
    txn.put(db, 'key1', 'value1');
    const value = txn.get(db, 'key1');
    
    expect(value.toString()).toBe('value1');
    
    // Commit and verify in a new transaction
    txn.commit();
    
    const txn2 = env.beginTransaction();
    const value2 = txn2.get(db, 'key1');
    expect(value2.toString()).toBe('value1');
    txn2.abort();
  });

  test('Cursor operations', () => {
    // Start transaction and open database
    const txn = env.beginTransaction();
    const db = env.openDatabase({ name: 'cursor-test', create: true });
    
    // Insert some data
    const items = [
      { key: 'a', value: 'apple' },
      { key: 'b', value: 'banana' },
      { key: 'c', value: 'cherry' },
      { key: 'd', value: 'date' },
      { key: 'e', value: 'elderberry' }
    ];
    
    items.forEach(item => {
      txn.put(db, item.key, item.value);
    });
    
    // Open a cursor
    const cursor = txn.openCursor(db);
    
    // Check first and last items
    let entry = cursor.get(mdbx.SeekOperation.FIRST);
    expect(entry.key.toString()).toBe('a');
    expect(entry.value.toString()).toBe('apple');
    
    entry = cursor.get(mdbx.SeekOperation.LAST);
    expect(entry.key.toString()).toBe('e');
    expect(entry.value.toString()).toBe('elderberry');
    
    // Position at specific key
    entry = cursor.get(mdbx.SeekOperation.SET, 'c');
    expect(entry.key.toString()).toBe('c');
    expect(entry.value.toString()).toBe('cherry');
    
    // Move forward and backward
    entry = cursor.get(mdbx.SeekOperation.NEXT);
    expect(entry.key.toString()).toBe('d');
    
    entry = cursor.get(mdbx.SeekOperation.PREV);
    expect(entry.key.toString()).toBe('c');
    
    // Use SET_RANGE to find the nearest key
    entry = cursor.get(mdbx.SeekOperation.SET_RANGE, 'cc');
    expect(entry.key.toString()).toBe('d'); // The next key after 'cc'
    
    // Close cursor and commit transaction
    cursor.close();
    txn.commit();
  });

  test('Environment information and statistics', () => {
    // Get environment info
    const info = env.info();
    expect(info.mapSize).toBe(10 * 1024 * 1024); // 10MB as configured
    expect(info.maxReaders).toBe(126); // Default
    
    // Get environment stats
    const stats = env.stat();
    expect(stats).toBeDefined();
    expect(typeof stats.psize).toBe('number');
    expect(typeof stats.depth).toBe('number');
  });

  test('Database statistics', () => {
    // Start transaction
    const txn = env.beginTransaction();
    const db = env.openDatabase({ name: 'stat-test', create: true });
    
    // Insert some data
    for (let i = 0; i < 100; i++) {
      txn.put(db, `key${i}`, `value${i}`);
    }
    
    // Get database stats
    const stats = db.stat(txn);
    expect(stats.entries).toBe(100);
    
    txn.commit();
  });

  test('Duplicate values with DUPSORT', () => {
    // Start transaction
    const txn = env.beginTransaction();
    
    // Open a database with DUPSORT
    const db = env.openDatabase({ 
      name: 'dupsort-test', 
      create: true,
      flags: mdbx.DatabaseFlags.CREATE | mdbx.DatabaseFlags.DUPSORT
    });
    
    // Insert data with duplicate keys
    txn.put(db, 'fruits', 'apple');
    txn.put(db, 'fruits', 'banana');
    txn.put(db, 'fruits', 'cherry');
    txn.put(db, 'vegetables', 'carrot');
    txn.put(db, 'vegetables', 'potato');
    
    // Open cursor
    const cursor = txn.openCursor(db);
    
    // Position at 'fruits'
    let entry = cursor.get(mdbx.SeekOperation.SET, 'fruits');
    expect(entry.key.toString()).toBe('fruits');
    expect(entry.value.toString()).toBe('apple');
    
    // Count fruits
    const fruitCount = cursor.count();
    expect(fruitCount).toBe(3);
    
    // Iterate through fruits
    const fruits = [];
    do {
      fruits.push(entry.value.toString());
      entry = cursor.get(mdbx.SeekOperation.NEXT_DUP);
    } while (entry);
    
    expect(fruits).toEqual(['apple', 'banana', 'cherry']);
    
    // Position at 'vegetables'
    entry = cursor.get(mdbx.SeekOperation.SET, 'vegetables');
    
    // Count vegetables
    const vegCount = cursor.count();
    expect(vegCount).toBe(2);
    
    cursor.close();
    txn.commit();
  });
});