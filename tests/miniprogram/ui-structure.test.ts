import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function markup(path: string) {
  return readFileSync(resolve(path), "utf8");
}

function boundHandlers(source: string) {
  return [...source.matchAll(/bindtap="([A-Za-z_$][\w$]*)"/gu)].map((match) => match[1]);
}

describe("native WeChat presentation structure", () => {
  it("keeps Run core state actions visible while grouping low-frequency tools", () => {
    const run = markup("miniprogram/pages/run/run.wxml");

    expect(run).toContain('wx:for="{{run.groups}}"');
    expect(run).toContain('bindtap="toggleConfirmed"');
    expect(run).toContain('bindtap="markNotNeeded"');
    expect(run).toContain('bindtap="toggleItemTools"');
    expect(run).toMatch(/wx:if="\{\{[^"]*showTemporaryEditor[^"]*\}\}"/u);
    expect(run).toContain('class="bottom-dock run-dock"');
    expect(run.indexOf('bindtap="toggleConfirmed"')).toBeLessThan(
      run.indexOf('bindtap="toggleItemTools"'),
    );
    expect(run.indexOf('bindtap="markNotNeeded"')).toBeLessThan(
      run.indexOf('bindtap="toggleItemTools"'),
    );
  });

  it("keeps low-frequency template governance on detail instead of every library row", () => {
    const libraryHandlers = boundHandlers(markup("miniprogram/pages/templates/templates.wxml"));
    const detailHandlers = boundHandlers(
      markup("miniprogram/pages/template-detail/template-detail.wxml"),
    );
    const governanceHandlers = [
      "toggleFavorite",
      "toggleHidden",
      "deriveOfficial",
      "editPersonal",
      "copyPersonal",
      "deletePersonal",
    ];

    expect(libraryHandlers).toEqual(expect.arrayContaining([
      "startTemplate",
      "openDetail",
    ]));
    expect(libraryHandlers.filter((handler) => governanceHandlers.includes(handler))).toEqual([]);
    expect(detailHandlers).toEqual(expect.arrayContaining(governanceHandlers));
  });
});
