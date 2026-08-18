import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import { type SkillManifest, type SkillPackage, isSafeSkillIdentifier, validateSkillPackage } from "@/lib/skill-contracts";

const ROOT = `${FileSystem.documentDirectory ?? ""}pocket-relay/skills/`;
const STAGED_ROOT = `${ROOT}staged/`;
const INSTALLED_ROOT = `${ROOT}installed/`;

function requireNativeStorage() {
  if (Platform.OS === "web" || !FileSystem.documentDirectory) throw new Error("Skill packages are stored only in the Android app-private filesystem.");
}

function requireIdentifier(value: string) {
  if (!isSafeSkillIdentifier(value)) throw new Error("Invalid skill package identifier.");
}

function packageDirectory(root: string, id: string) {
  requireIdentifier(id);
  return `${root}${id}/`;
}

async function ensureDirectory(uri: string) {
  await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
}

async function writePackage(directory: string, skillPackage: SkillPackage) {
  await FileSystem.deleteAsync(directory, { idempotent: true });
  await ensureDirectory(directory);
  await Promise.all([
    FileSystem.writeAsStringAsync(`${directory}skill.json`, JSON.stringify(skillPackage.manifest), { encoding: FileSystem.EncodingType.UTF8 }),
    FileSystem.writeAsStringAsync(`${directory}main.js`, skillPackage.source, { encoding: FileSystem.EncodingType.UTF8 }),
  ]);
}

async function readPackage(directory: string): Promise<SkillPackage> {
  const [manifestText, source] = await Promise.all([
    FileSystem.readAsStringAsync(`${directory}skill.json`, { encoding: FileSystem.EncodingType.UTF8 }),
    FileSystem.readAsStringAsync(`${directory}main.js`, { encoding: FileSystem.EncodingType.UTF8 }),
  ]);
  const validation = await validateSkillPackage({ manifest: JSON.parse(manifestText), source });
  if (!validation.ok) throw new Error(validation.message);
  return validation.value;
}

/** Stores untrusted imported or AI-created source only for owner review. It is never executed from staging. */
export async function stageSkillPackage(draftId: string, skillPackage: SkillPackage) {
  requireNativeStorage();
  await writePackage(packageDirectory(STAGED_ROOT, draftId), skillPackage);
}

export async function readStagedSkillPackage(draftId: string) {
  requireNativeStorage();
  return readPackage(packageDirectory(STAGED_ROOT, draftId));
}

export async function discardStagedSkillPackage(draftId: string) {
  requireNativeStorage();
  await FileSystem.deleteAsync(packageDirectory(STAGED_ROOT, draftId), { idempotent: true });
}

/** Copies the reviewed exact bytes into an installed-only directory, then deletes its staging copy. */
export async function installStagedSkillPackage(draftId: string, skillId: string) {
  requireNativeStorage();
  const skillPackage = await readStagedSkillPackage(draftId);
  await writePackage(packageDirectory(INSTALLED_ROOT, skillId), skillPackage);
  await discardStagedSkillPackage(draftId);
  return skillPackage;
}

export async function readInstalledSkillPackage(skillId: string) {
  requireNativeStorage();
  return readPackage(packageDirectory(INSTALLED_ROOT, skillId));
}

export async function readInstalledSkillSource(skillId: string) {
  const skillPackage = await readInstalledSkillPackage(skillId);
  return skillPackage.source;
}

export async function removeInstalledSkillPackage(skillId: string) {
  requireNativeStorage();
  await FileSystem.deleteAsync(packageDirectory(INSTALLED_ROOT, skillId), { idempotent: true });
}

export function skillManifestLabel(manifest: SkillManifest) {
  return `${manifest.name} v${manifest.version}`;
}
