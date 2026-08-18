import { describe, expect, it } from "vitest";

describe("protected Appetize.io credential", () => {
  it("authenticates against the read-only Appetize.io app list without exposing the token", async () => {
    const token = process.env.APPETIZE_TOKEN;
    expect(token, "APPETIZE_TOKEN must be supplied through protected project secrets").toBeTruthy();

    const response = await fetch("https://api.appetize.io/v1/apps?limit=1", {
      headers: { "X-API-KEY": token as string },
    });

    expect(response.status, await response.text()).toBeLessThan(400);
  }, 20_000);
});
