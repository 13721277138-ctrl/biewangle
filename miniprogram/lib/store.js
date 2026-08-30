const STORAGE_KEYS = Object.freeze({
  active: "biewangle.snapshot.active",
  slotA: "biewangle.snapshot.a",
  slotB: "biewangle.snapshot.b",
  protectivePrefix: "biewangle.snapshot.protective.",
});

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function wrapSaveError(error) {
  const wrapped = new Error("本地保存失败，未保存，请重试。");
  wrapped.cause = error;
  return wrapped;
}

class WechatDurableStore {
  constructor(options) {
    this.storage = options.storage;
    this.validate = options.validate;
    this.createInitial = options.createInitial;
  }

  slotKey(slot) {
    return slot === "a" ? STORAGE_KEYS.slotA : STORAGE_KEYS.slotB;
  }

  async readValidated(slot) {
    const candidate = await this.storage.get(this.slotKey(slot));
    if (candidate === undefined) throw new Error(`存储槽 ${slot} 不存在。`);
    return this.validate(clone(candidate));
  }

  async load() {
    let active;
    try {
      active = await this.storage.get(STORAGE_KEYS.active);
    } catch (error) {
      const wrapped = new Error("无法读取当前本地数据。");
      wrapped.cause = error;
      throw wrapped;
    }

    if (active !== "a" && active !== "b") {
      return this.validate(this.createInitial());
    }

    try {
      return clone(await this.readValidated(active));
    } catch (activeError) {
      const fallback = active === "a" ? "b" : "a";
      try {
        return clone(await this.readValidated(fallback));
      } catch (fallbackError) {
        const wrapped = new Error("当前本地数据无法通过完整性校验。");
        wrapped.cause = { activeError, fallbackError };
        throw wrapped;
      }
    }
  }

  async commit(next) {
    try {
      const validated = this.validate(clone(next));
      const active = await this.storage.get(STORAGE_KEYS.active);
      const inactive = active === "a" ? "b" : "a";
      const inactiveKey = this.slotKey(inactive);

      await this.storage.set(inactiveKey, clone(validated));
      const roundTripped = await this.readValidated(inactive);
      if (JSON.stringify(roundTripped) !== JSON.stringify(validated)) {
        throw new Error("写入后的数据与待保存事实不一致。");
      }
      await this.storage.set(STORAGE_KEYS.active, inactive);
    } catch (error) {
      throw wrapSaveError(error);
    }
  }

  async protectiveCopy(label) {
    const current = await this.load();
    const safeLabel = String(label || "manual").replace(/[^a-zA-Z0-9._-]/g, "-");
    const timestamp = String(current.updatedAt || Date.now()).replace(/[^0-9]/g, "");
    try {
      await this.storage.set(`${STORAGE_KEYS.protectivePrefix}${safeLabel}.${timestamp}`, current);
    } catch (error) {
      const wrapped = new Error("无法创建当前数据的保护副本，操作已停止。");
      wrapped.cause = error;
      throw wrapped;
    }
  }
}

function createWxStorageAdapter(wxApi) {
  function get(key) {
    return new Promise((resolve, reject) => {
      wxApi.getStorage({
        key,
        success: (result) => resolve(clone(result.data)),
        fail: (error) => {
          const message = String((error && error.errMsg) || error || "");
          if (/not found|data not found/i.test(message)) resolve(undefined);
          else reject(error);
        },
      });
    });
  }

  function set(key, value) {
    return new Promise((resolve, reject) => {
      wxApi.setStorage({
        key,
        data: clone(value),
        success: () => resolve(),
        fail: reject,
      });
    });
  }

  function remove(key) {
    return new Promise((resolve, reject) => {
      wxApi.removeStorage({ key, success: () => resolve(), fail: reject });
    });
  }

  return { get, remove, set };
}

module.exports = {
  STORAGE_KEYS,
  WechatDurableStore,
  createWxStorageAdapter,
};
