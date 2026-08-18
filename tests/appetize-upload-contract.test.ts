import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const uploader = readFileSync(resolve(projectRoot, "scripts/upload-to-appetize.mjs"), "utf8");

describe("Appetize.io signed-APK upload contract", () => {
  it("defaults to the signed release artifact and refuses known unsigned APK paths", () => {
    expect(uploader).toContain("path.join(releaseOutputDirectory, 'app-release.apk')");
    expect(uploader).toContain("path.basename(apkPath).includes('-unsigned')");
    expect(uploader).toContain("refusing to upload an unsigned APK");
    expect(uploader).not.toContain("path.join(releaseOutputDirectory, 'app-release-unsigned.apk')");
  });
});
