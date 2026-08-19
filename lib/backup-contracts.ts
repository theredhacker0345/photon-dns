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

export type BackupRestoreSummaryStatus = "changed" | "unchanged" | "excluded";
export type BackupRestoreSummaryItem = {
  id: "configuration" | "automations" | "favorites" | "providers" | "mcpServers" | "mcpTools" | "mcpApprovals" | "skills";
  title: string;
  status: BackupRestoreSummaryStatus;
  current: string;
  incoming: string;
  detail: string;
};
export type BackupRestoreSummary = {
  backupCreatedAt: string;
  backupAppVersion: string;
  items: BackupRestoreSummaryItem[];
  exclusions: readonly string[];
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

export type BackupRestoreComparisonSource = Pick<BackupSource, "config" | "automations" | "favoriteModelIds" | "mcpServers" | "mcpTools" | "mcpApprovals" | "providerConnections" | "activeProviderConnectionId" | "installedSkills">;

function countLabel(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function publicConfigSignature(config: BackupPublicConfig) {
  return {
    hostName: config.hostName,
    allowedChatId: config.allowedChatId,
    modelProvider: config.modelProvider,
    modelEndpoint: config.modelEndpoint,
    modelName: config.modelName,
    telegramProxy: { type: config.telegramProxy.type, host: config.telegramProxy.host, port: config.telegramProxy.port },
    policy: config.policy,
  };
}

function providerMetadata(connections: SavedProviderConnection[]) {
  return connections.map(({ label, provider, endpoint }) => ({ label, provider, endpoint }));
}

function mcpServerMetadata(servers: RemoteMcpServer[]) {
  return servers.map(({ name, endpoint, authMode }) => ({ name, endpoint, authMode }));
}

function skillMetadata(skills: InstalledSkill[]) {
  return skills.map(({ id, manifest }) => ({ id, name: manifest.name, sourceSha256: manifest.sourceSha256 }));
}

function summaryItem(
  id: BackupRestoreSummaryItem["id"],
  title: string,
  current: string,
  incoming: string,
  isUnchanged: boolean,
  detail: string,
): BackupRestoreSummaryItem {
  return { id, title, status: isUnchanged ? "unchanged" : "changed", current, incoming, detail };
}

/**
 * Produces a display-only comparison of safe restore data. It intentionally does
 * not inspect SecureStore, passwords, tokens, conversation content, telemetry,
 * audit records, or the encrypted source file.
 */
export function summarizeBackupRestore(current: BackupRestoreComparisonSource, incoming: PocketRelayBackupPayload): BackupRestoreSummary {
  const incomingConfig = publicConfigSignature(incoming.config);
  const currentConfig = publicConfigSignature(current.config);
  const items: BackupRestoreSummaryItem[] = [
    summaryItem(
      "configuration",
      "Host configuration",
      `Host ${current.config.hostName} · ${current.config.modelProvider}/${current.config.modelName || "no model"}`,
      `Host ${incoming.config.hostName} · ${incoming.config.modelProvider}/${incoming.config.modelName || "no model"}`,
      sameValue(currentConfig, incomingConfig),
      "Host name, owner chat ID, model settings, proxy route, and resource policy are compared without any credentials.",
    ),
    summaryItem("automations", "Automations", countLabel(current.automations.length, "automation"), countLabel(incoming.automations.length, "automation"), sameValue(current.automations, incoming.automations), "The backup replaces the current automation list."),
    summaryItem("favorites", "Model favourites", countLabel(current.favoriteModelIds.length, "favourite"), countLabel(incoming.favoriteModelIds.length, "favourite"), sameValue(current.favoriteModelIds, incoming.favoriteModelIds), "The backup replaces the saved model favourites."),
    summaryItem("providers", "Provider metadata", countLabel(current.providerConnections.length, "saved provider"), countLabel(incoming.providerConnections.length, "saved provider"), sameValue(providerMetadata(current.providerConnections), providerMetadata(incoming.providerConnections)), "Labels, provider types, and endpoints are restored; API keys are never restored."),
    summaryItem("mcpServers", "Remote MCP servers", countLabel(current.mcpServers.length, "remote server"), countLabel(incoming.mcpServers.length, "remote server"), sameValue(mcpServerMetadata(current.mcpServers), mcpServerMetadata(incoming.mcpServers)), "Remote server metadata is restored disabled and unverified."),
    summaryItem("mcpTools", "MCP tool manifests", countLabel(current.mcpTools.length, "tool manifest"), countLabel(incoming.mcpTools.length, "tool manifest"), sameValue(current.mcpTools, incoming.mcpTools), "Tool descriptions are restored, but no tool is approved to run."),
    { id: "mcpApprovals", title: "MCP approvals", status: "excluded", current: countLabel(current.mcpApprovals.length, "active approval"), incoming: "No approvals restored", detail: "Time-limited owner approvals are deliberately cleared during every restore." },
    summaryItem("skills", "Reviewed skills", countLabel(current.installedSkills.length, "installed skill"), countLabel(incoming.installedSkills.length, "installed skill"), sameValue(skillMetadata(current.installedSkills), skillMetadata(incoming.installedSkills)), "Source-verified skill packages are restored disabled and must be explicitly re-enabled."),
  ];
  return { backupCreatedAt: incoming.createdAt, backupAppVersion: incoming.appVersion, items, exclusions: BACKUP_EXCLUSIONS };
}

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
