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
function runCommand(command, args, cwd, noExit = false) {
  console.log(`Running: ${command} ${args.join(' ')}`);
  
  const result = spawnSync(command, args, {
    cwd: cwd || process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  
  if (result.status !== 0) {
    console.error(`Command failed with exit code ${result.status}`);
    if (!noExit) {
      process.exit(1);
    } else {
      throw new Error(`Command ${command} failed with exit code ${result.status}`);
    }
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

// Create a patch to the CMakeLists.txt file to bypass version parsing issues
// This approach modifies the relevant part of the CMake configuration process
const cmakeListsPath = path.join(LIBMDBX_DIR, 'CMakeLists.txt');
if (fs.existsSync(cmakeListsPath)) {
  console.log('Patching CMakeLists.txt to fix version parsing issues...');
  
  // Read the CMakeLists.txt file
  let cmakeContent = fs.readFileSync(cmakeListsPath, 'utf8');
  
  // Find the fetch_version call that's causing the error and replace it with direct version setting
  const versionString = `"${LIBMDBX_VERSION}"`;
  if (cmakeContent.includes('fetch_version(')) {
    cmakeContent = cmakeContent.replace(
      /fetch_version\([^)]+\)/g, 
      `set(MDBX_VERSION_MAJOR ${LIBMDBX_VERSION.split('.')[0] || 0})
set(MDBX_VERSION_MINOR ${LIBMDBX_VERSION.split('.')[1] || 0})
set(MDBX_VERSION_RELEASE ${LIBMDBX_VERSION.split('.')[2] || 0})
set(MDBX_VERSION_REVISION 0)
set(MDBX_VERSION_SUFFIX "")
set(MDBX_VERSION_SERIAL 0)`
    );
    
    // Write back the patched CMakeLists.txt
    fs.writeFileSync(cmakeListsPath, cmakeContent);
  } else {
    console.log('Could not find fetch_version call in CMakeLists.txt, trying another approach');
  }
}

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
    
    // On Linux, add flags to ensure proper pthread detection and bypass version issues
    const cmakeArgs = ['..'];
    if (process.platform === 'linux') {
      // Add flags for pthread
      cmakeArgs.push('-DCMAKE_THREAD_LIBS_INIT="-lpthread"');
      cmakeArgs.push('-DCMAKE_HAVE_LIBC_PTHREAD=1');
      cmakeArgs.push('-DCMAKE_C_FLAGS="-pthread"');
      cmakeArgs.push('-DCMAKE_CXX_FLAGS="-pthread"');
      
      // Create a CMake preload script to set version variables directly
      const versionParts = LIBMDBX_VERSION.split('.');
      const major = versionParts[0] || 0;
      const minor = versionParts[1] || 0;
      const release = versionParts[2] || 0;
      const cmakePreloadContent = `
# CMake preload script to set MDBX version variables directly
# This bypasses the problematic version parsing in utils.cmake
set(MDBX_VERSION_MAJOR ${major} CACHE STRING "MDBX major version" FORCE)
set(MDBX_VERSION_MINOR ${minor} CACHE STRING "MDBX minor version" FORCE)
set(MDBX_VERSION_RELEASE ${release} CACHE STRING "MDBX release version" FORCE)
set(MDBX_VERSION_REVISION 0 CACHE STRING "MDBX revision version" FORCE)
set(MDBX_VERSION_SUFFIX "" CACHE STRING "MDBX version suffix" FORCE)
set(MDBX_VERSION_SERIAL 0 CACHE STRING "MDBX serial version" FORCE)

# Define this function to override the one in utils.cmake
function(fetch_version name version_files version_macro)
  # This is a no-op because we've already set the version variables above
  message(STATUS "Using pre-defined version variables: \${MDBX_VERSION_MAJOR}.\${MDBX_VERSION_MINOR}.\${MDBX_VERSION_RELEASE}")
endfunction()
`;
      
      const preloadScriptPath = path.join(buildDir, 'version_preload.cmake');
      fs.writeFileSync(preloadScriptPath, cmakePreloadContent);
      
      // Use the preload script
      cmakeArgs.push(`-C${preloadScriptPath}`);
    }
    
    try {
      console.log('Attempting to build with CMake...');
      runCommand('cmake', cmakeArgs, buildDir, true);
      runCommand('make', [], buildDir, true);
    } catch (error) {
      console.log(`CMake build failed: ${error.message}`);
      console.log('Falling back to direct build approach...');
      
      // Create a simplified build script as a fallback
      const simpleBuildScript = `#!/bin/bash
cd "${LIBMDBX_DIR}"
mkdir -p "${buildDir}"
echo "Building libmdbx with direct compilation..."
cc -shared -o "${path.join(buildDir, process.platform === 'darwin' ? 'libmdbx.dylib' : 'libmdbx.so')}" -fPIC -DMDBX_BUILD_SHARED_LIBRARY=1 ${process.platform === 'linux' ? '-DMDBX_CONFIG_MANUAL_TLS_CALLBACK=0' : ''} $(find . -maxdepth 1 -name "*.c" -not -path "*dist*" -not -path "*test*") ${process.platform === 'linux' ? '-lpthread' : ''}

# Create a symlink to help the linker find it if Linux
if [ "$(uname)" = "Linux" ]; then
  ln -sf "${path.join(buildDir, 'libmdbx.so')}" "${path.join(LIBMDBX_DIR, 'libmdbx.so')}"
fi
`;
      
      const scriptPath = path.join(buildDir, 'build_simple.sh');
      fs.writeFileSync(scriptPath, simpleBuildScript);
      fs.chmodSync(scriptPath, 0o755);
      
      // Run the script
      runCommand('bash', [scriptPath]);
      
      console.log('Simplified library build completed.');
    }
  }
} else {
  console.log('libmdbx build artifacts already exist, skipping build step');
}

console.log('libmdbx build complete!');

// Make sure the mdbx.h file in the src directory includes the correct path
console.log('Creating header file for mdbx.h...');

// Create a header file in src directory that points to the actual libmdbx header
const headerPath = path.join(__dirname, '..', 'src', 'mdbx.h');
const headerContent = `#ifndef MDBXJS_MDBX_H
#define MDBXJS_MDBX_H

// Include the actual libmdbx.h
#include "../deps/libmdbx/mdbx.h"

#endif // MDBXJS_MDBX_H
`;

// Write the header file
fs.writeFileSync(headerPath, headerContent);
console.log(`Created header file at ${headerPath}`);

// Verify the actual libmdbx header exists
const sourceHeader = path.join(LIBMDBX_DIR, 'mdbx.h');
if (!fs.existsSync(sourceHeader)) {
  console.error(`ERROR: Source header file ${sourceHeader} does not exist!`);
  process.exit(1);
}

// Also copy any other necessary headers
try {
  const mdbxHeadersDir = path.join(LIBMDBX_DIR, 'mdbx');
  if (fs.existsSync(mdbxHeadersDir) && fs.statSync(mdbxHeadersDir).isDirectory()) {
    const srcMdbxDir = path.join(__dirname, '..', 'src', 'mdbx');
    if (!fs.existsSync(srcMdbxDir)) {
      fs.mkdirSync(srcMdbxDir, { recursive: true });
    }
    
    // Copy all header files from mdbx directory
    const headerFiles = fs.readdirSync(mdbxHeadersDir)
      .filter(file => file.endsWith('.h'));
    
    headerFiles.forEach(file => {
      const sourcePath = path.join(mdbxHeadersDir, file);
      const targetHeaderPath = path.join(srcMdbxDir, file);
      fs.copyFileSync(sourcePath, targetHeaderPath);
      console.log(`Additional header ${file} copied`);
    });
  }
} catch (additionalError) {
  console.error(`Warning: Could not copy additional headers: ${additionalError.message}`);
}

// For any platform, make sure we have the required library files
const libFile = process.platform === 'win32' ? 'libmdbx.lib' : (process.platform === 'darwin' ? 'libmdbx.dylib' : 'libmdbx.so');
if (!fs.existsSync(path.join(buildDir, libFile))) {
  console.log(`Library file ${libFile} not found. Creating a simplified library build...`);
  
  // Create a simplified build script
  const simpleBuildScript = `#!/bin/bash
cd "${LIBMDBX_DIR}"
mkdir -p "${buildDir}"
echo "Building libmdbx with fallback direct compilation..."
${process.platform === 'win32' 
  ? 'echo "Windows build requires MSVC, please install the library manually"' 
  : `cc -shared -o "${path.join(buildDir, libFile)}" -fPIC -DMDBX_BUILD_SHARED_LIBRARY=1 ${process.platform === 'linux' ? '-DMDBX_CONFIG_MANUAL_TLS_CALLBACK=0' : ''} $(find . -maxdepth 1 -name "*.c" -not -path "*dist*" -not -path "*test*") ${process.platform === 'linux' ? '-lpthread' : ''}

# Create symlinks to help the linker find it if Linux
if [ "$(uname)" = "Linux" ]; then
  echo "Creating symlinks for Linux..."
  ln -sf "${path.join(buildDir, 'libmdbx.so')}" "${path.join(LIBMDBX_DIR, 'libmdbx.so')}"
  ln -sf "${path.join(buildDir, 'libmdbx.so')}" "$(pwd)/libmdbx.so"
fi`}
`;
  
  const scriptPath = path.join(buildDir, 'build_simple.sh');
  fs.writeFileSync(scriptPath, simpleBuildScript);
  fs.chmodSync(scriptPath, 0o755);
  
  if (process.platform !== 'win32') {
    // Run the script
    runCommand('bash', [scriptPath]);
    console.log('Simplified library build completed.');
  } else {
    console.log('Windows build requires MSVC, please install the library manually');
  }
}

// Final verification of library existence
if (!fs.existsSync(path.join(buildDir, libFile))) {
  console.error(`ERROR: Library file ${libFile} still not found after build attempts.`);
  console.error(`Expected library at: ${path.join(buildDir, libFile)}`);
  console.error('The module will likely fail to build. Please check your build environment.');
  
  // On Linux, try again with even simpler approach that doesn't rely on find
  if (process.platform === 'linux') {
    console.log('Attempting one final build with hardcoded source files...');
    
    // Create an extremely simple build script with explicit source files
    const lastResortScript = `#!/bin/bash
cd "${LIBMDBX_DIR}"
mkdir -p "${buildDir}"
echo "Building libmdbx with hardcoded source files..."
cc -shared -o "${path.join(buildDir, 'libmdbx.so')}" -fPIC \\
  -DMDBX_BUILD_SHARED_LIBRARY=1 \\
  -DMDBX_CONFIG_MANUAL_TLS_CALLBACK=0 \\
  mdbx.c \\
  -lpthread

# Create a symlink to help the linker find it
ln -sf "${path.join(buildDir, 'libmdbx.so')}" "${path.join(LIBMDBX_DIR, 'libmdbx.so')}"
`;
    
    const finalScriptPath = path.join(buildDir, 'last_resort.sh');
    fs.writeFileSync(finalScriptPath, lastResortScript);
    fs.chmodSync(finalScriptPath, 0o755);
    
    try {
      runCommand('bash', [finalScriptPath], null, true);
      if (fs.existsSync(path.join(buildDir, 'libmdbx.so'))) {
        console.log('Last resort build succeeded!');
      } else {
        console.error('Last resort build also failed.');
      }
    } catch (error) {
      console.error(`Last resort build failed: ${error.message}`);
    }
  }
  
  process.exit(1);
}

// Print installation debug information
console.log('\nInstallation Debug Information:');
console.log('-----------------------------');
console.log(`Working directory: ${process.cwd()}`);
console.log(`libmdbx directory: ${LIBMDBX_DIR}`);
console.log(`libmdbx build directory: ${buildDir}`);
console.log(`libmdbx.h source: ${path.join(LIBMDBX_DIR, 'mdbx.h')}`);
console.log(`mdbx.h target: ${path.join(__dirname, '..', 'src', 'mdbx.h')}`);
console.log(`Library file: ${path.join(buildDir, libFile)}`);

// Make a final verification that critical files exist
const criticalFiles = [
  { path: path.join(buildDir, libFile), name: 'Library file' },
  { path: path.join(__dirname, '..', 'src', 'mdbx.h'), name: 'mdbx.h header' },
  { path: path.join(LIBMDBX_DIR, 'mdbx.h'), name: 'libmdbx mdbx.h header' }
];

let missingFiles = criticalFiles.filter(file => !fs.existsSync(file.path));
if (missingFiles.length > 0) {
  console.error('\nWARNING: Some critical files are missing:');
  missingFiles.forEach(file => {
    console.error(`- ${file.name} not found at: ${file.path}`);
  });
  console.error('This may cause build problems. Please check the installation logs.');
} else {
  console.log('\nAll critical files verified. Installation completed successfully!');
}