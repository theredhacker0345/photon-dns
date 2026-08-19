import type { Automation, SavedProviderConnection } from "@/lib/pocket-hermes-store";
import type { HostRuntimePolicy, PublicTelegramProxyConfiguration } from "@/lib/host-contracts";
import type { McpToolApproval, McpToolManifestItem, RemoteMcpServer } from "@/lib/mcp-contracts";
import type { InstalledSkill, SkillPackage } from "@/lib/skill-contracts";

export const POCKET_RELAY_BACKUP_FORMAT = "pocket-relay-backup" as const;
export const POCKET_RELAY_BACKUP_VERSION = 1 as const;
export const BACKUP_FILE_EXTENSION = ".prbackup.neuron";

export type BackupPublicConfig = {
  hostName: string;
  allowedChatId: string;
  modelProvider: string;
  modelEndpoint: string;
  modelName: string;
  telegramProxy: PublicTelegramProxyConfiguration;
  policy: HostRuntimePolicy;
};

export type PocketRelayBackupPayload = {
  format: typeof POCKET_RELAY_BACKUP_FORMAT;
  version: typeof POCKET_RELAY_BACKUP_VERSION;
  createdAt: string;
  appVersion: string;
  config: BackupPublicConfig;
  automations: Automation[];
  favoriteModelIds: string[];
  mcpServers: RemoteMcpServer[];
  mcpTools: McpToolManifestItem[];
  mcpApprovals: McpToolApproval[];
  providerConnections: SavedProviderConnection[];
  activeProviderConnectionId: string | null;
  installedSkills: InstalledSkill[];
  skillBundles: Array<{ id: string; skillPackage: SkillPackage }>;
};

export const BACKUP_EXCLUSIONS = [
  "Telegram bot token",
  "Provider API keys",
  "Saved provider credentials",
  "MCP bearer credentials",
  "Telegram proxy credentials",
  "Conversation ledger and task history",
  "Runtime logs, telemetry, and audit records",
] as const;

type BackupSource = Omit<PocketRelayBackupPayload, "format" | "version" | "createdAt" | "appVersion"> & {
  config: BackupPublicConfig & { hasTelegramToken?: boolean; hasModelApiKey?: boolean };
  providerConnections: Array<SavedProviderConnection & { hasApiKey?: boolean }>;
};

export function createBackupPayload(source: BackupSource, appVersion: string): PocketRelayBackupPayload {
  return {
    format: POCKET_RELAY_BACKUP_FORMAT,
    version: POCKET_RELAY_BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    appVersion,
    config: {
      hostName: source.config.hostName,
      allowedChatId: source.config.allowedChatId,
      modelProvider: source.config.modelProvider,
      modelEndpoint: source.config.modelEndpoint,
      modelName: source.config.modelName,
      telegramProxy: {
        type: source.config.telegramProxy.type,
        host: source.config.telegramProxy.host,
        port: source.config.telegramProxy.port,
        hasCredentials: false,
      },
      policy: source.config.policy,
    },
    automations: source.automations,
    favoriteModelIds: source.favoriteModelIds,
    mcpServers: source.mcpServers.map(({ id, name, endpoint, authMode, enabled, connectionState, lastCheckedAt, latencyMs, toolCount }) => ({
      id, name, endpoint, authMode, enabled, connectionState, lastCheckedAt, latencyMs, toolCount, hasCredential: false,
    })),
    mcpTools: source.mcpTools,
    mcpApprovals: source.mcpApprovals,
    providerConnections: source.providerConnections.map(({ id, label, provider, endpoint, createdAt }) => ({ id, label, provider, endpoint, hasApiKey: false, createdAt })),
    activeProviderConnectionId: source.activeProviderConnectionId,
    installedSkills: source.installedSkills,
    skillBundles: source.skillBundles,
  };
}

export function parseBackupPayload(value: unknown): { ok: true; value: PocketRelayBackupPayload } | { ok: false; message: string } {
  if (!value || typeof value !== "object") return { ok: false, message: "The decrypted file does not contain a Pocket Relay backup." };
  const payload = value as Partial<PocketRelayBackupPayload>;
  if (payload.format !== POCKET_RELAY_BACKUP_FORMAT || payload.version !== POCKET_RELAY_BACKUP_VERSION) {
    return { ok: false, message: "This encrypted file is not a supported Pocket Relay backup." };
  }
  if (!payload.config || typeof payload.config !== "object" || !Array.isArray(payload.automations) || !Array.isArray(payload.favoriteModelIds) || !Array.isArray(payload.mcpServers) || !Array.isArray(payload.installedSkills) || !Array.isArray(payload.skillBundles)) {
    return { ok: false, message: "The backup payload is incomplete or malformed." };
  }
  return { ok: true, value: payload as PocketRelayBackupPayload };
}
