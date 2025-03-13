#ifndef MDBX_ENV_H
#define MDBX_ENV_H

#include <napi.h>
#include <string>
#include "mdbx_wrapper.h"

class MdbxEnv : public Napi::ObjectWrap<MdbxEnv> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::FunctionReference constructor;
  
  MdbxEnv(const Napi::CallbackInfo& info);
  ~MdbxEnv();

  // MDBX environment
  MDBX_env* env_;
  bool isOpen_ = false;

  // Node.js methods
  Napi::Value Open(const Napi::CallbackInfo& info);
  void Close(const Napi::CallbackInfo& info);
  Napi::Value Sync(const Napi::CallbackInfo& info);
  Napi::Value Stat(const Napi::CallbackInfo& info);
  Napi::Value Info(const Napi::CallbackInfo& info);
  void Copy(const Napi::CallbackInfo& info);
  void SetMapSize(const Napi::CallbackInfo& info);
};

#endif // MDBX_ENV_H