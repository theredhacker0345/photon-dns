import { describe, expect, it } from "vitest";

import { getHomePhasePresentation } from "../lib/home-dashboard-presentation";

describe("Home dashboard phase presentation", () => {
  it("gives an unconfigured owner one concrete and safe setup action", () => {
    const presentation = getHomePhasePresentation("unconfigured");

    expect(presentation.nextStep).toBe("Configure the host");
    expect(presentation.nextDetail).toContain("private owner gateway");
    expect(presentation.nextIcon).toBe("lock-outline");
  });

  it("keeps the ready and paused states focused on local runtime preparation", () => {
    expect(getHomePhasePresentation("ready").nextStep).toBe("Start the supervisor");
    expect(getHomePhasePresentation("stopped").nextDetail).toContain("charging and storage");
  });

  it("keeps running-state guidance focused on monitoring and safety alerts", () => {
    const presentation = getHomePhasePresentation("running");

    expect(presentation.nextStep).toBe("Monitor this phone");
    expect(presentation.nextDetail).toContain("local alerts");
    expect(presentation.nextDetail).not.toMatch(/shell|terminal|filesystem/i);
  });

  it("makes the preview/native boundary explicit rather than inventing a live host", () => {
    const presentation = getHomePhasePresentation("bridge_required");

    expect(presentation.nextStep).toBe("Use the Android build");
    expect(presentation.nextDetail).toContain("APK");
  });
});
