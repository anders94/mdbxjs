#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

// This file provides minimal implementations of the MDBX functions
// that the Node.js binding needs to link against when the actual
// library cannot be found. This is only for compilation, not for
// actual use.

// Basic types from mdbx.h
typedef struct MDBX_env MDBX_env;
typedef struct MDBX_txn MDBX_txn;
typedef uint32_t MDBX_dbi;
typedef struct MDBX_cursor MDBX_cursor;
typedef struct MDBX_val {
  size_t iov_len;
  void *iov_base;
} MDBX_val;

// Environment functions
int mdbx_env_create(MDBX_env **env) {
  *env = malloc(1); // Dummy allocation
  return 0;
}

int mdbx_env_open(MDBX_env *env, const char *path, unsigned int flags, unsigned int mode) {
  return 0;
}

int mdbx_env_close(MDBX_env *env) {
  free(env);
  return 0;
}

int mdbx_env_set_maxdbs(MDBX_env *env, MDBX_dbi dbs) {
  return 0;
}

int mdbx_env_set_mapsize(MDBX_env *env, size_t size) {
  return 0;
}

int mdbx_env_set_maxreaders(MDBX_env *env, unsigned int readers) {
  return 0;
}

int mdbx_env_sync(MDBX_env *env, int force) {
  return 0;
}

int mdbx_env_stat(MDBX_env *env, void *stat, size_t bytes) {
  memset(stat, 0, bytes);
  return 0;
}

int mdbx_env_info(MDBX_env *env, void *stat, size_t bytes) {
  memset(stat, 0, bytes);
  return 0;
}

int mdbx_env_copy(MDBX_env *env, const char *path) {
  return 0;
}

// Transaction functions
int mdbx_txn_begin(MDBX_env *env, MDBX_txn *parent, unsigned int flags, MDBX_txn **txn) {
  *txn = malloc(1); // Dummy allocation
  return 0;
}

int mdbx_txn_commit(MDBX_txn *txn) {
  free(txn);
  return 0;
}

void mdbx_txn_abort(MDBX_txn *txn) {
  free(txn);
}

void mdbx_txn_reset(MDBX_txn *txn) {
}

int mdbx_txn_renew(MDBX_txn *txn) {
  return 0;
}

// Database functions
int mdbx_dbi_open(MDBX_txn *txn, const char *name, unsigned int flags, MDBX_dbi *dbi) {
  *dbi = 1; // Dummy value
  return 0;
}

int mdbx_dbi_close(MDBX_env *env, MDBX_dbi dbi) {
  return 0;
}

int mdbx_drop(MDBX_txn *txn, MDBX_dbi dbi, int del) {
  return 0;
}

int mdbx_dbi_stat(MDBX_txn *txn, MDBX_dbi dbi, void *stat, size_t bytes) {
  memset(stat, 0, bytes);
  return 0;
}

// Data functions
int mdbx_get(MDBX_txn *txn, MDBX_dbi dbi, MDBX_val *key, MDBX_val *data) {
  return -30798; // MDBX_NOTFOUND
}

int mdbx_put(MDBX_txn *txn, MDBX_dbi dbi, MDBX_val *key, MDBX_val *data, unsigned int flags) {
  return 0;
}

int mdbx_del(MDBX_txn *txn, MDBX_dbi dbi, MDBX_val *key, MDBX_val *data) {
  return 0;
}

// Cursor functions
int mdbx_cursor_open(MDBX_txn *txn, MDBX_dbi dbi, MDBX_cursor **cursor) {
  *cursor = malloc(1); // Dummy allocation
  return 0;
}

void mdbx_cursor_close(MDBX_cursor *cursor) {
  free(cursor);
}

int mdbx_cursor_get(MDBX_cursor *cursor, MDBX_val *key, MDBX_val *data, int op) {
  return -30798; // MDBX_NOTFOUND
}

int mdbx_cursor_put(MDBX_cursor *cursor, MDBX_val *key, MDBX_val *data, unsigned int flags) {
  return 0;
}

int mdbx_cursor_del(MDBX_cursor *cursor, unsigned int flags) {
  return 0;
}

int mdbx_cursor_count(MDBX_cursor *cursor, size_t *countp) {
  *countp = 0;
  return 0;
}