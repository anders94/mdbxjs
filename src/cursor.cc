#include "cursor.h"

Napi::FunctionReference MdbxCursor::constructor;

Napi::Object MdbxCursor::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "Cursor", {
    InstanceMethod("close", &MdbxCursor::Close),
    InstanceMethod("del", &MdbxCursor::Del),
    InstanceMethod("get", &MdbxCursor::Get),
    InstanceMethod("put", &MdbxCursor::Put),
    InstanceMethod("count", &MdbxCursor::Count)
  });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("Cursor", func);
  return exports;
}

MdbxCursor::MdbxCursor(const Napi::CallbackInfo& info) 
  : Napi::ObjectWrap<MdbxCursor>(info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 2 || !info[0].IsObject() || !info[1].IsObject()) {
    Napi::TypeError::New(env, "Expected transaction and database objects").ThrowAsJavaScriptException();
    return;
  }

  txn_ = Napi::ObjectWrap<MdbxTxn>::Unwrap(info[0].As<Napi::Object>());
  if (!txn_ || !txn_->txn_) {
    Napi::Error::New(env, "Transaction is not active").ThrowAsJavaScriptException();
    return;
  }

  dbi_ = Napi::ObjectWrap<MdbxDbi>::Unwrap(info[1].As<Napi::Object>());
  if (!dbi_ || !dbi_->isOpen_) {
    Napi::Error::New(env, "Database is not open").ThrowAsJavaScriptException();
    return;
  }

  int rc = mdbx_cursor_open(txn_->txn_, dbi_->dbi_, &cursor_);
  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return;
  }
}

MdbxCursor::~MdbxCursor() {
  if (cursor_) {
    mdbx_cursor_close(cursor_);
    cursor_ = nullptr;
  }
}

void MdbxCursor::Close(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (cursor_) {
    mdbx_cursor_close(cursor_);
    cursor_ = nullptr;
  }
}

void MdbxCursor::Del(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (!cursor_) {
    Napi::Error::New(env, "Cursor is closed").ThrowAsJavaScriptException();
    return;
  }

  unsigned int flags = 0;
  if (info.Length() > 0 && info[0].IsNumber()) {
    flags = info[0].ToNumber().Uint32Value();
  }

  int rc = mdbx_cursor_del(cursor_, static_cast<MDBX_put_flags_t>(flags));
  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return;
  }
}

Napi::Value MdbxCursor::Get(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (!cursor_) {
    Napi::Error::New(env, "Cursor is closed").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (info.Length() < 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "Expected operation code").ThrowAsJavaScriptException();
    return env.Null();
  }

  MDBX_cursor_op op = static_cast<MDBX_cursor_op>(info[0].ToNumber().Int32Value());
  
  MDBX_val key, data;
  
  // Initialize key if provided
  if (info.Length() > 1 && info[1].IsBuffer()) {
    Napi::Buffer<char> keyBuffer = info[1].As<Napi::Buffer<char>>();
    key.iov_base = keyBuffer.Data();
    key.iov_len = keyBuffer.Length();
  } else {
    key.iov_base = nullptr;
    key.iov_len = 0;
  }
  
  // Initialize value if provided
  if (info.Length() > 2 && info[2].IsBuffer()) {
    Napi::Buffer<char> valueBuffer = info[2].As<Napi::Buffer<char>>();
    data.iov_base = valueBuffer.Data();
    data.iov_len = valueBuffer.Length();
  } else {
    data.iov_base = nullptr;
    data.iov_len = 0;
  }

  int rc = mdbx_cursor_get(cursor_, &key, &data, op);
  if (rc == MDBX_NOTFOUND) {
    return env.Null();
  } else if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Object result = Napi::Object::New(env);
  
  result.Set("key", Napi::Buffer<char>::Copy(env, 
                                           static_cast<char*>(key.iov_base),
                                           key.iov_len));
  
  result.Set("value", Napi::Buffer<char>::Copy(env, 
                                             static_cast<char*>(data.iov_base),
                                             data.iov_len));

  return result;
}

void MdbxCursor::Put(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (!cursor_) {
    Napi::Error::New(env, "Cursor is closed").ThrowAsJavaScriptException();
    return;
  }

  if (info.Length() < 2 || !info[0].IsBuffer() || !info[1].IsBuffer()) {
    Napi::TypeError::New(env, "Expected key buffer and value buffer").ThrowAsJavaScriptException();
    return;
  }

  Napi::Buffer<char> keyBuffer = info[0].As<Napi::Buffer<char>>();
  Napi::Buffer<char> valueBuffer = info[1].As<Napi::Buffer<char>>();
  
  unsigned int flags = 0;
  if (info.Length() > 2 && info[2].IsNumber()) {
    flags = info[2].ToNumber().Uint32Value();
  }

  MDBX_val key, data;
  key.iov_base = keyBuffer.Data();
  key.iov_len = keyBuffer.Length();
  data.iov_base = valueBuffer.Data();
  data.iov_len = valueBuffer.Length();

  int rc = mdbx_cursor_put(cursor_, &key, &data, static_cast<MDBX_put_flags_t>(flags));
  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return;
  }
}

Napi::Value MdbxCursor::Count(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (!cursor_) {
    Napi::Error::New(env, "Cursor is closed").ThrowAsJavaScriptException();
    return env.Null();
  }

  size_t count;
  int rc = mdbx_cursor_count(cursor_, &count);
  if (rc != MDBX_SUCCESS) {
    Napi::Error::New(env, mdbx_strerror(rc)).ThrowAsJavaScriptException();
    return env.Null();
  }

  return Napi::Number::New(env, static_cast<double>(count));
}