"use strict";

/*
 * 背景音乐管理器：
 * 1. 只维护一个 audio 通道，避免菜单、战斗、Boss 音乐叠播。
 * 2. 菜单音乐遵守浏览器自动播放规则：首次打开不播放，等第一次用户交互后再尝试淡入。
 * 3. 播放失败不会影响游戏主流程，也不会把异常抛到页面上。
 */
(function createAudioManager(global) {
  const SCENES = Object.freeze({
    menu: { src: "assets/audio/menu.mp3", label: "命途余音" },
    battle: { src: "assets/audio/battle.mp3", label: "普通战" },
    boss: { src: "assets/audio/boss.mp3", label: "首领战" },
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

  const FIRST_INTERACTION_EVENTS = ["pointerdown", "mousedown", "touchstart", "click", "keydown"];

  let volume = 0.45;
  let muted = false;
  let currentScene = null;
  let activeIndex = 0;
  let fadeTimer = null;
  let fadeResolve = null;
  let transitionSerial = 0;
  let initialized = false;
  let hasUserInteracted = false;
  let firstInteractionArmed = false;
  let lifecyclePaused = false;

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
      // 首次交互前给轻提示；用户已交互或当前静音时隐藏，避免误导。
      ui.wakeHint.classList.toggle("hidden", hasUserInteracted || muted);
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
    const fadeDuration = sceneKey === "menu"
      ? clamp(duration, 300, 600)
      : clamp(duration, 400, 700);
    if (active && !active.paused) {
      const fadedOut = await fadeChannel(active, active.volume, 0, clamp(duration, 300, 700), serial);
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
        return false;
      }
      const resumed = await fadeChannel(active, 0, volume, fadeDuration, serial);
      if (resumed && serial === transitionSerial) active.volume = volume;
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
      return false;
    }

    if (serial !== transitionSerial || next.dataset.transitionSerial !== String(serial)) {
      return false;
    }

    const fadedIn = await fadeChannel(next, 0, volume, fadeDuration, serial);
    if (fadedIn && serial === transitionSerial) next.volume = volume;
    updateControls();
    return Boolean(fadedIn && serial === transitionSerial);
  }

  function maybeStartMenuAfterInteraction() {
    if (!hasUserInteracted || muted || !isMenuSceneVisible()) return;
    playScene("menu", { duration: 480, quiet: true });
  }

  function removeFirstInteractionListeners() {
    if (!firstInteractionArmed) return;
    FIRST_INTERACTION_EVENTS.forEach((eventName) => {
      document.removeEventListener(eventName, handleFirstInteraction, true);
    });
    firstInteractionArmed = false;
  }

  function handleFirstInteraction() {
    if (hasUserInteracted) return;
    hasUserInteracted = true;
    removeFirstInteractionListeners();
    updateControls();
    maybeStartMenuAfterInteraction();
  }

  function armFirstInteractionListeners() {
    if (firstInteractionArmed || hasUserInteracted) return;
    firstInteractionArmed = true;
    const options = { once: true, capture: true, passive: true };
    FIRST_INTERACTION_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, handleFirstInteraction, options);
    });
  }

  function toggleMute() {
    muted = !muted;
    applyMuteState();
    storeSettings();
    updateControls();

    const active = activeIndex >= 0 ? channels[activeIndex] : null;
    if (muted) return;

    if (active?.paused && currentScene) {
      active.volume = 0;
      active.play()
        .then(() => fadeChannel(active, 0, volume, 420, transitionSerial))
        .catch(() => {
          // 用户已明确点击音乐开关，但浏览器仍可能拒绝；静默失败，不影响游戏。
        });
      return;
    }

    // 从静音状态回到开始菜单时，若此前没有场景在播，立即恢复菜单音乐。
    maybeStartMenuAfterInteraction();
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

  function pauseForPageLifecycle() {
    if (!initialized) return;
    const active = activeIndex >= 0 ? channels[activeIndex] : null;
    stopFade(false);
    if (active && !active.paused) {
      lifecyclePaused = true;
      active.pause();
    }
    updateControls();
  }

  function resumeForPageLifecycle() {
    if (!initialized || muted || !hasUserInteracted || document.hidden) return;
    const scene = currentScene || (isMenuSceneVisible() ? "menu" : null);
    if (!scene) return;
    playScene(scene, { duration: 360, quiet: true });
    lifecyclePaused = false;
  }

  function bindLifecycleEvents() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pauseForPageLifecycle();
      else if (lifecyclePaused || currentScene || isMenuSceneVisible()) resumeForPageLifecycle();
    });
    window.addEventListener("pagehide", pauseForPageLifecycle);
    window.addEventListener("beforeunload", pauseForPageLifecycle);
    window.addEventListener("blur", pauseForPageLifecycle);
    window.addEventListener("focus", () => {
      if (lifecyclePaused || currentScene || isMenuSceneVisible()) resumeForPageLifecycle();
    });
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

    readStoredSettings();
    applyMuteState();
    ui.toggle.addEventListener("click", toggleMute);
    ui.volume.addEventListener("input", (event) => setVolume(event.target.value));
    armFirstInteractionListeners();
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

  global.AudioManager = Object.freeze({ init, playScene, playSfx, toggleMute, setVolume, getState });
  document.addEventListener("DOMContentLoaded", init);
}(window));
