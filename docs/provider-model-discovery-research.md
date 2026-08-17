# Provider model-discovery research

Research captured 2026-08-17 for the provider-aware model catalog.

| Provider | Official endpoint | Authentication | Response details |
|---|---|---|---|
| OpenAI | `GET https://api.openai.com/v1/models` | `Authorization: Bearer <API key>` | `{ object: "list", data: [{ id, created, object, owned_by, shutdown_date }] }` |
| Anthropic | `GET https://api.anthropic.com/v1/models` | `x-api-key: <API key>` and `anthropic-version: 2023-06-01` | Paginated `{ data: [{ id, display_name, created_at, capabilities, max_input_tokens, max_tokens, type }], has_more, first_id, last_id }`; the API supports `limit`, `after_id`, and `before_id`. |
| Google Gemini | `GET https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=<API key>` | API key query parameter in the official REST example | Paginated `{ models: [{ name, baseModelId, version, displayName, description, inputTokenLimit, outputTokenLimit, supportedGenerationMethods, thinking, ... }], nextPageToken }`. |

Sources:

- OpenAI List Models: https://developers.openai.com/api/reference/resources/models/methods/list/
- Anthropic List Models: https://platform.claude.com/docs/en/api/models/list
- Google Gemini Models API: https://ai.google.dev/api/models

Implementation boundary: provider tokens remain in protected storage and are used only for direct HTTPS model-list calls from the Android runtime. The UI should never log or include tokens in model records, telemetry, task history, screenshots, or diagnostics. Model catalogs should be normalized to `{ id, displayName, provider, capabilities?, contextWindow?, fetchedAt }`, capped to a safe record count, and refreshed only on explicit user action or a bounded Settings-screen refresh—not by a high-frequency background poll.


Additional provider candidates reviewed:

- OpenRouter model catalog: https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties
- Groq API reference and model guide: https://console.groq.com/docs/api-reference and https://console.groq.com/docs/models
- Mistral documentation portal: https://docs.mistral.ai/

The implementation should make the provider adapter explicit rather than guessing that every provider is identical. For the first release, OpenAI-compatible presets can share a `/models` normalizer while custom endpoints remain supported. Providers with different authentication or response shapes should get their own adapter before being advertised as supported.
