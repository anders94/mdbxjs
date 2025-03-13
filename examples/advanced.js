'use strict';

const mdbx = require('../lib');
const { EnvFlags, DatabaseFlags, WriteFlags, TransactionMode, SeekOperation } = mdbx;

// This example demonstrates more advanced usage of the mdbx package

// Open an environment with specific options
console.log('Opening environment with custom options...');
const env = new mdbx.Environment();
env.open({
  path: './mdbx-advanced',
  mapSize: 1024 * 1024 * 1024, // 1GB
  maxDbs: 10,
  flags: EnvFlags.NOSYNC | EnvFlags.WRITEMAP
});

try {
  // Begin a write transaction
  console.log('Starting write transaction...');
  const writeTxn = env.beginTransaction({
    mode: TransactionMode.READWRITE
  });

  try {
    // Open a database for products
    console.log('Opening products database...');
    const productsDb = env.openDatabase({
      name: 'products',
      create: true
    });

    // Insert some products
    console.log('Inserting products...');
    writeTxn.put(productsDb, 'product:1', JSON.stringify({ 
      name: 'Laptop', 
      price: 999.99,
      description: 'Powerful laptop with 16GB RAM',
      category: 'electronics'
    }));
    
    writeTxn.put(productsDb, 'product:2', JSON.stringify({ 
      name: 'Phone',
      price: 699.99,
      description: 'Latest smartphone model',
      category: 'electronics'
    }));
    
    writeTxn.put(productsDb, 'product:3', JSON.stringify({ 
      name: 'Headphones',
      price: 129.99,
      description: 'Noise-cancelling headphones',
      category: 'electronics'
    }));
    
    writeTxn.put(productsDb, 'product:4', JSON.stringify({ 
      name: 'Desk',
      price: 249.99,
      description: 'Adjustable standing desk',
      category: 'furniture'
    }));

    // Also create a category index database using dupsort
    console.log('Creating category index database...');
    const categoryDb = env.openDatabase({
      name: 'categories',
      create: true,
      flags: DatabaseFlags.CREATE | DatabaseFlags.DUPSORT
    });

    // Insert category indexes
    writeTxn.put(categoryDb, 'electronics', 'product:1');
    writeTxn.put(categoryDb, 'electronics', 'product:2');
    writeTxn.put(categoryDb, 'electronics', 'product:3');
    writeTxn.put(categoryDb, 'furniture', 'product:4');

    // Commit the transaction
    console.log('Committing transaction...');
    writeTxn.commit();
  } catch (err) {
    writeTxn.abort();
    throw err;
  }

  // Begin a read transaction
  console.log('Starting read transaction...');
  const readTxn = env.beginTransaction({
    mode: TransactionMode.READONLY
  });

  try {
    // Open the databases
    const productsDb = env.openDatabase({ name: 'products' });
    const categoryDb = env.openDatabase({ name: 'categories' });

    // Read a product directly
    console.log('Reading product:2...');
    const productBuf = readTxn.get(productsDb, 'product:2');
    if (productBuf) {
      const product = JSON.parse(productBuf.toString());
      console.log('Product 2:', product);
    }

    // Use a cursor to iterate through all products
    console.log('Listing all products:');
    const productCursor = readTxn.openCursor(productsDb);
    let productEntry = productCursor.get(SeekOperation.FIRST);
    
    while (productEntry) {
      const key = productEntry.key.toString();
      const value = JSON.parse(productEntry.value.toString());
      console.log(`- ${key}: ${value.name}, $${value.price}`);
      
      // Move to next entry
      productEntry = productCursor.get(SeekOperation.NEXT);
    }
    
    productCursor.close();

    // Use a cursor to find products by category
    console.log('Finding products in category "electronics":');
    const categoryCursor = readTxn.openCursor(categoryDb);
    
    // Position at the first entry for "electronics" category
    let found = categoryCursor.get(SeekOperation.SET, 'electronics');
    
    if (found) {
      // Loop through all products in this category
      do {
        const productId = found.value.toString();
        const productBuf = readTxn.get(productsDb, productId);
        
        if (productBuf) {
          const product = JSON.parse(productBuf.toString());
          console.log(`- ${productId}: ${product.name}`);
        }
        
        // Move to next entry with same key (electronics)
        found = categoryCursor.get(SeekOperation.NEXT_DUP);
      } while (found);
    }
    
    categoryCursor.close();

    // Count items
    console.log('Database statistics:');
    const productStats = productsDb.stat(readTxn);
    console.log(`- Total products: ${productStats.entries}`);
    
    // Count duplicate values for 'electronics' category
    const categoryCountCursor = readTxn.openCursor(categoryDb);
    if (categoryCountCursor.get(SeekOperation.SET, 'electronics')) {
      const count = categoryCountCursor.count();
      console.log(`- Products in electronics category: ${count}`);
    }
    categoryCountCursor.close();

    // End the transaction
    readTxn.abort(); // For read-only transactions, abort is recommended
  } catch (err) {
    readTxn.abort();
    throw err;
  }

  // Get environment info
  console.log('Environment information:');
  const info = env.info();
  console.log(`- Map size: ${info.mapSize} bytes`);
  console.log(`- Last transaction ID: ${info.lastTransactionId}`);
  console.log(`- Max readers: ${info.maxReaders}`);

  // Close the environment when done
  console.log('Closing environment...');
  env.close();
  
  console.log('Example completed successfully!');
} catch (err) {
  console.error('Error:', err);
  env.close();
}