'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const os = require('os');

// Configuration
const LIBMDBX_VERSION = '0.12.1';
const LIBMDBX_REPO = 'https://github.com/erthink/libmdbx.git';
const DEPS_DIR = path.join(__dirname, '..', 'deps');
const LIBMDBX_DIR = path.join(DEPS_DIR, 'libmdbx');

// Create deps directory if it doesn't exist
if (!fs.existsSync(DEPS_DIR)) {
  fs.mkdirSync(DEPS_DIR, { recursive: true });
}

// Function to run a command and handle errors
function runCommand(command, args, cwd) {
  console.log(`Running: ${command} ${args.join(' ')}`);
  
  const result = spawnSync(command, args, {
    cwd: cwd || process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  
  if (result.status !== 0) {
    console.error(`Command failed with exit code ${result.status}`);
    process.exit(1);
  }
  
  return result;
}

// Check if libmdbx directory already exists
if (fs.existsSync(LIBMDBX_DIR)) {
  console.log('libmdbx directory already exists, checking if it needs updating...');
  
  // Pull latest changes
  runCommand('git', ['fetch', 'origin'], LIBMDBX_DIR);
  
  // Check if we need to checkout a different version
  const currentTag = spawnSync('git', ['describe', '--tags'], {
    cwd: LIBMDBX_DIR,
    encoding: 'utf8'
  }).stdout.trim();
  
  if (currentTag !== `v${LIBMDBX_VERSION}`) {
    console.log(`Updating libmdbx from ${currentTag} to v${LIBMDBX_VERSION}...`);
    runCommand('git', ['checkout', `v${LIBMDBX_VERSION}`], LIBMDBX_DIR);
  } else {
    console.log(`libmdbx is already at version ${LIBMDBX_VERSION}`);
  }
} else {
  // Clone the repository
  console.log(`Cloning libmdbx repository (version ${LIBMDBX_VERSION})...`);
  runCommand('git', ['clone', '--branch', `v${LIBMDBX_VERSION}`, '--depth', '1', LIBMDBX_REPO, LIBMDBX_DIR]);
}

// Create build directory
const buildDir = path.join(LIBMDBX_DIR, 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Build libmdbx based on the platform
if (process.platform === 'win32') {
  // Windows build
  console.log('Building libmdbx on Windows...');
  runCommand('cmake', ['..', '-A', process.arch === 'x64' ? 'x64' : 'Win32'], buildDir);
  runCommand('cmake', ['--build', '.', '--config', 'Release'], buildDir);
} else {
  // Unix build (Linux, macOS, etc.)
  console.log(`Building libmdbx on ${process.platform}...`);
  runCommand('cmake', ['..'], buildDir);
  runCommand('make', [], buildDir);
}

console.log('libmdbx build complete!');

// Create header file with MDBX constants
console.log('Creating mdbx.h header file...');

const headerPath = path.join(__dirname, '..', 'src', 'libmdbx.h');
fs.writeFileSync(headerPath, `
#ifndef MDBXJS_LIBMDBX_H
#define MDBXJS_LIBMDBX_H

#include "${path.join(LIBMDBX_DIR, 'mdbx.h').replace(/\\/g, '/')}"

#endif // MDBXJS_LIBMDBX_H
`);

console.log('Installation completed successfully!');