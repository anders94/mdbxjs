#ifndef MDBX_DBI_H
#define MDBX_DBI_H

#include <napi.h>
#include <string>
#include "mdbx_wrapper.h"
#include "env.h"
#include "txn.h"

class MdbxDbi : public Napi::ObjectWrap<MdbxDbi> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::FunctionReference constructor;
  
  MdbxDbi(const Napi::CallbackInfo& info);
  ~MdbxDbi();

  // MDBX database handle
  MDBX_dbi dbi_;
  MdbxEnv* env_;
  bool isOpen_;
  
  // Node.js methods
  void Close(const Napi::CallbackInfo& info);
  void Drop(const Napi::CallbackInfo& info);
  Napi::Value Stat(const Napi::CallbackInfo& info);

  friend class MdbxTxn;
  friend class MdbxCursor;
};

#endif // MDBX_DBI_H