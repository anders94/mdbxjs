'use strict';

const { platform } = require('os');
const path = require('path');
const binding = require('bindings')('mdbxjs');

// Constants
const EnvFlags = binding.EnvFlags;
const DatabaseFlags = binding.DatabaseFlags;
const WriteFlags = binding.WriteFlags;
const TransactionMode = binding.TransactionMode;
const SeekOperation = binding.SeekOperation;

// Helper functions
function ensureBuffer(key) {
  if (Buffer.isBuffer(key)) {
    return key;
  } else if (typeof key === 'string') {
    return Buffer.from(key);
  } else if (typeof key === 'number') {
    // Handle integer keys
    const buf = Buffer.alloc(8);
    buf.writeBigInt64LE(BigInt(key), 0);
    return buf;
  } else if (key === null || key === undefined) {
    throw new Error('Key cannot be null or undefined');
  } else {
    throw new Error(`Unsupported key type: ${typeof key}`);
  }
}

function ensureValueBuffer(value) {
  if (Buffer.isBuffer(value)) {
    return value;
  } else if (typeof value === 'string') {
    return Buffer.from(value);
  } else if (typeof value === 'number') {
    const buf = Buffer.alloc(8);
    buf.writeBigInt64LE(BigInt(value), 0);
    return buf;
  } else if (value === null || value === undefined) {
    throw new Error('Value cannot be null or undefined');
  } else {
    // Assume it's an object and serialize as JSON
    return Buffer.from(JSON.stringify(value));
  }
}

// Try to parse a buffer as JSON, fall back to string if it fails
function parseBuffer(buffer) {
  if (!buffer) return null;
  
  const str = buffer.toString();
  try {
    return JSON.parse(str);
  } catch (e) {
    // Not JSON, return as string
    return str;
  }
}

// Environment class
class Environment {
  constructor(options = {}) {
    this._env = new binding.Environment();
    if (options.path) {
      this.open(options);
    }
  }

  open(options = {}) {
    const defaults = {
      path: './mdbx-data',
      maxDbs: 10,
      mapSize: 10 * 1024 * 1024 * 1024, // 10 GB default
      maxReaders: 126,
      flags: 0
    };

    const opts = { ...defaults, ...options };
    try {
      this._env.open(opts);
    } catch (error) {
      throw new Error(`Failed to open environment: ${error.message}`);
    }
    return this;
  }

  close() {
    try {
      this._env.close();
    } catch (error) {
      throw new Error(`Failed to close environment: ${error.message}`);
    }
  }

  beginTransaction(options = {}) {
    const defaults = {
      mode: TransactionMode.READWRITE,
      parent: null
    };

    const opts = { ...defaults, ...options };
    try {
      return new Transaction(this, opts);
    } catch (error) {
      throw new Error(`Failed to begin transaction: ${error.message}`);
    }
  }

  openDatabase(options = {}) {
    const defaults = {
      name: null,
      create: true,
      flags: options.create !== false ? DatabaseFlags.CREATE : 0
    };

    const opts = { ...defaults, ...options };
    try {
      return new Database(this, opts);
    } catch (error) {
      throw new Error(`Failed to open database: ${error.message}`);
    }
  }

  sync(force = false) {
    try {
      this._env.sync(force);
    } catch (error) {
      throw new Error(`Failed to sync environment: ${error.message}`);
    }
  }

  stat() {
    try {
      return this._env.stat();
    } catch (error) {
      throw new Error(`Failed to get environment stats: ${error.message}`);
    }
  }

  info() {
    try {
      return this._env.info();
    } catch (error) {
      throw new Error(`Failed to get environment info: ${error.message}`);
    }
  }

  copy(path) {
    try {
      this._env.copy(path);
    } catch (error) {
      throw new Error(`Failed to copy environment: ${error.message}`);
    }
  }

  setMapSize(size) {
    try {
      this._env.setMapSize(size);
    } catch (error) {
      throw new Error(`Failed to set map size: ${error.message}`);
    }
  }
}

// Transaction class
class Transaction {
  constructor(env, options = {}) {
    if (!(env instanceof Environment)) {
      throw new Error('First argument must be an Environment instance');
    }
    
    const defaults = {
      mode: TransactionMode.READWRITE,
      parent: null
    };

    const opts = { ...defaults, ...options };
    try {
      this._txn = new binding.Transaction(env._env, opts);
      this._env = env;
    } catch (error) {
      throw new Error(`Failed to create transaction: ${error.message}`);
    }
  }

  abort() {
    try {
      this._txn.abort();
    } catch (error) {
      throw new Error(`Failed to abort transaction: ${error.message}`);
    }
  }

  commit() {
    try {
      this._txn.commit();
    } catch (error) {
      throw new Error(`Failed to commit transaction: ${error.message}`);
    }
  }

  renew() {
    try {
      this._txn.renew();
    } catch (error) {
      throw new Error(`Failed to renew transaction: ${error.message}`);
    }
  }

  reset() {
    try {
      this._txn.reset();
    } catch (error) {
      throw new Error(`Failed to reset transaction: ${error.message}`);
    }
  }

  get(dbi, key) {
    if (!(dbi instanceof Database)) {
      throw new Error('First argument must be a Database instance');
    }
    
    try {
      const keyBuffer = ensureBuffer(key);
      const result = this._txn.get(dbi._dbi, keyBuffer);
      return result;
    } catch (error) {
      throw new Error(`Failed to get value: ${error.message}`);
    }
  }

  put(dbi, key, value, flags = 0) {
    if (!(dbi instanceof Database)) {
      throw new Error('First argument must be a Database instance');
    }
    
    try {
      const keyBuffer = ensureBuffer(key);
      const valueBuffer = ensureValueBuffer(value);
      this._txn.put(dbi._dbi, keyBuffer, valueBuffer, flags);
    } catch (error) {
      throw new Error(`Failed to put value: ${error.message}`);
    }
  }

  del(dbi, key, value = null) {
    if (!(dbi instanceof Database)) {
      throw new Error('First argument must be a Database instance');
    }
    
    try {
      const keyBuffer = ensureBuffer(key);
      const valueBuffer = value !== null ? ensureValueBuffer(value) : null;
      return this._txn.del(dbi._dbi, keyBuffer, valueBuffer);
    } catch (error) {
      throw new Error(`Failed to delete key: ${error.message}`);
    }
  }

  openCursor(dbi) {
    if (!(dbi instanceof Database)) {
      throw new Error('First argument must be a Database instance');
    }
    
    try {
      return new Cursor(this, dbi);
    } catch (error) {
      throw new Error(`Failed to open cursor: ${error.message}`);
    }
  }
}

// Database class
class Database {
  constructor(env, options = {}) {
    if (!(env instanceof Environment)) {
      throw new Error('First argument must be an Environment instance');
    }
    
    const defaults = {
      name: null,
      create: true,
      flags: options.create !== false ? DatabaseFlags.CREATE : 0
    };

    const opts = { ...defaults, ...options };
    try {
      this._dbi = new binding.Database(env._env, opts);
      this._env = env;
    } catch (error) {
      throw new Error(`Failed to create database: ${error.message}`);
    }
  }

  close() {
    try {
      this._dbi.close();
    } catch (error) {
      throw new Error(`Failed to close database: ${error.message}`);
    }
  }

  drop() {
    try {
      this._dbi.drop();
    } catch (error) {
      throw new Error(`Failed to drop database: ${error.message}`);
    }
  }

  stat(txn) {
    if (!(txn instanceof Transaction)) {
      throw new Error('First argument must be a Transaction instance');
    }
    
    try {
      return this._dbi.stat(txn._txn);
    } catch (error) {
      throw new Error(`Failed to get database stats: ${error.message}`);
    }
  }
}

// Cursor class
class Cursor {
  constructor(txn, dbi) {
    if (!(txn instanceof Transaction)) {
      throw new Error('First argument must be a Transaction instance');
    }
    if (!(dbi instanceof Database)) {
      throw new Error('Second argument must be a Database instance');
    }
    
    try {
      this._cursor = new binding.Cursor(txn._txn, dbi._dbi);
      this._txn = txn;
      this._dbi = dbi;
    } catch (error) {
      throw new Error(`Failed to create cursor: ${error.message}`);
    }
  }

  close() {
    try {
      this._cursor.close();
    } catch (error) {
      throw new Error(`Failed to close cursor: ${error.message}`);
    }
  }

  del(flags = 0) {
    try {
      this._cursor.del(flags);
    } catch (error) {
      throw new Error(`Failed to delete current key-value pair: ${error.message}`);
    }
  }

  get(op, key = null, value = null) {
    try {
      const keyBuffer = key !== null ? ensureBuffer(key) : null;
      const valueBuffer = value !== null ? ensureValueBuffer(value) : null;
      return this._cursor.get(op, keyBuffer, valueBuffer);
    } catch (error) {
      throw new Error(`Failed to get cursor position: ${error.message}`);
    }
  }

  put(key, value, flags = 0) {
    try {
      const keyBuffer = ensureBuffer(key);
      const valueBuffer = ensureValueBuffer(value);
      this._cursor.put(keyBuffer, valueBuffer, flags);
    } catch (error) {
      throw new Error(`Failed to put key-value pair: ${error.message}`);
    }
  }

  count() {
    try {
      return this._cursor.count();
    } catch (error) {
      throw new Error(`Failed to count duplicate keys: ${error.message}`);
    }
  }
}

// Simplified interface for beginners
function open(path, options = {}) {
  return new Environment({ path, ...options });
}

function collection(env, name = null, options = {}) {
  if (!(env instanceof Environment)) {
    throw new Error('First argument must be an Environment instance');
  }
  
  const db = env.openDatabase({ name, ...options });

  return {
    get(key, txnOptions = {}) {
      const txn = env.beginTransaction({ mode: TransactionMode.READONLY, ...txnOptions });
      try {
        const buffer = txn.get(db, key);
        const result = buffer ? parseBuffer(buffer) : null;
        txn.abort();
        return result;
      } catch (error) {
        txn.abort();
        throw error;
      }
    },

    put(key, value, txnOptions = {}) {
      const txn = env.beginTransaction(txnOptions);
      try {
        txn.put(db, key, value);
        txn.commit();
      } catch (error) {
        txn.abort();
        throw error;
      }
    },

    del(key, txnOptions = {}) {
      const txn = env.beginTransaction(txnOptions);
      try {
        const result = txn.del(db, key);
        txn.commit();
        return result;
      } catch (error) {
        txn.abort();
        throw error;
      }
    },

    find(options = {}) {
      const { gt, gte, lt, lte, limit = Number.MAX_SAFE_INTEGER, reverse = false } = options;
      const txn = env.beginTransaction({ mode: TransactionMode.READONLY });
      const cursor = txn.openCursor(db);
      const results = [];

      try {
        let found = false;
        
        // Set initial position based on options
        if (reverse) {
          if (lte) {
            const keyBuffer = ensureBuffer(lte);
            found = !!cursor.get(SeekOperation.SET_RANGE, keyBuffer);
            if (!found) {
              found = !!cursor.get(SeekOperation.LAST);
            }
          } else if (lt) {
            const keyBuffer = ensureBuffer(lt);
            found = !!cursor.get(SeekOperation.SET_RANGE, keyBuffer);
            if (found) {
              // Move one step back since lt is exclusive
              found = !!cursor.get(SeekOperation.PREV);
            } else {
              found = !!cursor.get(SeekOperation.LAST);
            }
          } else {
            found = !!cursor.get(SeekOperation.LAST);
          }
        } else {
          if (gte) {
            const keyBuffer = ensureBuffer(gte);
            found = !!cursor.get(SeekOperation.SET_RANGE, keyBuffer);
          } else if (gt) {
            const keyBuffer = ensureBuffer(gt);
            found = !!cursor.get(SeekOperation.SET_RANGE, keyBuffer);
            if (found) {
              const currentKey = cursor.get(SeekOperation.GET_CURRENT).key.toString();
              if (currentKey === keyBuffer.toString()) {
                // Skip this key since gt is exclusive
                found = !!cursor.get(SeekOperation.NEXT);
              }
            }
          } else {
            found = !!cursor.get(SeekOperation.FIRST);
          }
        }

        // Collect results
        let count = 0;
        while (found && count < limit) {
          const kv = cursor.get(SeekOperation.GET_CURRENT);
          if (!kv) break;

          const keyStr = kv.key.toString();

          // Check upper bound
          if (!reverse && lt && keyStr >= ensureBuffer(lt).toString()) break;
          if (!reverse && lte && keyStr > ensureBuffer(lte).toString()) break;

          // Check lower bound
          if (reverse && gt && keyStr <= ensureBuffer(gt).toString()) break;
          if (reverse && gte && keyStr < ensureBuffer(gte).toString()) break;

          results.push({
            key: parseBuffer(kv.key),
            value: parseBuffer(kv.value)
          });
          
          count++;
          found = reverse ? 
            !!cursor.get(SeekOperation.PREV) : 
            !!cursor.get(SeekOperation.NEXT);
        }

        cursor.close();
        txn.abort();
        return results;
      } catch (error) {
        cursor.close();
        txn.abort();
        throw error;
      }
    },

    count(txnOptions = {}) {
      const txn = env.beginTransaction({ mode: TransactionMode.READONLY, ...txnOptions });
      try {
        const cursor = txn.openCursor(db);
        let count = 0;
        let found = !!cursor.get(SeekOperation.FIRST);
        
        while (found) {
          count++;
          found = !!cursor.get(SeekOperation.NEXT);
        }
        
        cursor.close();
        txn.abort();
        return count;
      } catch (error) {
        txn.abort();
        throw error;
      }
    },

    drop() {
      db.drop();
    },

    clear() {
      const txn = env.beginTransaction();
      try {
        const cursor = txn.openCursor(db);
        let found = !!cursor.get(SeekOperation.FIRST);
        
        while (found) {
          cursor.del();
          found = !!cursor.get(SeekOperation.NEXT);
        }
        
        cursor.close();
        txn.commit();
      } catch (error) {
        txn.abort();
        throw error;
      }
    }
  };
}

// Export
module.exports = {
  Environment,
  Transaction,
  Database,
  Cursor,
  EnvFlags,
  DatabaseFlags,
  WriteFlags,
  TransactionMode,
  SeekOperation,
  open,
  collection
};