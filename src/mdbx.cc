#include <napi.h>
#include "env.h"
#include "txn.h"
#include "dbi.h"
#include "cursor.h"

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  // Initialize all classes
  MdbxEnv::Init(env, exports);
  MdbxTxn::Init(env, exports);
  MdbxDbi::Init(env, exports);
  MdbxCursor::Init(env, exports);

  // Define enum values
  Napi::Object envFlags = Napi::Object::New(env);
  envFlags.Set("NOSUBDIR", Napi::Number::New(env, MDBX_NOSUBDIR));
  envFlags.Set("NOSYNC", Napi::Number::New(env, MDBX_UTTERLY_NOSYNC));
  envFlags.Set("RDONLY", Napi::Number::New(env, MDBX_RDONLY));
  envFlags.Set("NOMETASYNC", Napi::Number::New(env, MDBX_NOMETASYNC));
  envFlags.Set("WRITEMAP", Napi::Number::New(env, MDBX_WRITEMAP));
  envFlags.Set("MAPASYNC", Napi::Number::New(env, MDBX_MAPASYNC));
  envFlags.Set("NOTLS", Napi::Number::New(env, MDBX_NOTLS));
  envFlags.Set("NORDAHEAD", Napi::Number::New(env, MDBX_NORDAHEAD));
  envFlags.Set("NOMEMINIT", Napi::Number::New(env, MDBX_NOMEMINIT));
  envFlags.Set("COALESCE", Napi::Number::New(env, MDBX_COALESCE));
  envFlags.Set("LIFORECLAIM", Napi::Number::New(env, MDBX_LIFORECLAIM));
  exports.Set("EnvFlags", envFlags);

  Napi::Object dbFlags = Napi::Object::New(env);
  dbFlags.Set("REVERSEKEY", Napi::Number::New(env, MDBX_REVERSEKEY));
  dbFlags.Set("DUPSORT", Napi::Number::New(env, MDBX_DUPSORT));
  dbFlags.Set("INTEGERKEY", Napi::Number::New(env, MDBX_INTEGERKEY));
  dbFlags.Set("DUPFIXED", Napi::Number::New(env, MDBX_DUPFIXED));
  dbFlags.Set("INTEGERDUP", Napi::Number::New(env, MDBX_INTEGERDUP));
  dbFlags.Set("REVERSEDUP", Napi::Number::New(env, MDBX_REVERSEDUP));
  dbFlags.Set("CREATE", Napi::Number::New(env, MDBX_CREATE));
  exports.Set("DatabaseFlags", dbFlags);

  Napi::Object writeFlags = Napi::Object::New(env);
  writeFlags.Set("NOOVERWRITE", Napi::Number::New(env, MDBX_NOOVERWRITE));
  writeFlags.Set("NODUPDATA", Napi::Number::New(env, MDBX_NODUPDATA));
  writeFlags.Set("CURRENT", Napi::Number::New(env, MDBX_CURRENT));
  writeFlags.Set("RESERVE", Napi::Number::New(env, MDBX_RESERVE));
  writeFlags.Set("APPEND", Napi::Number::New(env, MDBX_APPEND));
  writeFlags.Set("APPENDDUP", Napi::Number::New(env, MDBX_APPENDDUP));
  writeFlags.Set("MULTIPLE", Napi::Number::New(env, MDBX_MULTIPLE));
  exports.Set("WriteFlags", writeFlags);

  Napi::Object txnMode = Napi::Object::New(env);
  txnMode.Set("READONLY", Napi::Number::New(env, 0));
  txnMode.Set("READWRITE", Napi::Number::New(env, 1));
  exports.Set("TransactionMode", txnMode);

  Napi::Object seekOp = Napi::Object::New(env);
  seekOp.Set("FIRST", Napi::Number::New(env, MDBX_FIRST));
  seekOp.Set("FIRST_DUP", Napi::Number::New(env, MDBX_FIRST_DUP));
  seekOp.Set("GET_BOTH", Napi::Number::New(env, MDBX_GET_BOTH));
  seekOp.Set("GET_BOTH_RANGE", Napi::Number::New(env, MDBX_GET_BOTH_RANGE));
  seekOp.Set("GET_CURRENT", Napi::Number::New(env, MDBX_GET_CURRENT));
  seekOp.Set("GET_MULTIPLE", Napi::Number::New(env, MDBX_GET_MULTIPLE));
  seekOp.Set("LAST", Napi::Number::New(env, MDBX_LAST));
  seekOp.Set("LAST_DUP", Napi::Number::New(env, MDBX_LAST_DUP));
  seekOp.Set("NEXT", Napi::Number::New(env, MDBX_NEXT));
  seekOp.Set("NEXT_DUP", Napi::Number::New(env, MDBX_NEXT_DUP));
  seekOp.Set("NEXT_MULTIPLE", Napi::Number::New(env, MDBX_NEXT_MULTIPLE));
  seekOp.Set("NEXT_NODUP", Napi::Number::New(env, MDBX_NEXT_NODUP));
  seekOp.Set("PREV", Napi::Number::New(env, MDBX_PREV));
  seekOp.Set("PREV_DUP", Napi::Number::New(env, MDBX_PREV_DUP));
  seekOp.Set("PREV_NODUP", Napi::Number::New(env, MDBX_PREV_NODUP));
  seekOp.Set("SET", Napi::Number::New(env, MDBX_SET));
  seekOp.Set("SET_KEY", Napi::Number::New(env, MDBX_SET_KEY));
  seekOp.Set("SET_RANGE", Napi::Number::New(env, MDBX_SET_RANGE));
  exports.Set("SeekOperation", seekOp);

  return exports;
}

NODE_API_MODULE(mdbx, InitAll)