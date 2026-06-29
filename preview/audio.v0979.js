"use strict";

/*
 * 背景音乐管理器（音频状态机）：
 * 1. 只维护一个 audio 通道，避免菜单、战斗、Boss 音乐叠播。
 * 2. 菜单音乐遵守浏览器自动播放规则：首次打开不播放，等用户首次交互解锁后再尝试淡入。
 * 3. 失焦（点击地址栏、开发者工具、切到其它窗口）不再暂停 BGM，避免“点一下就停且不恢复”。
 * 4. 只在页面真正隐藏 / 卸载时暂停；回到前台且音乐开启时自动恢复当前场景。
 * 5. 播放失败不会影响游戏主流程，也不会把异常抛到页面上；被浏览器拒绝时给出轻提示并在下次交互重试。
 *
 * 对外（window.AudioManager）：
 *   init / playScene / playSceneBgm / playSfx / toggleMute / setMusicEnabled /
 *   setVolume / unlockAudio / pauseBgm / resumeBgm / stopBgm / getState
 */
(function createAudioManager(global) {
  const SCENES = Object.freeze({
    menu: { src: "assets/audio/menu-web.mp3", label: "命途余音" },
    battle: { src: "assets/audio/battle-web.mp3", label: "普通战" },
    boss: { src: "assets/audio/boss-web.mp3", label: "首领战" },
    conclusion: { src: "assets/audio/conclusion-web.mp3", label: "命途残卷" },
    layer2Miasma: { src: "assets/audio/layer2-miasma-web.mp3", label: "瘴林深径" },
    layer2Bloodmarsh: { src: "assets/audio/layer2-bloodmarsh-web.mp3", label: "血沼沉渊" },
    layer3Bone: { src: "assets/audio/layer3-bone-web.mp3", label: "骨塔高陵" },
    layer3Beehive: { src: "assets/audio/layer3-beehive-web.mp3", label: "蜂窟魔巢" },
  });

  const SFX = Object.freeze({
    cardPlay: "assets/audio/sfx/card-play.mp3",
    hitLight: "assets/audio/sfx/hit-light.mp3",
    hitHeavy: "assets/audio/sfx/hit-heavy.mp3",
    block: "assets/audio/sfx/block.mp3",
    poisonApply: "assets/audio/sfx/poison-apply.mp3",
    uiClick: "assets/audio/sfx/ui-click.mp3",
    victory: "assets/audio/sfx/victory.mp3",
    defeat: "assets/audio/sfx/defeat.mp3",
  });

  const STORAGE_KEYS = Object.freeze({
    volume: "niming.audio.volume",
    muted: "niming.audio.muted",
  });

  // 持续监听这些事件直到 BGM 成功播放一次：移动端首播常被拒绝，需要在后续交互里重试。
  const INTERACTION_EVENTS = ["pointerdown", "mousedown", "touchstart", "click", "keydown"];

  let volume = 0.45;
  let muted = false;
  let currentScene = null;
  let activeIndex = 0;
  let fadeTimer = null;
  let fadeResolve = null;
  let transitionSerial = 0;
  let initialized = false;
  let hasUserInteracted = false; // 音频是否已被用户手势解锁
  let interactionArmed = false;
  let lifecyclePaused = false; // 是否因页面隐藏/卸载而暂停，便于回到前台时恢复
  let combatWarmed = false; // 是否已后台预热战斗/Boss BGM

  // 单通道串行换曲：从结构上保证不会有两首 BGM 同时播放。
  const channels = [createChannel()];
  const sfxChannels = {};
  const ui = {};

  function createChannel() {
    // 不直接依赖全局 Audio 构造器，兼容限制更严格的嵌入式浏览环境。
    const audio = document.createElement("audio");
    audio.loop = true;
    audio.preload = "auto";
    audio.addEventListener("error", () => {
      const source = audio.currentSrc || audio.src || "未知音频";
      console.warn(`[背景音乐加载失败] ${source}。游戏将继续以静音状态运行。`);
    });
    return audio;
  }

  function createSfxChannel(key, src) {
    const audio = document.createElement("audio");
    audio.src = src;
    audio.preload = "auto";
    audio.addEventListener("error", () => {
      console.warn(`[音效加载失败] ${src}。游戏将继续运行。`);
    });
    audio.hidden = true;
    audio.dataset.sfxChannel = key;
    audio.setAttribute("aria-hidden", "true");
    return audio;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function readStoredSettings() {
    try {
      const storedVolume = Number.parseFloat(localStorage.getItem(STORAGE_KEYS.volume));
      const storedMuted = localStorage.getItem(STORAGE_KEYS.muted);
      if (Number.isFinite(storedVolume)) volume = clamp(storedVolume, 0, 1);
      if (storedMuted === "true" || storedMuted === "false") muted = storedMuted === "true";
    } catch (error) {
      console.warn("[背景音乐设置] 无法读取 localStorage，将使用默认音量。", error);
    }
  }

  function storeSettings() {
    try {
      localStorage.setItem(STORAGE_KEYS.volume, String(volume));
      localStorage.setItem(STORAGE_KEYS.muted, String(muted));
    } catch (error) {
      console.warn("[背景音乐设置] 无法保存 localStorage，本次设置仍会继续生效。", error);
    }
  }

  function isStartMenuVisible() {
    const startScreen = document.getElementById("startScreen");
    return Boolean(startScreen && !startScreen.classList.contains("hidden"));
  }

  function isMenuSceneVisible() {
    const startScreen = document.getElementById("startScreen");
    const mapScreen = document.getElementById("mapScreen");
    const resultOverlay = document.getElementById("resultOverlay");
    return Boolean(
      (startScreen && !startScreen.classList.contains("hidden")) ||
      (mapScreen && !mapScreen.classList.contains("hidden")) ||
      (resultOverlay && !resultOverlay.classList.contains("hidden"))
    );
  }

  // 当前应当播放的场景：优先沿用已记录的场景，否则若菜单类界面可见则回落到菜单曲。
  function resolveDesiredScene() {
    return currentScene || (isMenuSceneVisible() ? "menu" : null);
  }

  function updateControls() {
    if (!initialized) return;
    const playing = channels.some((channel) => !channel.paused);
    ui.toggle.setAttribute("aria-pressed", String(!muted));
    ui.toggle.classList.toggle("is-muted", muted);
    ui.status.textContent = muted ? "音乐：关" : "音乐：开";
    ui.volume.value = String(volume);
    ui.volume.setAttribute("aria-valuetext", `${Math.round(volume * 100)}%`);
    ui.scene.textContent = currentScene ? SCENES[currentScene].label : "未播放";
    ui.container.dataset.scene = currentScene || "none";
    ui.container.dataset.muted = String(muted);
    ui.container.dataset.volume = String(volume);
    ui.container.dataset.playing = String(playing);
    ui.container.dataset.userInteracted = String(hasUserInteracted);

    if (ui.wakeHint) {
      // 只要音乐开启却没有真正在播放，就提示用户点击页面开启音乐；正在播放或已关闭时隐藏。
      ui.wakeHint.classList.toggle("hidden", playing || muted);
    }
  }

  function stopFade(completed = false) {
    window.clearInterval(fadeTimer);
    fadeTimer = null;
    if (fadeResolve) {
      const resolve = fadeResolve;
      fadeResolve = null;
      resolve(completed);
    }
  }

  function applyMuteState() {
    channels.forEach((channel) => { channel.muted = muted; });
    Object.values(sfxChannels).forEach((channel) => { channel.muted = muted; });
  }

  function fadeChannel(channel, from, to, duration, serial) {
    stopFade(false);
    channel.volume = from;
    const startedAt = performance.now();
    return new Promise((resolve) => {
      fadeResolve = resolve;
      fadeTimer = window.setInterval(() => {
        if (serial !== transitionSerial) {
          stopFade(false);
          return;
        }
        const progress = Math.min(1, (performance.now() - startedAt) / duration);
        channel.volume = from + (to - from) * progress;
        if (progress >= 1) stopFade(true);
      }, 40);
    });
  }

  async function stopCurrentScene(duration = 480) {
    const serial = ++transitionSerial;
    stopFade(false);
    const active = activeIndex >= 0 ? channels[activeIndex] : null;
    // 菜单曲淡出更短促，战斗/Boss 曲淡出稍长；依据当前正在播放的场景决定。
    const fadeDuration = currentScene === "menu"
      ? clamp(duration, 300, 600)
      : clamp(duration, 400, 700);
    if (active && !active.paused) {
      const fadedOut = await fadeChannel(active, active.volume, 0, fadeDuration, serial);
      if (!fadedOut || serial !== transitionSerial) return false;
      active.pause();
      active.currentTime = 0;
    }
    currentScene = null;
    updateControls();
    return true;
  }

  function shouldSuppressPlayWarning(error, quiet) {
    if (quiet) return true;
    return error && (error.name === "NotAllowedError" || error.name === "AbortError");
  }

  async function playScene(sceneKey, { duration = 600, quiet = false } = {}) {
    const scene = SCENES[sceneKey];
    if (!scene) {
      console.warn(`[背景音乐] 未知场景：${sceneKey}`);
      return false;
    }

    const fadeDuration = sceneKey === "menu"
      ? clamp(duration, 300, 600)
      : clamp(duration, 400, 700);

    // 菜单音乐必须等当前页面的首次用户交互后再尝试播放，刷新页面后重新等待。
    if (sceneKey === "menu" && !hasUserInteracted) {
      updateControls();
      return false;
    }

    // 静音时不启动菜单音乐；如果刚从战斗回菜单，则先停掉旧战斗 BGM。
    if (sceneKey === "menu" && muted) {
      await stopCurrentScene(duration);
      return false;
    }

    const active = activeIndex >= 0 ? channels[activeIndex] : null;
    if (sceneKey === currentScene && active && !active.paused) {
      active.volume = volume;
      applyMuteState();
      updateControls();
      return true;
    }

    if (sceneKey === currentScene && active && active.paused && active.getAttribute("src") === scene.src) {
      const serial = ++transitionSerial;
      stopFade(false);
      active.volume = 0;
      active.muted = muted;
      active.dataset.transitionSerial = String(serial);
      updateControls();
      try {
        await active.play();
      } catch (error) {
        if (!shouldSuppressPlayWarning(error, quiet)) {
          console.warn(`[背景音乐恢复失败] ${scene.src}。请再次点击页面或音乐开关后重试。`, error);
        }
        updateControls();
        return false;
      }
      const resumed = await fadeChannel(active, 0, volume, fadeDuration, serial);
      if (resumed && serial === transitionSerial) active.volume = volume;
      lifecyclePaused = false;
      updateControls();
      return Boolean(resumed && serial === transitionSerial);
    }

    const serial = ++transitionSerial;
    stopFade(false);

    // 先完整淡出并停止旧曲，再启动新曲；任何时刻都只允许一个 audio 通道播放。
    if (active && !active.paused) {
      const fadedOut = await fadeChannel(active, active.volume, 0, fadeDuration, serial);
      if (!fadedOut || serial !== transitionSerial) return false;
      active.pause();
      active.currentTime = 0;
    }

    const nextIndex = 0;
    const next = channels[nextIndex];
    next.pause();
    next.src = scene.src;
    next.currentTime = 0;
    next.volume = 0;
    next.loop = true;
    next.muted = muted;
    next.dataset.transitionSerial = String(serial);
    activeIndex = nextIndex;
    currentScene = sceneKey;
    updateControls();

    try {
      await next.play();
    } catch (error) {
      if (serial === transitionSerial && !shouldSuppressPlayWarning(error, quiet)) {
        console.warn(`[背景音乐播放失败] ${scene.src}。请再次点击音乐开关后重试。`, error);
      }
      updateControls();
      return false;
    }

    if (serial !== transitionSerial || next.dataset.transitionSerial !== String(serial)) {
      return false;
    }

    const fadedIn = await fadeChannel(next, 0, volume, fadeDuration, serial);
    if (fadedIn && serial === transitionSerial) next.volume = volume;
    lifecyclePaused = false;
    updateControls();
    return Boolean(fadedIn && serial === transitionSerial);
  }

  // 用户手势解锁后，尝试播放当前应当播放的场景；成功后撤掉交互监听，失败则保留以便下次重试。
  function attemptSceneAfterUnlock() {
    if (!initialized || muted || !hasUserInteracted) return;
    const scene = resolveDesiredScene();
    if (!scene) return;
    playScene(scene, { duration: 480, quiet: true }).then((ok) => {
      if (ok) {
        removeInteractionListeners();
        warmupCombatBgm();
      }
      updateControls();
    });
  }

  // 菜单 BGM 起播后，预热小体积音效，让首次出招音效更跟手。
  // 注意：不再后台抓取大体积战斗/Boss BGM —— 那会在手机弱网下抢占带宽，拖慢音效与切场景 BGM 的响应。
  function warmupCombatBgm() {
    if (combatWarmed) return;
    combatWarmed = true;
    Object.values(sfxChannels).forEach((channel) => {
      try { channel.load(); } catch (warmError) { /* 预热失败忽略 */ }
    });
  }

  function handleInteraction() {
    if (!hasUserInteracted) {
      hasUserInteracted = true;
      updateControls();
    }
    attemptSceneAfterUnlock();
  }

  function armInteractionListeners() {
    if (interactionArmed) return;
    interactionArmed = true;
    // 不用 once：首播被拒时要在后续每次交互继续尝试，直到成功播放才撤除。
    const options = { capture: true, passive: true };
    INTERACTION_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, handleInteraction, options);
    });
  }

  function removeInteractionListeners() {
    if (!interactionArmed) return;
    INTERACTION_EVENTS.forEach((eventName) => {
      document.removeEventListener(eventName, handleInteraction, true);
    });
    interactionArmed = false;
  }

  // 对外解锁入口：标记已交互并尝试播放当前场景。
  function unlockAudio() {
    if (!hasUserInteracted) {
      hasUserInteracted = true;
      updateControls();
    }
    attemptSceneAfterUnlock();
  }

  function setMusicEnabled(enabled) {
    muted = !enabled;
    applyMuteState();
    storeSettings();

    if (!muted) {
      // 用户主动开启音乐这一动作本身就是有效手势，可视为已解锁。
      hasUserInteracted = true;
      const active = activeIndex >= 0 ? channels[activeIndex] : null;
      if (active && active.paused && currentScene) {
        const serial = ++transitionSerial;
        stopFade(false);
        lifecyclePaused = false;
        active.volume = 0;
        active.muted = false;
        active.play()
          .then(() => fadeChannel(active, 0, volume, 420, serial))
          .then(() => { if (serial === transitionSerial) active.volume = volume; updateControls(); })
          .catch(() => {
            // 浏览器仍可能拒绝：静默失败，由 wakeHint 提示并在下次交互重试。
            updateControls();
          });
      } else {
        attemptSceneAfterUnlock();
      }
    }

    updateControls();
  }

  function toggleMute() {
    setMusicEnabled(muted); // muted=true → 开启；muted=false → 关闭
  }

  function setVolume(nextVolume) {
    volume = clamp(Number(nextVolume) || 0, 0, 1);
    const active = activeIndex >= 0 ? channels[activeIndex] : null;
    if (active && !fadeTimer) active.volume = volume;
    storeSettings();
    updateControls();
  }

  function playSfx(key, { volumeScale = 0.65 } = {}) {
    if (!initialized || muted) return false;
    const channel = sfxChannels[key];
    if (!channel) {
      console.warn(`[音效] 未知音效：${key}`);
      return false;
    }
    channel.pause();
    channel.currentTime = 0;
    channel.volume = clamp(volume * volumeScale, 0, 1);
    channel.muted = muted;
    channel.play().catch(() => {
      // 音效也遵守浏览器播放策略；失败时静默处理，不影响战斗。
    });
    return true;
  }

  // 因页面隐藏/卸载而暂停 BGM；记录 lifecyclePaused 以便回到前台时恢复。
  function pauseBgm(reason) {
    if (!initialized) return;
    stopFade(false);
    const active = activeIndex >= 0 ? channels[activeIndex] : null;
    if (active && !active.paused) {
      lifecyclePaused = true;
      active.pause();
    }
    updateControls();
  }

  // 回到前台后，若音乐开启且已解锁、页面可见，则恢复当前场景。
  function resumeBgm() {
    if (!initialized || muted || !hasUserInteracted || document.hidden) return;
    const scene = resolveDesiredScene();
    if (!scene) return;
    lifecyclePaused = false;
    playScene(scene, { duration: 360, quiet: true });
  }

  // 彻底停止当前 BGM（不清空 currentScene，便于卸载被取消后仍可 resume）。
  function stopBgm() {
    if (!initialized) return;
    stopFade(false);
    const active = activeIndex >= 0 ? channels[activeIndex] : null;
    if (active && !active.paused) active.pause();
    updateControls();
  }

  function bindLifecycleEvents() {
    // 唯一可靠的暂停信号：页面真正隐藏（切标签页 / 最小化 / 移动端切后台）。
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pauseBgm("hidden");
      else resumeBgm();
    });
    // 进入 bfcache（persisted=true）不暂停，返回时由 pageshow/visibility 自然恢复；只有真正卸载才暂停。
    window.addEventListener("pageshow", () => resumeBgm());
    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) pauseBgm("pagehide");
    });
    window.addEventListener("beforeunload", () => pauseBgm("beforeunload"));
    // 安全网：window focus 只用于“恢复”，绝不暂停。
    // 故意不监听 window blur —— 点击地址栏 / 开发者工具 / 切换窗口不应停止 BGM。
    window.addEventListener("focus", () => resumeBgm());
  }

  function init() {
    if (initialized) return;
    ui.container = document.getElementById("audioControls");
    ui.toggle = document.getElementById("musicToggle");
    ui.status = document.getElementById("musicStatus");
    ui.volume = document.getElementById("musicVolume");
    ui.scene = document.getElementById("musicScene");
    ui.wakeHint = document.getElementById("musicWakeHint");
    if (!ui.container || !ui.toggle || !ui.status || !ui.volume || !ui.scene) return;

    initialized = true;
    channels.forEach((channel, index) => {
      channel.hidden = true;
      channel.dataset.bgmChannel = String(index);
      channel.setAttribute("aria-hidden", "true");
      document.body.appendChild(channel);
    });
    Object.entries(SFX).forEach(([key, src]) => {
      sfxChannels[key] = createSfxChannel(key, src);
      document.body.appendChild(sfxChannels[key]);
    });

    // 页面加载即预缓冲菜单 BGM（仅下载、不自动播放），缩短首次交互后的出声等待。
    try {
      channels[0].src = SCENES.menu.src;
      channels[0].load();
    } catch (preloadError) { /* 预加载失败不影响按需播放 */ }

    readStoredSettings();
    applyMuteState();
    ui.toggle.addEventListener("click", toggleMute);
    ui.volume.addEventListener("input", (event) => setVolume(event.target.value));
    armInteractionListeners();
    bindLifecycleEvents();
    updateControls();
  }

  function getState() {
    const active = activeIndex >= 0 ? channels[activeIndex] : null;
    return {
      scene: currentScene,
      volume,
      muted,
      hasUserInteracted,
      playing: Boolean(active && !active.paused),
      activeSource: active?.getAttribute("src") || active?.src || "",
      activeChannels: channels.filter((channel) => !channel.paused).length,
    };
  }

  function playSceneBgm(scene, options) {
    return playScene(scene, options);
  }

  // 预热(只下载进浏览器缓存、不播放)：用独立隐藏通道把指定场景 BGM 拉进缓存，
  // 之后真正切到该场景即可快速起播。完全独立于播放通道与换曲状态机，不改变任何播放逻辑。
  const warmPool = {};
  function warmScene(sceneKey) {
    try {
      const scene = SCENES[sceneKey];
      if (!scene || !scene.src || warmPool[scene.src]) return;
      const warm = document.createElement("audio");
      warm.preload = "auto";
      warm.muted = true;
      warm.loop = false;
      warm.src = scene.src;
      try { warm.load(); } catch (warmErr) { /* 忽略 */ }
      warmPool[scene.src] = warm;
    } catch (err) { /* 预热失败忽略，不影响按需播放 */ }
  }

  global.AudioManager = Object.freeze({
    init,
    playScene,
    playSceneBgm,
    playSfx,
    toggleMute,
    setMusicEnabled,
    setVolume,
    unlockAudio,
    pauseBgm,
    resumeBgm,
    stopBgm,
    getState,
    warmScene,
  });
  document.addEventListener("DOMContentLoaded", init);
}(window));
