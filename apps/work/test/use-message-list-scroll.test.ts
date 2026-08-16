import { afterEach, describe, expect, it, vi } from "vitest";
import { useMessageListScroll } from "../src/renderer/src/composables/useMessageListScroll";

const unregisterCallbacks: (() => void)[] = [];

function registerHandle() {
  const { register } = useMessageListScroll();
  const handle = { scrollToTurn: vi.fn() };
  const unregister = register(handle);
  unregisterCallbacks.push(unregister);
  return { handle, unregister };
}

afterEach(() => {
  for (const unregister of unregisterCallbacks.splice(0)) unregister();
});

describe("useMessageListScroll", () => {
  it("register 后 scrollToTurn 转发给句柄", () => {
    const { handle } = registerHandle();
    const { scrollToTurn } = useMessageListScroll();

    const result = scrollToTurn(3, { align: "center", behavior: "smooth" });

    expect(result).toBe(true);
    expect(handle.scrollToTurn).toHaveBeenCalledWith(3, { align: "center", behavior: "smooth" });
  });

  it("未注册句柄时 scrollToTurn 返回 false", () => {
    const { scrollToTurn } = useMessageListScroll();

    expect(scrollToTurn(0)).toBe(false);
  });

  it("unregister 后不再转发", () => {
    const { handle, unregister } = registerHandle();
    const { scrollToTurn } = useMessageListScroll();

    unregister();
    expect(scrollToTurn(1)).toBe(false);
    expect(handle.scrollToTurn).not.toHaveBeenCalled();
  });

  it("重复 register 覆盖旧句柄，且旧句柄的 unregister 不影响新句柄", () => {
    const first = registerHandle();
    const second = registerHandle();
    const { scrollToTurn } = useMessageListScroll();

    first.unregister();
    scrollToTurn(2);
    expect(second.handle.scrollToTurn).toHaveBeenCalledWith(2);
    expect(first.handle.scrollToTurn).not.toHaveBeenCalled();
  });
});
