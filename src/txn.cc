#include "txn.h"
#include "dbi.h"

Napi::FunctionReference MdbxTxn::constructor;

Napi::Object MdbxTxn::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "Transaction", {
    InstanceMethod("abort", &MdbxTxn::Abort),
    InstanceMethod("commit", &MdbxTxn::Commit),
    InstanceMethod("reset", &MdbxTxn::Reset),
    InstanceMethod("renew", &MdbxTxn::Renew),
    InstanceMethod("get", &MdbxTxn::Get),
    InstanceMethod("put", &MdbxTxn::Put),
    InstanceMethod("del", &MdbxTxn::Del)
  });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("Transaction", func);
  return exports;
}

MdbxTxn::MdbxTxn(const Napi::CallbackInfo& info) 
  : Napi::ObjectWrap<MdbxTxn>(info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "First argument must be an Environment object").ThrowAsJavaScriptException();
    return;
  }

  MdbxEnv* mdbxEnv = Napi::ObjectWrap<MdbxEnv>::Unwrap(info[0].As<Napi::Object>());
  if (!mdbxEnv || !mdbxEnv->isOpen_) {
    Napi::Error::New(env, "Environment is not open").ThrowAsJavaScriptException();
    return;
  }

  unsigned int flags = 0;
  MdbxTxn* parent = nullptr;
  
  // Parse options if provided
  if (info.Length() > 1 && info[1].IsObject()) {
    Napi::Object options = info[1].As<Napi::Object>();
    
    // Check transaction mode (read-only or read-write)
    if (options.Has("mode")) {
      int mode = options.Get("mode").ToNumber().Int32Value();
      if (mode == 0) { // READONLY
        flags |= MDBX_RDONLY;
      }
    }
    
    // Check for parent transaction
    if (options.Has("parent") && options.Get("parent").IsObject()) {
      Napi::Object parentObj = options.Get("parent").As<Napi::Object>();
      parent = Napi::ObjectWrap<MdbxTxn>::Unwrap(parentObj);
      if (!parent) {
        Napi::Error::New(env, "Invalid parent transaction").ThrowAsJavaScriptException();
        return;
      }
    }
  }

  // Store whether this is a read-only transaction
  isReadOnly_ = (flags & MDBX_RDONLY) != 0;

  // Begin transaction
  int rc = mdbx_txn_begin(mdbxEnv->env_, parent ? parent->txn_ : nullptr, static_cast<MDBX_txn_flags_t>(flags), &txn_);
  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return;
  }
}

MdbxTxn::~MdbxTxn() {
  if (txn_) {
    mdbx_txn_abort(txn_);
    txn_ = nullptr;
  }
}

void MdbxTxn::Abort(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (txn_) {
    mdbx_txn_abort(txn_);
    txn_ = nullptr;
  }
}

void MdbxTxn::Commit(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (!txn_) {
    Napi::Error::New(env, "Transaction already committed or aborted").ThrowAsJavaScriptException();
    return;
  }

  int rc = mdbx_txn_commit(txn_);
  txn_ = nullptr;
  
  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return;
  }
}

void MdbxTxn::Reset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (!txn_) {
    Napi::Error::New(env, "Transaction already committed or aborted").ThrowAsJavaScriptException();
    return;
  }

  if (!isReadOnly_) {
    Napi::Error::New(env, "Only read-only transactions can be reset").ThrowAsJavaScriptException();
    return;
  }
  
  mdbx_txn_reset(txn_);
}

void MdbxTxn::Renew(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (!txn_) {
    Napi::Error::New(env, "Transaction already committed or aborted").ThrowAsJavaScriptException();
    return;
  }

  if (!isReadOnly_) {
    Napi::Error::New(env, "Only read-only transactions can be renewed").ThrowAsJavaScriptException();
    return;
  }
  
  int rc = mdbx_txn_renew(txn_);
  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return;
  }
}

Napi::Value MdbxTxn::Get(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 2 || !info[0].IsObject() || !info[1].IsBuffer()) {
    Napi::TypeError::New(env, "Expected database and key buffer").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!txn_) {
    Napi::Error::New(env, "Transaction already committed or aborted").ThrowAsJavaScriptException();
    return env.Null();
  }

  MdbxDbi* dbi = Napi::ObjectWrap<MdbxDbi>::Unwrap(info[0].As<Napi::Object>());
  if (!dbi) {
    Napi::TypeError::New(env, "Invalid database object").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Buffer<char> keyBuffer = info[1].As<Napi::Buffer<char>>();
  
  MDBX_val key, data;
  key.iov_base = keyBuffer.Data();
  key.iov_len = keyBuffer.Length();

  int rc = mdbx_get(txn_, dbi->dbi_, &key, &data);
  if (rc == MDBX_NOTFOUND) {
    return env.Null();
  } else if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return env.Null();
  }

  return Napi::Buffer<char>::Copy(env, 
                                  static_cast<char*>(data.iov_base),
                                  data.iov_len);
}

void MdbxTxn::Put(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 3 || !info[0].IsObject() || !info[1].IsBuffer() || !info[2].IsBuffer()) {
    Napi::TypeError::New(env, "Expected database, key buffer, and value buffer").ThrowAsJavaScriptException();
    return;
  }

  if (!txn_) {
    Napi::Error::New(env, "Transaction already committed or aborted").ThrowAsJavaScriptException();
    return;
  }

  if (isReadOnly_) {
    Napi::Error::New(env, "Cannot write to a read-only transaction").ThrowAsJavaScriptException();
    return;
  }

  MdbxDbi* dbi = Napi::ObjectWrap<MdbxDbi>::Unwrap(info[0].As<Napi::Object>());
  if (!dbi) {
    Napi::TypeError::New(env, "Invalid database object").ThrowAsJavaScriptException();
    return;
  }

  Napi::Buffer<char> keyBuffer = info[1].As<Napi::Buffer<char>>();
  Napi::Buffer<char> valueBuffer = info[2].As<Napi::Buffer<char>>();
  
  unsigned int flags = 0;
  if (info.Length() > 3 && info[3].IsNumber()) {
    flags = info[3].ToNumber().Uint32Value();
  }

  MDBX_val key, data;
  key.iov_base = keyBuffer.Data();
  key.iov_len = keyBuffer.Length();
  data.iov_base = valueBuffer.Data();
  data.iov_len = valueBuffer.Length();

  int rc = mdbx_put(txn_, dbi->dbi_, &key, &data, static_cast<MDBX_put_flags_t>(flags));
  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return;
  }
}

Napi::Value MdbxTxn::Del(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 2 || !info[0].IsObject() || !info[1].IsBuffer()) {
    Napi::TypeError::New(env, "Expected database and key buffer").ThrowAsJavaScriptException();
    return Napi::Boolean::New(env, false);
  }

  if (!txn_) {
    Napi::Error::New(env, "Transaction already committed or aborted").ThrowAsJavaScriptException();
    return Napi::Boolean::New(env, false);
  }

  if (isReadOnly_) {
    Napi::Error::New(env, "Cannot delete in a read-only transaction").ThrowAsJavaScriptException();
    return Napi::Boolean::New(env, false);
  }

  MdbxDbi* dbi = Napi::ObjectWrap<MdbxDbi>::Unwrap(info[0].As<Napi::Object>());
  if (!dbi) {
    Napi::TypeError::New(env, "Invalid database object").ThrowAsJavaScriptException();
    return Napi::Boolean::New(env, false);
  }

  Napi::Buffer<char> keyBuffer = info[1].As<Napi::Buffer<char>>();
  
  MDBX_val key, data;
  key.iov_base = keyBuffer.Data();
  key.iov_len = keyBuffer.Length();

  // Check if value is provided (for DUPSORT databases)
  if (info.Length() > 2 && info[2].IsBuffer()) {
    Napi::Buffer<char> valueBuffer = info[2].As<Napi::Buffer<char>>();
    data.iov_base = valueBuffer.Data();
    data.iov_len = valueBuffer.Length();
    
    int rc = mdbx_del(txn_, dbi->dbi_, &key, &data);
    if (rc == MDBX_NOTFOUND) {
      return Napi::Boolean::New(env, false);
    } else if (rc != MDBX_SUCCESS) {
      Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
      return Napi::Boolean::New(env, false);
    }
  } else {
    int rc = mdbx_del(txn_, dbi->dbi_, &key, nullptr);
    if (rc == MDBX_NOTFOUND) {
      return Napi::Boolean::New(env, false);
    } else if (rc != MDBX_SUCCESS) {
      Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
      return Napi::Boolean::New(env, false);
    }
  }

  return Napi::Boolean::New(env, true);
}