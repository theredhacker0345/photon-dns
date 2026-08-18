cmake_minimum_required(VERSION 3.22.1)
project(pocket_agent_sandbox C)

add_library(pocket_agent_sandbox SHARED
  quickjs_sandbox_jni.c
  quickjs/quickjs.c
  quickjs/cutils.c
  quickjs/dtoa.c
  quickjs/libregexp.c
  quickjs/libunicode.c
)

target_include_directories(pocket_agent_sandbox PRIVATE quickjs)
target_compile_definitions(pocket_agent_sandbox PRIVATE
  _GNU_SOURCE
  CONFIG_VERSION="2026-06-04"
)
target_compile_options(pocket_agent_sandbox PRIVATE
  -std=gnu11
  -fvisibility=hidden
  -fstack-protector-strong
  -D_FORTIFY_SOURCE=2
  -Werror=format-security
  -Wno-sign-compare
  -Wno-unused-parameter
)

find_library(log-lib log)
target_link_libraries(pocket_agent_sandbox ${log-lib})
