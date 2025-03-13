'use strict';

const mdbx = require('../lib');

// This example demonstrates basic CRUD operations using the simplified API

// Open environment and create a collection
const env = mdbx.open('./mdbx-crud');
const users = mdbx.collection(env, 'users');

// CREATE - Add new users
console.log('Creating users...');

users.put('user:1', { 
  name: 'John Doe',
  email: 'john@example.com',
  age: 30,
  active: true,
  roles: ['user', 'admin']
});

users.put('user:2', { 
  name: 'Jane Smith',
  email: 'jane@example.com',
  age: 25,
  active: true,
  roles: ['user']
});

users.put('user:3', { 
  name: 'Bob Johnson',
  email: 'bob@example.com',
  age: 45,
  active: false,
  roles: ['user']
});

// READ - Get a specific user
console.log('\nReading user:1...');
const user = users.get('user:1');
console.log(user);

// READ - Find all active users
console.log('\nFinding all users...');
const allUsers = users.find({});
console.log(`Found ${allUsers.length} users:`);

// JavaScript-side filtering (the database can only query by key ranges)
const activeUsers = allUsers.filter(user => user.value.active);
console.log(`${activeUsers.length} active users:`);
activeUsers.forEach(user => {
  console.log(`- ${user.value.name} (${user.value.email})`);
});

// UPDATE - Modify a user
console.log('\nUpdating user:2...');
const user2 = users.get('user:2');
user2.age = 26;
user2.roles.push('editor');
users.put('user:2', user2);

console.log('Updated user:2:');
console.log(users.get('user:2'));

// DELETE - Remove a user
console.log('\nDeleting user:3...');
users.del('user:3');

console.log('Remaining users:');
const remainingUsers = users.find({});
remainingUsers.forEach(user => {
  console.log(`- ${user.key}: ${user.value.name}`);
});

// Count the remaining users
console.log(`\nTotal users: ${users.count()}`);

// Clean up
env.close();
console.log('\nExample completed successfully!');