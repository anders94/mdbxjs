#ifndef MDBXJS_MDBX_WRAPPER_H
#define MDBXJS_MDBX_WRAPPER_H

// System includes that might be needed
#include <stdarg.h>
#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>
#include <assert.h>
#include <errno.h>
#include <limits.h>

#if defined(_WIN32) || defined(_WIN64)
#include <windows.h>
#include <winnt.h>
#else
#include <pthread.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/uio.h>
#endif

// Define required macros
#ifndef MDBX_API
#if defined(_WIN32) || defined(_WIN64)
#define MDBX_API __declspec(dllimport)
#else
#define MDBX_API __attribute__((visibility("default")))
#endif
#endif

#define MDBX_BUILD_SHARED_LIBRARY 1
#define LIBMDBX_EXPORTS 1

// Add Mac-specific flags
#if defined(__APPLE__) || defined(__darwin__) || defined(__MACH__)
#define MDBX_OSX 1
#define _DARWIN_C_SOURCE 1
#endif

// Try different include paths for mdbx.h - the actual one will be found
#if __has_include("../deps/libmdbx/mdbx.h")
#include "../deps/libmdbx/mdbx.h"
#elif __has_include("../../deps/libmdbx/mdbx.h")
#include "../../deps/libmdbx/mdbx.h"
#elif __has_include("deps/libmdbx/mdbx.h")
#include "deps/libmdbx/mdbx.h"
#elif __has_include("mdbx.h")
#include "mdbx.h"
#else
#error "Cannot find mdbx.h header file"
#endif

#endif // MDBXJS_MDBX_WRAPPER_H