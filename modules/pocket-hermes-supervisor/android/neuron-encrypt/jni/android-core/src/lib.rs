//! GPL-3.0-only Android cryptographic core derived from Neuron Encrypt 2.1.2.
//!
//! The source modules preserve the upstream encryption format and are isolated
//! from the upstream desktop UI and CLI dependency graph for reproducible
//! Android JNI builds.

pub mod crypto;
pub mod error;
pub mod utils;
