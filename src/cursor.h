#ifndef MDBX_CURSOR_H
#define MDBX_CURSOR_H

#include <napi.h>
#include "../deps/libmdbx/mdbx.h"
#include "txn.h"
#include "dbi.h"

class MdbxCursor : public Napi::ObjectWrap<MdbxCursor> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::FunctionReference constructor;
  
  MdbxCursor(const Napi::CallbackInfo& info);
  ~MdbxCursor();

  // MDBX cursor
  MDBX_cursor* cursor_;
  MdbxTxn* txn_;
  MdbxDbi* dbi_;
  
  // Node.js methods
  void Close(const Napi::CallbackInfo& info);
  void Del(const Napi::CallbackInfo& info);
  Napi::Value Get(const Napi::CallbackInfo& info);
  void Put(const Napi::CallbackInfo& info);
  Napi::Value Count(const Napi::CallbackInfo& info);
};

#endif // MDBX_CURSOR_H