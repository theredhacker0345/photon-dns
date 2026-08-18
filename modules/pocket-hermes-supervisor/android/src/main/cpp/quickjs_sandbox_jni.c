#include <jni.h>
#include <stdatomic.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "quickjs.h"

typedef struct {
  int64_t deadline_ns;
  atomic_int timed_out;
} ExecutionDeadline;

static int64_t monotonic_now_ns(void) {
  struct timespec value;
  clock_gettime(CLOCK_MONOTONIC, &value);
  return ((int64_t)value.tv_sec * 1000000000LL) + value.tv_nsec;
}

static int interrupt_for_deadline(JSRuntime *runtime, void *opaque) {
  (void)runtime;
  ExecutionDeadline *deadline = opaque;
  if (monotonic_now_ns() < deadline->deadline_ns) return 0;
  atomic_store(&deadline->timed_out, 1);
  return 1;
}

/* No module can be loaded: QuickJS core has no host APIs, and imports fail closed. */
static JSModuleDef *reject_module_loader(JSContext *ctx, const char *module_name, void *opaque) {
  (void)opaque;
  JS_ThrowReferenceError(ctx, "modules are disabled in Pocket Agent Host code execution (%s)", module_name);
  return NULL;
}

static const char base64_alphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static char *base64_encode(const unsigned char *input, size_t input_length) {
  size_t output_length = ((input_length + 2) / 3) * 4;
  char *output = calloc(output_length + 1, 1);
  if (output == NULL) return NULL;

  size_t in = 0;
  size_t out = 0;
  while (in < input_length) {
    uint32_t value = ((uint32_t)input[in++]) << 16;
    int remaining = (int)(input_length - in);
    if (remaining >= 1) value |= ((uint32_t)input[in++]) << 8;
    if (remaining >= 2) value |= input[in++];

    output[out++] = base64_alphabet[(value >> 18) & 0x3f];
    output[out++] = base64_alphabet[(value >> 12) & 0x3f];
    output[out++] = remaining >= 1 ? base64_alphabet[(value >> 6) & 0x3f] : '=';
    output[out++] = remaining >= 2 ? base64_alphabet[value & 0x3f] : '=';
  }
  return output;
}

static jstring make_response(JNIEnv *env, const char *status, int truncated, int timed_out, const char *detail, size_t detail_length) {
  char *encoded = base64_encode((const unsigned char *)detail, detail_length);
  if (encoded == NULL) return (*env)->NewStringUTF(env, "error\t0\t0\tb3V0IG9mIG1lbW9yeQ==");

  size_t response_length = strlen(status) + strlen(encoded) + 16;
  char *response = calloc(response_length, 1);
  if (response == NULL) {
    free(encoded);
    return (*env)->NewStringUTF(env, "error\t0\t0\tb3V0IG9mIG1lbW9yeQ==");
  }
  snprintf(response, response_length, "%s\t%d\t%d\t%s", status, truncated, timed_out, encoded);
  jstring value = (*env)->NewStringUTF(env, response);
  free(encoded);
  free(response);
  return value;
}

static jstring exception_response(JNIEnv *env, JSContext *ctx, int timed_out, int max_output_bytes) {
  JSValue exception = JS_GetException(ctx);
  const char *message = JS_ToCString(ctx, exception);
  const char *fallback = timed_out ? "execution timed out" : "JavaScript execution failed";
  size_t length = message == NULL ? strlen(fallback) : strlen(message);
  int truncated = 0;
  if (length > (size_t)max_output_bytes) {
    length = (size_t)max_output_bytes;
    truncated = 1;
  }
  jstring response = make_response(env, timed_out ? "timeout" : "error", truncated, timed_out, message == NULL ? fallback : message, length);
  if (message != NULL) JS_FreeCString(ctx, message);
  JS_FreeValue(ctx, exception);
  return response;
}

JNIEXPORT jstring JNICALL
Java_expo_modules_pockethermessupervisor_QuickJsSandbox_nativeExecute(
    JNIEnv *env,
    jobject self,
    jstring source,
    jint requested_memory_bytes,
    jint requested_timeout_ms,
    jint requested_max_output_bytes) {
  (void)self;
  if (source == NULL) return (*env)->NewStringUTF(env, "error\t0\t0\tc291cmNlIGlzIHJlcXVpcmVk");

  const char *input = (*env)->GetStringUTFChars(env, source, NULL);
  if (input == NULL) return (*env)->NewStringUTF(env, "error\t0\t0\tb3V0IG9mIG1lbW9yeQ==");
  size_t input_length = strlen(input);
  if (input_length > 24576) {
    (*env)->ReleaseStringUTFChars(env, source, input);
    return (*env)->NewStringUTF(env, "error\t0\t0\tc291cmNlIGV4Y2VlZHMgdGhlIDI0IEtpQiBwb2xpY3kgbGltaXQ=");
  }

  size_t memory_limit = (size_t)requested_memory_bytes;
  if (memory_limit < 4 * 1024 * 1024) memory_limit = 4 * 1024 * 1024;
  if (memory_limit > 64 * 1024 * 1024) memory_limit = 64 * 1024 * 1024;
  int timeout_ms = requested_timeout_ms;
  if (timeout_ms < 50) timeout_ms = 50;
  if (timeout_ms > 5000) timeout_ms = 5000;
  int max_output_bytes = requested_max_output_bytes;
  if (max_output_bytes < 256) max_output_bytes = 256;
  if (max_output_bytes > 32768) max_output_bytes = 32768;

  ExecutionDeadline deadline = {
      .deadline_ns = monotonic_now_ns() + ((int64_t)timeout_ms * 1000000LL),
      .timed_out = ATOMIC_VAR_INIT(0),
  };
  JSRuntime *runtime = JS_NewRuntime();
  if (runtime == NULL) {
    (*env)->ReleaseStringUTFChars(env, source, input);
    return (*env)->NewStringUTF(env, "error\t0\t0\tdW5hYmxlIHRvIGNyZWF0ZSBKYXZhU2NyaXB0IHJ1bnRpbWU=");
  }
  JS_SetMemoryLimit(runtime, memory_limit);
  JS_SetMaxStackSize(runtime, 512 * 1024);
  JS_SetCanBlock(runtime, 0);
  JS_SetInterruptHandler(runtime, interrupt_for_deadline, &deadline);
  JS_SetModuleLoaderFunc(runtime, NULL, reject_module_loader, NULL);

  JSContext *context = JS_NewContext(runtime);
  if (context == NULL) {
    JS_FreeRuntime(runtime);
    (*env)->ReleaseStringUTFChars(env, source, input);
    return (*env)->NewStringUTF(env, "error\t0\t0\tdW5hYmxlIHRvIGNyZWF0ZSBKYXZhU2NyaXB0IGNvbnRleHQ=");
  }

  JSValue value = JS_Eval(context, input, input_length, "<owner-approved>", JS_EVAL_TYPE_GLOBAL);
  (*env)->ReleaseStringUTFChars(env, source, input);
  if (JS_IsException(value)) {
    jstring response = exception_response(env, context, atomic_load(&deadline.timed_out), max_output_bytes);
    JS_FreeContext(context);
    JS_FreeRuntime(runtime);
    return response;
  }

  size_t output_length = 0;
  const char *output = JS_ToCStringLen2(context, &output_length, value, 0);
  if (output == NULL) {
    JS_FreeValue(context, value);
    jstring response = exception_response(env, context, atomic_load(&deadline.timed_out), max_output_bytes);
    JS_FreeContext(context);
    JS_FreeRuntime(runtime);
    return response;
  }
  int truncated = 0;
  if (output_length > (size_t)max_output_bytes) {
    output_length = (size_t)max_output_bytes;
    truncated = 1;
  }
  jstring response = make_response(env, "ok", truncated, 0, output, output_length);
  JS_FreeCString(context, output);
  JS_FreeValue(context, value);
  JS_FreeContext(context);
  JS_FreeRuntime(runtime);
  return response;
}
