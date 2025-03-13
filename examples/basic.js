'use strict';

const mdbx = require('../lib');

// This example demonstrates basic usage of the mdbx package

// Open an environment with default options
console.log('Opening environment...');
const env = mdbx.open('./mdbx-data');

// Create a collection with the simplified API
console.log('Creating users collection...');
const users = mdbx.collection(env, 'users');

// Clear any existing data
console.log('Clearing any existing data...');
users.clear();

// Insert some data
console.log('Inserting users...');
users.put('user:1', { name: 'Alice', email: 'alice@example.com', age: 30 });
users.put('user:2', { name: 'Bob', email: 'bob@example.com', age: 25 });
users.put('user:3', { name: 'Charlie', email: 'charlie@example.com', age: 35 });
users.put('user:4', { name: 'David', email: 'david@example.com', age: 40 });
users.put('user:5', { name: 'Eve', email: 'eve@example.com', age: 22 });

// Read a single item
console.log('Reading user:2...');
const user = users.get('user:2');
console.log('User 2:', user);

// Count items
console.log('Total users:', users.count());

// Find items using range query
console.log('Finding users in range user:2 to user:4...');
const results = users.find({ 
  gte: 'user:2', 
  lte: 'user:4' 
});
console.log('Found users:', results);

// Delete an item
console.log('Deleting user:3...');
users.del('user:3');
console.log('Total users after delete:', users.count());

// Find all remaining users
console.log('All remaining users:');
const allUsers = users.find({});
console.log(allUsers);

// Close the environment when done
console.log('Closing environment...');
env.close();

console.log('Example completed successfully!');