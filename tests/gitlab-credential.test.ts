import { describe, expect, it } from "vitest";

describe("temporary GitLab publication credential", () => {
  it("authenticates against GitLab without exposing the token", async () => {
    const token = process.env.GITLAB_TOKEN;
    expect(token, "GITLAB_TOKEN must be supplied through protected project secrets").toBeTruthy();

    const response = await fetch("https://gitlab.com/api/v4/user", {
      headers: { "PRIVATE-TOKEN": token as string },
    });
    expect(response.status, await response.text()).toBe(200);
  }, 20_000);
});

export {};

// This test is intentionally removed after the one-time publication credential check.
// The token is never logged, committed, or included in the published repository.
