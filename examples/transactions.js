'use strict';

const mdbx = require('../lib');
const { TransactionMode } = mdbx;

// This example demonstrates transaction handling and error recovery

// Open environment
const env = new mdbx.Environment();
env.open('./mdbx-transactions');

// Open database
const db = env.openDatabase({ name: 'accounts', create: true });

// Initialize some accounts
function initializeAccounts() {
  const txn = env.beginTransaction();
  try {
    txn.put(db, 'account:1', JSON.stringify({ owner: 'Alice', balance: 1000 }));
    txn.put(db, 'account:2', JSON.stringify({ owner: 'Bob', balance: 500 }));
    txn.commit();
    console.log('Accounts initialized');
  } catch (err) {
    txn.abort();
    console.error('Failed to initialize accounts:', err);
  }
}

// Transfer money between accounts
function transferMoney(fromAccount, toAccount, amount) {
  console.log(`Transferring $${amount} from ${fromAccount} to ${toAccount}...`);
  
  const txn = env.beginTransaction();
  try {
    // Get source account
    const sourceBuffer = txn.get(db, fromAccount);
    if (!sourceBuffer) {
      throw new Error(`Source account ${fromAccount} not found`);
    }
    const source = JSON.parse(sourceBuffer.toString());
    
    // Check balance
    if (source.balance < amount) {
      throw new Error(`Insufficient funds in ${fromAccount}, balance: $${source.balance}, transfer amount: $${amount}`);
    }
    
    // Get destination account
    const destBuffer = txn.get(db, toAccount);
    if (!destBuffer) {
      throw new Error(`Destination account ${toAccount} not found`);
    }
    const dest = JSON.parse(destBuffer.toString());
    
    // Update balances
    source.balance -= amount;
    dest.balance += amount;
    
    // Write back to database
    txn.put(db, fromAccount, JSON.stringify(source));
    txn.put(db, toAccount, JSON.stringify(dest));
    
    // Commit transaction
    txn.commit();
    console.log('Transfer completed successfully');
    return true;
  } catch (err) {
    // Abort transaction on error
    txn.abort();
    console.error('Transfer failed:', err.message);
    return false;
  }
}

// Read account balances
function checkBalances() {
  console.log('\nCurrent account balances:');
  
  const txn = env.beginTransaction({ mode: TransactionMode.READONLY });
  try {
    const accounts = ['account:1', 'account:2'];
    
    for (const accountId of accounts) {
      const buffer = txn.get(db, accountId);
      if (buffer) {
        const account = JSON.parse(buffer.toString());
        console.log(`- ${accountId} (${account.owner}): $${account.balance}`);
      } else {
        console.log(`- ${accountId}: Not found`);
      }
    }
    
    txn.abort(); // For read-only transactions, abort is fine
  } catch (err) {
    txn.abort();
    console.error('Failed to read balances:', err);
  }
}

// Run example
initializeAccounts();
checkBalances();

// Successful transfer
transferMoney('account:1', 'account:2', 200);
checkBalances();

// Failed transfer due to insufficient funds
transferMoney('account:2', 'account:1', 1000);
checkBalances();

// Failed transfer due to non-existent account
transferMoney('account:1', 'account:3', 100);
checkBalances();

// Clean up
env.close();
console.log('\nExample completed successfully!');