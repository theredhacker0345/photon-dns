package expo.modules.pockethermessupervisor;

/** Bounded JSON-only IPC; the executor receives no file descriptors or Android capabilities. */
interface ICodeSandboxExecutor {
  String execute(String requestJson);
}
