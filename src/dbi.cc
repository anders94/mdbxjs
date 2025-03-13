#include "dbi.h"

Napi::FunctionReference MdbxDbi::constructor;

Napi::Object MdbxDbi::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "Database", {
    InstanceMethod("close", &MdbxDbi::Close),
    InstanceMethod("drop", &MdbxDbi::Drop),
    InstanceMethod("stat", &MdbxDbi::Stat)
  });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("Database", func);
  return exports;
}

MdbxDbi::MdbxDbi(const Napi::CallbackInfo& info) 
  : Napi::ObjectWrap<MdbxDbi>(info), isOpen_(false) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "First argument must be an Environment object").ThrowAsJavaScriptException();
    return;
  }

  env_ = Napi::ObjectWrap<MdbxEnv>::Unwrap(info[0].As<Napi::Object>());
  if (!env_ || !env_->isOpen_) {
    Napi::Error::New(env, "Environment is not open").ThrowAsJavaScriptException();
    return;
  }

  // Parse options if provided
  std::string name;
  unsigned int flags = 0;

  if (info.Length() > 1 && info[1].IsObject()) {
    Napi::Object options = info[1].As<Napi::Object>();
    
    // Get database name
    if (options.Has("name") && !options.Get("name").IsNull() && !options.Get("name").IsUndefined()) {
      name = options.Get("name").ToString();
    }
    
    // Get flags
    if (options.Has("flags")) {
      flags = options.Get("flags").ToNumber().Uint32Value();
    }
    
    // Check if create flag should be added
    if (options.Has("create") && options.Get("create").ToBoolean() && !(flags & MDBX_CREATE)) {
      flags |= MDBX_CREATE;
    }
  }

  // Create a temporary transaction to open the database
  MDBX_txn* txn;
  int rc = mdbx_txn_begin(env_->env_, nullptr, static_cast<MDBX_txn_flags_t>(0), &txn);
  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return;
  }

  // Open the database
  const char* namePtr = name.empty() ? nullptr : name.c_str();
  rc = mdbx_dbi_open(txn, namePtr, static_cast<MDBX_db_flags_t>(flags), &dbi_);

  // Commit or abort the transaction
  if (rc == MDBX_SUCCESS) {
    rc = mdbx_txn_commit(txn);
    isOpen_ = true;
  } else {
    mdbx_txn_abort(txn);
  }

  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return;
  }
}

MdbxDbi::~MdbxDbi() {
  if (isOpen_ && env_ && env_->isOpen_) {
    // Note: mdbx_dbi_close is needed only if the environment will outlive
    // this database instance, since mdbx_env_close closes all DBIs anyway
    mdbx_dbi_close(env_->env_, dbi_);
    isOpen_ = false;
  }
}

void MdbxDbi::Close(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (isOpen_ && env_ && env_->isOpen_) {
    mdbx_dbi_close(env_->env_, dbi_);
    isOpen_ = false;
  }
}

void MdbxDbi::Drop(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (!isOpen_) {
    Napi::Error::New(env, "Database is not open").ThrowAsJavaScriptException();
    return;
  }

  if (!env_ || !env_->isOpen_) {
    Napi::Error::New(env, "Environment is not open").ThrowAsJavaScriptException();
    return;
  }

  // Create a transaction to drop the database
  MDBX_txn* txn;
  int rc = mdbx_txn_begin(env_->env_, nullptr, static_cast<MDBX_txn_flags_t>(0), &txn);
  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return;
  }

  // Drop the database
  rc = mdbx_drop(txn, dbi_, true);
  
  // Commit or abort the transaction
  if (rc == MDBX_SUCCESS) {
    rc = mdbx_txn_commit(txn);
  } else {
    mdbx_txn_abort(txn);
  }

  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return;
  }

  isOpen_ = false;
}

Napi::Value MdbxDbi::Stat(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (!isOpen_) {
    Napi::Error::New(env, "Database is not open").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Expected transaction object").ThrowAsJavaScriptException();
    return env.Null();
  }

  MdbxTxn* txn = Napi::ObjectWrap<MdbxTxn>::Unwrap(info[0].As<Napi::Object>());
  if (!txn || !txn->txn_) {
    Napi::Error::New(env, "Transaction is not active").ThrowAsJavaScriptException();
    return env.Null();
  }

  MDBX_stat stat;
  int rc = mdbx_dbi_stat(txn->txn_, dbi_, &stat, sizeof(stat));
  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("entries", Napi::Number::New(env, stat.ms_entries));
  result.Set("depth", Napi::Number::New(env, stat.ms_depth));
  result.Set("branch_pages", Napi::Number::New(env, stat.ms_branch_pages));
  result.Set("leaf_pages", Napi::Number::New(env, stat.ms_leaf_pages));
  result.Set("overflow_pages", Napi::Number::New(env, stat.ms_overflow_pages));
  result.Set("page_size", Napi::Number::New(env, stat.ms_psize));

  return result;
}