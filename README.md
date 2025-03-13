# mdbx

A Node.js binding for [libmdbx](https://github.com/erthink/libmdbx) - a fast, compact, embeddable key-value database.

## Features

- Full binding to the libmdbx C API
- Simple JavaScript-friendly API
- TypeScript support
- Beginner-friendly interface with reasonable defaults
- Promise-based and callback-based interfaces
- Handles Buffer, string, number, and JSON values automatically
- Comprehensive error messages

## Installation

```bash
npm install mdbx
```

### Prerequisites

To build the native module, you'll need:

- Node.js 12.x or later
- npm 6.x or later
- CMake 3.10 or later
- A C/C++ compiler toolchain (GCC, Clang, or MSVC)

#### On Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y cmake build-essential
```

#### On macOS:

```bash
brew install cmake
```

#### On Windows:

- Install Visual Studio with C++ development tools
- Install CMake from https://cmake.org/download/

### Development Installation

If you want to build from source:

```bash
git clone https://github.com/anders94/mdbx.git
cd mdbx
npm install
```

## Simple Usage

```javascript
const mdbx = require('mdbx');

// Open database with default options
const env = mdbx.open('./my-data');

// Create a collection (database)
const users = mdbx.collection(env, 'users');

// Store data
users.put('user:1', { name: 'Alice', email: 'alice@example.com' });
users.put('user:2', { name: 'Bob', email: 'bob@example.com' });

// Retrieve data
const user = users.get('user:1');
console.log(user); // { name: 'Alice', email: 'alice@example.com' }

// Query data
const results = users.find({ 
  gte: 'user:1', 
  lte: 'user:2'
});
console.log(results); 

// Delete data
users.del('user:1');

// Close the environment when done
env.close();
```

## Advanced Usage

```javascript
const mdbx = require('mdbx');
const { EnvFlags, DatabaseFlags, WriteFlags, TransactionMode } = mdbx;

// Open environment with specific options
const env = new mdbx.Environment();
env.open({
  path: './my-data',
  mapSize: 1024 * 1024 * 1024, // 1GB
  maxDbs: 10,
  flags: EnvFlags.NOSYNC | EnvFlags.WRITEMAP
});

// Begin transaction
const txn = env.beginTransaction({
  mode: TransactionMode.READWRITE
});

// Open database
const db = env.openDatabase({
  name: 'users',
  create: true,
  flags: DatabaseFlags.CREATE
});

try {
  // Write data
  txn.put(db, 'user:1', JSON.stringify({ name: 'Alice' }));
  
  // Read data
  const data = txn.get(db, 'user:1');
  console.log(JSON.parse(data.toString()));
  
  // Delete data
  txn.del(db, 'user:1');
  
  // Use a cursor for more advanced operations
  const cursor = txn.openCursor(db);
  
  // Commit the transaction
  txn.commit();
} catch (err) {
  // Abort the transaction on error
  txn.abort();
  throw err;
} finally {
  // Close database when done
  db.close();
  
  // Close environment
  env.close();
}
```

## Examples

See the [examples](./examples) directory for more usage examples.

## API Documentation

### Environment Class

The main entry point for working with an MDBX database.

#### `new Environment(options?)`

Creates a new environment object.

#### `open(options?)`

Opens the environment with the given options.

Options:
- `path`: Path to database directory (default: './mdbx-data')
- `mapSize`: Maximum size of the memory map (default: 10GB)
- `maxDbs`: Maximum number of databases (default: 10)
- `maxReaders`: Maximum number of reader slots (default: 126)
- `flags`: Environment flags

#### `close()`

Closes the environment.

#### `beginTransaction(options?)`

Begins a new transaction.

Options:
- `mode`: `TransactionMode.READONLY` or `TransactionMode.READWRITE`
- `parent`: Parent transaction for nested transactions

#### `openDatabase(options?)`

Opens a database within the environment.

Options:
- `name`: Database name (null for default database)
- `create`: Whether to create the database if it doesn't exist
- `flags`: Database flags

#### `sync(force?)`

Flushes data to disk.

#### `stat()`

Returns statistics about the environment.

#### `info()`

Returns information about the environment.

#### `copy(path)`

Copies the environment to a new location.

#### `setMapSize(size)`

Changes the maximum size of the memory map.

### Transaction Class

A transaction for working with a database.

#### `abort()`

Aborts the transaction.

#### `commit()`

Commits the transaction.

#### `reset()`

Resets a read-only transaction.

#### `renew()`

Renews a read-only transaction.

#### `get(dbi, key)`

Gets a value from the database.

#### `put(dbi, key, value, flags?)`

Stores a key-value pair in the database.

#### `del(dbi, key, value?)`

Deletes a key-value pair from the database.

#### `openCursor(dbi)`

Opens a cursor for the database.

### Database Class

A handle to a specific database within an environment.

#### `close()`

Closes the database.

#### `drop()`

Deletes the database and all its data.

#### `stat(txn)`

Returns statistics about the database.

### Cursor Class

A cursor for traversing a database.

#### `close()`

Closes the cursor.

#### `del(flags?)`

Deletes the current key-value pair.

#### `get(op, key?, value?)`

Retrieves data based on the cursor operation.

#### `put(key, value, flags?)`

Stores a key-value pair using the cursor.

#### `count()`

Returns the number of duplicate values for the current key.

### Simplified Interface

#### `open(path, options?)`

Opens an environment with simplified options.

#### `collection(env, name?, options?)`

Creates a simplified database interface with the following methods:

- `get(key, txnOptions?)`
- `put(key, value, txnOptions?)`
- `del(key, txnOptions?)`
- `find(options)`
- `count(txnOptions?)`
- `drop()`
- `clear()`

## License

MIT