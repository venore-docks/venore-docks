import { describe, expect, it } from "vitest";
import { validateManifest } from "./validate-manifest";

const validManifest = {
  manifestVersion: "1.0.0",
  key: "birthdays",
  name: "Birthdays",
  version: "1.0.0",
};

describe("validateManifest", () => {
  it("accepts a manifest with only the required fields", () => {
    const result = validateManifest(validManifest);
    expect(result.valid).toBe(true);
  });

  it("accepts a manifest with all optional fields filled", () => {
    const result = validateManifest({
      ...validManifest,
      description: "Birthday reminders",
      dependencies: [{ pluginKey: "notifications", type: "optional" }],
      compatibility: { coreVersion: ">=2.0.0 <3.0.0" },
      permissions: [{ key: "birthdays.entries.manage", label: "Manage birthdays" }],
      settings: [{ key: "birthdays.reminder_days", defaultValue: 7 }],
      navigation: [
        {
          key: "birthdays",
          label: "Birthdays",
          href: "/admin/birthdays",
          icon: "cake",
          groupKey: "content",
          groupLabel: "Conteúdo",
          groupOrder: 20,
          order: 50,
        },
      ],
      routes: [{ path: "/birthdays", label: "Birthdays" }],
      contentTypes: [{ key: "birthday", label: "Birthday" }],
      blocks: [{ key: "birthday-list", label: "Birthday list" }],
      seeds: [{ key: "example", label: "Dados de exemplo", description: "Alguns aniversariantes" }],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a seed entry without a label", () => {
    const result = validateManifest({ ...validManifest, seeds: [{ key: "example" }] });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("seeds"))).toBe(true);
    }
  });

  it("rejects a key that is not kebab-case", () => {
    const result = validateManifest({ ...validManifest, key: "Birthdays_Plugin" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.key).toBe("Birthdays_Plugin");
      expect(result.errors.some((e) => e.includes("key"))).toBe(true);
    }
  });

  it("rejects a version that is not a valid semver", () => {
    const result = validateManifest({ ...validManifest, version: "not-a-version" });
    expect(result.valid).toBe(false);
  });

  it("rejects a compatibility.coreVersion that is not a valid semver range", () => {
    const result = validateManifest({ ...validManifest, compatibility: { coreVersion: "not-a-range" } });
    expect(result.valid).toBe(false);
  });

  it("rejects a permission key outside the plugin's namespace", () => {
    const result = validateManifest({
      ...validManifest,
      permissions: [{ key: "cms.entries.manage", label: "Steal cms permission" }],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("namespace"))).toBe(true);
    }
  });

  it("reports the key even when the manifest is otherwise malformed", () => {
    const result = validateManifest({ key: "broken-plugin" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.key).toBe("broken-plugin");
    }
  });

  it("reports 'unknown' as the key when the manifest has no key at all", () => {
    const result = validateManifest({ notAManifest: true });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.key).toBe("unknown");
    }
  });

  describe("restrictedUploadCategories", () => {
    const base = {
      ...validManifest,
      key: "vagas",
      permissions: [{ key: "vagas.applications.review", label: "Ver currículos" }],
    };

    it("aceita categoria e permission do próprio plugin", () => {
      const result = validateManifest({
        ...base,
        restrictedUploadCategories: [{ key: "vagas.applications", accessPermission: "vagas.applications.review" }],
      });
      expect(result.valid).toBe(true);
    });

    it("recusa categoria fora do namespace do plugin", () => {
      const result = validateManifest({
        ...base,
        restrictedUploadCategories: [{ key: "avatars", accessPermission: "vagas.applications.review" }],
      });
      expect(result.valid).toBe(false);
    });

    it("recusa permission que o plugin não declara (ex: do core)", () => {
      const result = validateManifest({
        ...base,
        restrictedUploadCategories: [{ key: "vagas.applications", accessPermission: "media.manage" }],
      });
      expect(result.valid).toBe(false);
    });
  });
});
