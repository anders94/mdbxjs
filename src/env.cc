#include "env.h"
#include <filesystem>
#include <iostream>

Napi::FunctionReference MdbxEnv::constructor;

Napi::Object MdbxEnv::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "Environment", {
    InstanceMethod("open", &MdbxEnv::Open),
    InstanceMethod("close", &MdbxEnv::Close),
    InstanceMethod("sync", &MdbxEnv::Sync),
    InstanceMethod("stat", &MdbxEnv::Stat),
    InstanceMethod("info", &MdbxEnv::Info),
    InstanceMethod("copy", &MdbxEnv::Copy),
    InstanceMethod("setMapSize", &MdbxEnv::SetMapSize),
  });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("Environment", func);
  return exports;
}

MdbxEnv::MdbxEnv(const Napi::CallbackInfo& info) 
  : Napi::ObjectWrap<MdbxEnv>(info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  int rc = mdbx_env_create(&env_);
  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return;
  }
}

MdbxEnv::~MdbxEnv() {
  if (isOpen_) {
    mdbx_env_close(env_);
    isOpen_ = false;
  }
}

Napi::Value MdbxEnv::Open(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Object expected").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Object options = info[0].As<Napi::Object>();
  std::string path = options.Has("path") ? 
    std::string(options.Get("path").As<Napi::String>()) : "./mdbxjs-data";
  
  uint64_t mapSize = options.Has("mapSize") ? 
    options.Get("mapSize").ToNumber().Int64Value() : 10ULL * 1024ULL * 1024ULL * 1024ULL;
  
  int maxDbs = options.Has("maxDbs") ? 
    options.Get("maxDbs").ToNumber().Int32Value() : 10;
  
  int maxReaders = options.Has("maxReaders") ? 
    options.Get("maxReaders").ToNumber().Int32Value() : 126;
  
  int flags = options.Has("flags") ? 
    options.Get("flags").ToNumber().Int32Value() : 0;

  // Set map size
  int rc = mdbx_env_set_mapsize(env_, mapSize);
  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return env.Null();
  }

  // Set max databases
  rc = mdbx_env_set_maxdbs(env_, maxDbs);
  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return env.Null();
  }

  // Set max readers
  rc = mdbx_env_set_maxreaders(env_, maxReaders);
  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return env.Null();
  }

  // Create directory if it doesn't exist
  std::error_code ec;
  std::filesystem::create_directories(path, ec);
  if (ec) {
    std::string errorMsg = "Failed to create directory: " + path + ", error: " + ec.message();
    Napi::Error::New(env, errorMsg).ThrowAsJavaScriptException();
    return env.Null();
  }

  // Open environment
  rc = mdbx_env_open(env_, path.c_str(), static_cast<MDBX_env_flags_t>(flags), 0664);
  if (rc != MDBX_SUCCESS) {
    std::string errorMsg = "Failed to open environment at " + path + ": " + mdbx_strerror(rc);
    Napi::Error::New(env, errorMsg).ThrowAsJavaScriptException();
    return env.Null();
  }

  isOpen_ = true;
  return info.This();
}

void MdbxEnv::Close(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (isOpen_) {
    mdbx_env_close(env_);
    isOpen_ = false;
  }
}

Napi::Value MdbxEnv::Sync(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);
  
  if (!isOpen_) {
    Napi::Error::New(env, "Environment is not open").ThrowAsJavaScriptException();
    return env.Null();
  }

  bool force = false;
  if (info.Length() > 0 && info[0].IsBoolean()) {
    force = info[0].ToBoolean();
  }

  int rc = mdbx_env_sync_ex(env_, force, false);
  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return env.Null();
  }

  return env.Undefined();
}

Napi::Value MdbxEnv::Stat(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);
  
  if (!isOpen_) {
    Napi::Error::New(env, "Environment is not open").ThrowAsJavaScriptException();
    return env.Null();
  }

  MDBX_stat stat;
  int rc = mdbx_env_stat(env_, &stat, sizeof(stat));
  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("psize", Napi::Number::New(env, stat.ms_psize));
  result.Set("depth", Napi::Number::New(env, stat.ms_depth));
  result.Set("branch_pages", Napi::Number::New(env, stat.ms_branch_pages));
  result.Set("leaf_pages", Napi::Number::New(env, stat.ms_leaf_pages));
  result.Set("overflow_pages", Napi::Number::New(env, stat.ms_overflow_pages));
  result.Set("entries", Napi::Number::New(env, stat.ms_entries));

  return result;
}

Napi::Value MdbxEnv::Info(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);
  
  if (!isOpen_) {
    Napi::Error::New(env, "Environment is not open").ThrowAsJavaScriptException();
    return env.Null();
  }

  MDBX_envinfo envinfo;
  int rc = mdbx_env_info_ex(env_, NULL, &envinfo, sizeof(envinfo));
  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("mapSize", Napi::Number::New(env, static_cast<double>(envinfo.mi_mapsize)));
  result.Set("lastPageNumber", Napi::Number::New(env, static_cast<double>(envinfo.mi_last_pgno)));
  result.Set("lastTransactionId", Napi::Number::New(env, static_cast<double>(envinfo.mi_recent_txnid)));
  result.Set("maxReaders", Napi::Number::New(env, envinfo.mi_maxreaders));
  result.Set("numReaders", Napi::Number::New(env, envinfo.mi_numreaders));

  return result;
}

void MdbxEnv::Copy(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);
  
  if (!isOpen_) {
    Napi::Error::New(env, "Environment is not open").ThrowAsJavaScriptException();
    return;
  }

  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "String expected for path").ThrowAsJavaScriptException();
    return;
  }

  std::string path = info[0].ToString();
  
  // Create directory if it doesn't exist
  std::error_code ec;
  std::filesystem::create_directories(path, ec);
  if (ec) {
    std::string errorMsg = "Failed to create directory: " + path + ", error: " + ec.message();
    Napi::Error::New(env, errorMsg).ThrowAsJavaScriptException();
    return;
  }

  int rc = mdbx_env_copy(env_, path.c_str(), MDBX_CP_COMPACT);
  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return;
  }
}

void MdbxEnv::SetMapSize(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);
  
  if (!isOpen_) {
    Napi::Error::New(env, "Environment is not open").ThrowAsJavaScriptException();
    return;
  }

  if (info.Length() < 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "Number expected for size").ThrowAsJavaScriptException();
    return;
  }

  uint64_t size = info[0].ToNumber().Int64Value();
  
  int rc = mdbx_env_set_mapsize(env_, size);
  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return;
  }
}