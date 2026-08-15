export type HostReadinessInput = {
  hasTelegramToken: boolean;
  allowedChatId: string;
};

export function isValidTelegramChatId(value: string): boolean {
  return /^-?\d+$/.test(value.trim());
}

export function normalizeHostName(value: string): string {
  const normalized = value.trim();
  return normalized || "Pocket Hermes";
}

export function canPreparePrivateHost(input: HostReadinessInput): boolean {
  return input.hasTelegramToken && isValidTelegramChatId(input.allowedChatId);
}

export function validationMessage(input: HostReadinessInput): string | null {
  if (!isValidTelegramChatId(input.allowedChatId)) return "Use a numeric Telegram chat ID. It may begin with a minus sign for a group.";
  if (!input.hasTelegramToken) return "Add a Telegram bot token before preparing the private gateway.";
  return null;
}
