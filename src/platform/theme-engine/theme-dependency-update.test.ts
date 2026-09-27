import { describe, expect, it } from "vitest";
import { isReleaseTag, planThemeDependencyUpdate } from "./theme-dependency-update";

const SHA = "a".repeat(40);

const packageJsonText = `${JSON.stringify(
  { name: "site", dependencies: { "@venore/theme-aurora": "github:venore-docks/venore-theme-aurora#v0.1.8", next: "16.3.6" } },
  null,
  2,
)}\n`;

const packageLockText = `${JSON.stringify(
  {
    name: "site",
    lockfileVersion: 3,
    packages: {
      "": { dependencies: { "@venore/theme-aurora": "github:venore-docks/venore-theme-aurora#v0.1.8" } },
      "node_modules/@venore/theme-aurora": {
        version: "0.1.8",
        resolved: `git+ssh://git@github.com/venore-docks/venore-theme-aurora.git#${"b".repeat(40)}`,
        peerDependencies: { react: ">=19" },
      },
    },
  },
  null,
  2,
)}\n`;

const base = {
  dependencyKey: "@venore/theme-aurora",
  targetTag: "v0.2.0",
  commitSha: SHA,
  themePackage: { version: "0.2.0", peerDependencies: { react: ">=19", next: ">=16" } },
  packageJsonText,
  packageLockText,
};

describe("isReleaseTag", () => {
  it("accepts semver tags and rejects anything else", () => {
    expect(isReleaseTag("v1.2.3")).toBe(true);
    expect(isReleaseTag("1.2.3-rc.1")).toBe(true);
    expect(isReleaseTag('v1.0.0", "evil": "github:attacker/evil#main')).toBe(false);
    expect(isReleaseTag("main")).toBe(false);
  });
});

describe("planThemeDependencyUpdate", () => {
  it("rewrites package.json and the lockfile consistently", () => {
    const plan = planThemeDependencyUpdate(base);
    expect(plan.success).toBe(true);
    if (!plan.success) return;

    const pkg = JSON.parse(plan.data.packageJson);
    const lock = JSON.parse(plan.data.packageLock);
    expect(pkg.dependencies["@venore/theme-aurora"]).toBe("github:venore-docks/venore-theme-aurora#v0.2.0");
    expect(pkg.dependencies.next).toBe("16.3.6");
    expect(lock.packages[""].dependencies["@venore/theme-aurora"]).toBe("github:venore-docks/venore-theme-aurora#v0.2.0");
    expect(lock.packages["node_modules/@venore/theme-aurora"]).toEqual({
      version: "0.2.0",
      resolved: `git+ssh://git@github.com/venore-docks/venore-theme-aurora.git#${SHA}`,
      peerDependencies: { react: ">=19", next: ">=16" },
    });
    expect(plan.data.packageJson.endsWith("}\n")).toBe(true);
  });

  it("refuses an injected tag instead of writing it into package.json", () => {
    const plan = planThemeDependencyUpdate({ ...base, targetTag: 'v1.0.0", "evil": "x' });
    expect(plan).toEqual({ success: false, error: { code: "theme-engine.update.invalid_tag", message: expect.any(String) } });
  });

  it("refuses a theme version that brings its own dependencies (the lockfile would be incomplete)", () => {
    const plan = planThemeDependencyUpdate({ ...base, themePackage: { version: "0.2.0", dependencies: { lodash: "^4" } } });
    expect(plan.success).toBe(false);
  });

  it("fails when the dependency is missing from the lockfile", () => {
    const plan = planThemeDependencyUpdate({ ...base, dependencyKey: "@venore/theme-halo" });
    expect(plan.success).toBe(false);
  });
});
