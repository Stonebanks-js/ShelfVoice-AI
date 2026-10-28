// Vitest runs outside Next's server bundle, where the real "server-only"
// package throws on import. Server modules are safe to load in tests.
export {};
