{
  "targets": [
    {
      "target_name": "mdbxjs",
      "sources": [
        "src/mdbx.cc",
        "src/env.cc",
        "src/txn.cc",
        "src/dbi.cc",
        "src/cursor.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "deps/libmdbx"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        ["OS=='win'", {
          "libraries": ["deps/libmdbx/build/libmdbx.lib"]
        }],
        ["OS=='linux'", {
          "libraries": ["../deps/libmdbx/build/libmdbx.so"],
          "ldflags": ["-Wl,-rpath=\\$$ORIGIN/../../deps/libmdbx/build"]
        }],
        ["OS=='mac'", {
          "libraries": ["../deps/libmdbx/build/libmdbx.dylib"],
          "xcode_settings": {
            "OTHER_LDFLAGS": ["-Wl,-rpath,@loader_path/../../deps/libmdbx/build"]
          }
        }]
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES"
      }
    }
  ]
}