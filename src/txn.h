#ifndef MDBX_TXN_H
#define MDBX_TXN_H

#include <napi.h>
#include "mdbx.h"
#include "env.h"

class MdbxTxn : public Napi::ObjectWrap<MdbxTxn> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::FunctionReference constructor;
  
  MdbxTxn(const Napi::CallbackInfo& info);
  ~MdbxTxn();

  // MDBX transaction
  MDBX_txn* txn_;
  bool isReadOnly_;
  
  // Node.js methods
  void Abort(const Napi::CallbackInfo& info);
  void Commit(const Napi::CallbackInfo& info);
  void Reset(const Napi::CallbackInfo& info);
  void Renew(const Napi::CallbackInfo& info);
  
  Napi::Value Get(const Napi::CallbackInfo& info);
  void Put(const Napi::CallbackInfo& info);
  Napi::Value Del(const Napi::CallbackInfo& info);
};

#endif // MDBX_TXN_H