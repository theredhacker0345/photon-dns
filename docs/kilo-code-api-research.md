# Kilo Code API Research & Integration Analysis

## Overview
Kilo Code (via the Kilo AI Gateway at `https://api.kilo.ai`) provides a unified, OpenAI-compatible API gateway giving access to hundreds of AI models through standard chat completion endpoints and model lists [1].

## API Endpoints & Authentication
- **Base URL**: `https://api.kilo.ai/api/gateway`
- **Chat Completions**: `POST https://api.kilo.ai/api/gateway/chat/completions`
- **Models Endpoint**: `GET https://api.kilo.ai/api/gateway/models`
- **Authentication**: Bearer token (`Authorization: Bearer <KILO_API_KEY>`)
- **Headers**: Supports standard OpenAI compatibility headers plus optional gateway headers like `x-kilocode-mode`.

## Compatibility with Pocket Relay
Pocket Relay features an extensible provider catalog supporting OpenAI, OpenRouter, Groq, Mistral AI, and Custom endpoints. Integrating Kilo Code as a 6th built-in provider preset is fully compatible because:
1. It uses standard Bearer token authentication stored securely via the Android Keystore / protected local store.
2. Its model list endpoint (`https://api.kilo.ai/api/gateway/models`) returns a standard OpenAI-compatible list of models (including popular frontier models, free tiers, and auto-routing models like `kilo-auto/frontier` and `kilo-auto/efficient`).
3. Its chat completion endpoint follows the OpenAI chat completions schema (`/chat/completions`), allowing the Hermes agent runtime and preflight checks to validate and interact with it seamlessly.

## References
[1] Kilo AI Gateway Documentation: https://kilo.ai/docs/gateway/models-and-providers
