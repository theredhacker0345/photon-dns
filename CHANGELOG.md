# Changelog

All notable user-facing changes to Pocket Relay are documented here. This project follows a human-readable changelog format and publishes release notes with F-Droid metadata when a release is prepared.

## Unreleased

Pocket Relay now includes an owner-reviewed Skills workspace with first-party sample skills, GitHub imports, portable exports, and Android share support. The control plane also received a refined mobile interface with layered theme surfaces, clearer host status, larger actions, and improved accessibility semantics.

## 1.0.2

This release adds an owner-triggered local notification test, with clear master-preference and Android-permission feedback. Backup reminders and host-safety alerts now use Pocket Relay's Android-native local notification bridge rather than a Firebase-backed notification package. The release materials also correct the public GPL-3.0-only listing, verify the public GitLab source metadata, minimize the explicit Android permission surface, and record the remaining F-Droid build-server prerequisite for the pinned Hermes Agent source.

## Initial Android release

The initial release introduced an embedded, supervised Hermes Agent runtime, private owner-only Telegram control, protected provider credentials, native host telemetry, owner-configurable resource guardrails, constrained remote MCP support, and an isolated QuickJS data-transformation sandbox.

## Security note

Release notes intentionally exclude credentials, private Telegram identifiers, execution output, and device-specific diagnostic data.
