# Local-network provider compatibility research

Research date: 2026-08-18 GMT+5.

Ollama documents an OpenAI-compatible base URL at `http://localhost:11434/v1/`; its examples identify `ollama` as a required-but-ignored OpenAI-client API-key value. Ollama separately states that local API access requires no authentication. A phone must therefore target a **different LAN host address**, not `localhost`, when its model server runs on another machine.[1][2]

LM Studio documents OpenAI-compatible `GET /v1/models` and `POST /v1/chat/completions` endpoints, with its documented default server port `1234`. Its developer documentation explicitly allows serving on either localhost or the local network.[3][4]

Implementation consequence: the mobile app may offer explicit Ollama and LM Studio presets that accept only a literal, non-loopback private-LAN IPv4 host over `http`, retain HTTPS as the rule for all hosted/custom providers, disallow URLs with credentials, and never silently substitute `localhost`. Local-provider API keys are optional; blank credentials are represented only in protected-native launch handling and never displayed.

## References

[1]: https://docs.ollama.com/api/openai-compatibility "Ollama OpenAI compatibility"
[2]: https://docs.ollama.com/api/authentication "Ollama API authentication"
[3]: https://lmstudio.ai/docs/developer/openai-compat "LM Studio OpenAI compatibility endpoints"
[4]: https://lmstudio.ai/docs/developer/core/server "LM Studio local API server"
