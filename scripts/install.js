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
  console.log('libmdbx directory already exists');
  
  // Check if it's a git repository - if not, it's likely from an npm package 
  const isGitRepo = fs.existsSync(path.join(LIBMDBX_DIR, '.git'));
  
  if (isGitRepo) {
    console.log('libmdbx is a git repository, checking if it needs updating...');
    
    // If it's from a package and has a .git placeholder, clone the real repo
    if (!fs.existsSync(path.join(LIBMDBX_DIR, '.git', 'config'))) {
      console.log('Package contains a placeholder .git directory, cloning actual repository...');
      
      // Save the original files we need to keep
      const tempDir = path.join(os.tmpdir(), `libmdbx-backup-${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });
      if (fs.existsSync(path.join(LIBMDBX_DIR, 'build'))) {
        fs.renameSync(path.join(LIBMDBX_DIR, 'build'), path.join(tempDir, 'build'));
      }
      
      // Remove everything except backups
      fs.rmSync(LIBMDBX_DIR, { recursive: true, force: true });
      
      // Clone the actual repository
      console.log(`Cloning libmdbx repository (version ${LIBMDBX_VERSION})...`);
      runCommand('git', ['clone', '--branch', `v${LIBMDBX_VERSION}`, '--depth', '1', LIBMDBX_REPO, LIBMDBX_DIR]);
      
      // Restore the files we backed up
      if (fs.existsSync(path.join(tempDir, 'build'))) {
        if (!fs.existsSync(path.join(LIBMDBX_DIR, 'build'))) {
          fs.mkdirSync(path.join(LIBMDBX_DIR, 'build'), { recursive: true });
        }
        fs.renameSync(path.join(tempDir, 'build'), path.join(LIBMDBX_DIR, 'build'));
      }
      
      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    } else {
      // It's a real git repo, handle normally
      // Pull latest changes
      runCommand('git', ['fetch', 'origin'], LIBMDBX_DIR);
      
      // Check if we need to checkout a different version
      try {
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
      } catch (error) {
        console.log(`Error checking git tags: ${error.message}, forcing checkout of v${LIBMDBX_VERSION}...`);
        runCommand('git', ['checkout', `v${LIBMDBX_VERSION}`], LIBMDBX_DIR);
      }
    }
  } else {
    console.log('Using pre-installed libmdbx from the package');
    
    // For non-git packages, create VERSION.txt to make it look like an amalgamated source
    if (!fs.existsSync(path.join(LIBMDBX_DIR, 'VERSION.txt'))) {
      console.log('Creating VERSION.txt for amalgamated build compatibility...');
      fs.writeFileSync(path.join(LIBMDBX_DIR, 'VERSION.txt'), `v${LIBMDBX_VERSION}\n`);
    }
  }
} else {
  // Clone the repository
  console.log(`Cloning libmdbx repository (version ${LIBMDBX_VERSION})...`);
  runCommand('git', ['clone', '--branch', `v${LIBMDBX_VERSION}`, '--depth', '1', LIBMDBX_REPO, LIBMDBX_DIR]);
  
  // Create VERSION.txt for consistent behavior
  fs.writeFileSync(path.join(LIBMDBX_DIR, 'VERSION.txt'), `v${LIBMDBX_VERSION}\n`);
}

// Create build directory
const buildDir = path.join(LIBMDBX_DIR, 'build');

// Always clean build directory first when it's from a package
if (!fs.existsSync(path.join(LIBMDBX_DIR, '.git'))) {
  console.log('Cleaning build directory from package to prevent path conflicts...');
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }
}

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Create cmake version numbers file for all builds to ensure compatibility with all platforms
const cmakeVersionDir = path.join(buildDir, 'cmake');
if (!fs.existsSync(cmakeVersionDir)) {
  fs.mkdirSync(cmakeVersionDir, { recursive: true });
}

const versionParts = LIBMDBX_VERSION.split('.');
const versionHeader = `
#define MDBX_VERSION_MAJOR ${versionParts[0] || 0}
#define MDBX_VERSION_MINOR ${versionParts[1] || 0}
#define MDBX_VERSION_RELEASE ${versionParts[2] || 0}
#define MDBX_VERSION_REVISION 0
`;
fs.writeFileSync(path.join(cmakeVersionDir, 'cmake_version_numbers.h'), versionHeader);

// Check if build directory contains compiled library
const hasBuildArtifacts = fs.existsSync(path.join(buildDir, process.platform === 'win32' ? 'libmdbx.lib' : 'libmdbx.dylib')) ||
                         fs.existsSync(path.join(buildDir, 'libmdbx.so'));
                         
if (!hasBuildArtifacts) {
  // Build libmdbx based on the platform
  if (process.platform === 'win32') {
    // Windows build
    console.log('Building libmdbx on Windows...');
    runCommand('cmake', ['..', '-A', process.arch === 'x64' ? 'x64' : 'Win32'], buildDir);
    runCommand('cmake', ['--build', '.', '--config', 'Release'], buildDir);
  } else {
    // Unix build (Linux, macOS, etc.)
    console.log(`Building libmdbx on ${process.platform}...`);
    
    // On Linux, add flags to ensure proper pthread detection
    const cmakeArgs = ['..'];
    if (process.platform === 'linux') {
      cmakeArgs.push('-DCMAKE_THREAD_LIBS_INIT="-lpthread"');
      cmakeArgs.push('-DCMAKE_HAVE_LIBC_PTHREAD=1');
      cmakeArgs.push('-DCMAKE_C_FLAGS="-pthread"');
      cmakeArgs.push('-DCMAKE_CXX_FLAGS="-pthread"');
    }
    
    runCommand('cmake', cmakeArgs, buildDir);
    runCommand('make', [], buildDir);
  }
} else {
  console.log('libmdbx build artifacts already exist, skipping build step');
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