// Re-export the native module. On web, it will be resolved to PocketHermesSupervisorModule.web.ts
// and on native platforms to PocketHermesSupervisorModule.ts
export { default } from './src/PocketHermesSupervisorModule';
export * from './src/PocketHermesSupervisor.types';
