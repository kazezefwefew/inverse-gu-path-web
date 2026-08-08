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
    mupanBoss: { src: "assets/audio/boss-mupan-web.mp3", label: "万命母盘" }, // E-2c5b 终局战专属曲（用户AI生成）
    gulu: { src: "assets/audio/gulu/gulu-loop.v1.mp3", label: "蛊庐" }, // V0.9.26 蛊庐场景BGM（响度已烘焙、无缝loop）
    guluPark: { src: "assets/audio/gulu/youjian-park-loop.v1.mp3", label: "幽茧游园" },
    baigushi: { src: "assets/audio/baigushi-market.mp3", label: "百蛊市夜巷" },
    // V0.9.51 用户AI生成四曲：炼蛊开炉 / 局外炼蛊房 / 无尽 / 九转蜕变（后者是一次性演出，非循环）
    guluForge: { src: "assets/audio/gulu-forge-web.mp3", label: "炼蛊房" },
    endless: { src: "assets/audio/endless-web.mp3", label: "无尽登塔" },
    duel: { src: "assets/audio/gu-duel-ritual-web.mp3", label: "蛊斗争锋" },
    // V0.9.58 养蛊室专属曲（用户AI生成）：刻意无高潮、无鼓点——挂机场景要听几十遍，
    // 起伏会累、节拍会催人走，与「想多待一会」正相反。
    guluSpring: { src: "assets/audio/gulu-spring-web.mp3", label: "养蛊室" },
  });

  const SFX = Object.freeze({
    cardPlay: "assets/audio/sfx/card-play.mp3",
    duelCardCast: "assets/audio/sfx/duel-card-cast.mp3",
    furnaceRite: "assets/audio/boss-mupan-web.mp3", // 与母盘曲同源，保留单一运行期资源引用
    benmingAscend: "assets/audio/benming-ascend-web.mp3", // V0.9.51 九转蜕变一次性演出
    hitLight: "assets/audio/sfx/hit-light.mp3",
    hitHeavy: "assets/audio/sfx/hit-heavy.mp3",
    duelImpact: "assets/audio/sfx/duel-impact.mp3",
    duelArmorBreak: "assets/audio/sfx/duel-armor-break.mp3",
    block: "assets/audio/sfx/block.mp3",
    poisonApply: "assets/audio/sfx/poison-apply.mp3",
    duelPoisonProc: "assets/audio/sfx/duel-poison-proc.mp3",
    duelHeal: "assets/audio/gulu/gulu-feed.v1.mp3",
    duelArmorGain: "assets/audio/sfx/block.mp3",
    duelDraw: "assets/audio/sfx/ui-click.mp3",
    duelEnergy: "assets/audio/sfx/wenling/bone-note-gain.mp3",
    duelCleanse: "assets/audio/gulu/forge-ward.v1.mp3",
    uiClick: "assets/audio/sfx/ui-click.mp3",
    victory: "assets/audio/sfx/victory.mp3",
    defeat: "assets/audio/sfx/defeat.mp3",
    // V0.9.26 蛊庐音效批（响度已烘焙；破壳四品同底变调，与仪式分色同帧触发）
    guluHatchFan: "assets/audio/gulu/gulu-hatch-gray.v1.mp3",
    guluHatchLing: "assets/audio/gulu/gulu-hatch-green.v1.mp3",
    guluHatchXuan: "assets/audio/gulu/gulu-hatch-purple.v1.mp3",
    guluHatchTian: "assets/audio/gulu/gulu-hatch-gold.v1.mp3",
    guluHeartbeat: "assets/audio/gulu/gulu-heartbeat.v1.mp3",
    guluFeed: "assets/audio/gulu/gulu-feed.v1.mp3",
    guluPot: "assets/audio/gulu/gulu-pot.v2.mp3",
    guluClick: "assets/audio/gulu/gulu-click.v1.mp3",
    // 游园动作使用语义键，先复用既有轻量资源；后续可替换音色而不改交互代码。
    parkNameSeal: "assets/audio/gulu/forge-ward.v1.mp3",
    parkDonate: "assets/audio/gulu/forge-feed.v1.mp3",
    parkQuizCorrect: "assets/audio/sfx/wenling/bone-threshold-3.mp3",
    parkQuizWrong: "assets/audio/gulu/forge-fail.v1.mp3",
    parkSpringLand: "assets/audio/gulu/gulu-pot.v2.mp3",
    parkCocoonOpen: "assets/audio/gulu/gulu-hatch-green.v1.mp3",
    /* V0.9.55 九转鼎五音（此前整套演出全是借用：投料借喂蛊、鼎震借陶罐、
     * 成功借天品破壳、护符借战斗格挡、化灰借战斗失败）。现配齐自己的。
     * 投料/鼎震已按演出时序裁剪（520ms 交棒、1580ms 出结果），结果三音保留完整余韵。 */
    forgeFeed: "assets/audio/gulu/forge-feed.v1.mp3",
    forgeRumble: "assets/audio/gulu/forge-rumble.v1.mp3",
    forgeSuccess: "assets/audio/gulu/forge-success.v1.mp3",
    forgeWard: "assets/audio/gulu/forge-ward.v1.mp3",
    forgeFail: "assets/audio/gulu/forge-fail.v1.mp3",
    dragonRoar: "assets/audio/sfx/dragon-roar.mp3",
    dragonTransformImpact: "assets/audio/sfx/dragon-transform-impact.mp3",
    dragonScaleReady: "assets/audio/sfx/dragon-scale-ready.mp3",
    boneNoteGain: "assets/audio/sfx/wenling/bone-note-gain.mp3",
    boneVoluntaryShatter: "assets/audio/sfx/wenling/voluntary-shatter.mp3",
    boneAfterEcho: "assets/audio/sfx/wenling/after-echo.mp3",
    boneChimeFate: "assets/audio/sfx/wenling/bone-chime-fate.mp3",
    boneChimeSoul: "assets/audio/sfx/wenling/bone-chime-soul.mp3",
    boneThresholdThree: "assets/audio/sfx/wenling/bone-threshold-3.mp3",
    boneThresholdSix: "assets/audio/sfx/wenling/bone-threshold-6.mp3",
  });

  // V0.9.26 环境层（夜间虫鸣等）：BGM 单通道之外的第二循环通道，叠加播放、
  // 自带淡入淡出；同受 muted/主音量门控，页面隐藏随生命周期暂停。
  const AMBIENTS = Object.freeze({
    guluNight: { src: "assets/audio/gulu/gulu-night-insects.v1.mp3", baseVolume: 0.34 }, // V0.9.34 调轻：整夜久驻不刺耳
    /* V0.9.58 养蛊室灵泉滴水。比虫鸣更轻：虫鸣是间歇的（22s鸣/48s静），
     * 滴水在养蛊室里常驻，音量给高了会抢 BGM 的戏。
     * 环境层是单通道，故滴水与虫鸣互斥——进养蛊室＝进内室，听灵泉不听虫鸣，
     * 与 forge 页签同一套路（见 nmg-gulu.js 的 syncGuluTabAudio）。 */
    guluSpringDrip: { src: "assets/audio/gulu/spring-drip.v1.mp3", baseVolume: 0.26 },
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
  const VOICE_DUCK_RATIO = 0.45;
  let voiceAudio = null;
  let activeVoice = null;
  let voiceSerial = 0;
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

  function getBgmVolume() {
    return activeVoice ? volume * VOICE_DUCK_RATIO : volume;
  }

  function refreshBgmDuck() {
    const active = activeIndex >= 0 ? channels[activeIndex] : null;
    if (active && !active.paused && !fadeTimer) active.volume = getBgmVolume();
  }

  function stopVoice() {
    if (!voiceAudio) return;
    voiceSerial += 1;
    voiceAudio.pause();
    try { voiceAudio.currentTime = 0; } catch (error) { /* 静默降级 */ }
    activeVoice = null;
    refreshBgmDuck();
  }

  // 旧版 Android WebView 的 HTMLMediaElement.play() 可能同步抛错、返回 undefined，
  // currentTime 也可能在尚未就绪时抛错。音频永远只是可选体验，不能穿透到玩法流程。
  function safeMediaPlay(media, { restart = false, onError = null } = {}) {
    const fail = () => {
      try { onError?.(); } catch (error) { /* 错误回调也不得影响游戏 */ }
      return false;
    };
    if (!media || typeof media.play !== "function") return Promise.resolve(fail());
    if (restart) {
      try { media.currentTime = 0; } catch (error) { /* 保留当前位置仍可尝试播放 */ }
    }
    try {
      const played = media.play();
      if (played && typeof played.then === "function") {
        return Promise.resolve(played).then(() => true, () => fail());
      }
      return Promise.resolve(true);
    } catch (error) {
      return Promise.resolve(fail());
    }
  }

  function ensureVoiceChannel() {
    if (voiceAudio) return voiceAudio;
    voiceAudio = document.createElement("audio");
    voiceAudio.preload = "auto";
    voiceAudio.hidden = true;
    voiceAudio.setAttribute("aria-hidden", "true");
    const settle = () => { if (activeVoice?.serial === Number(voiceAudio.dataset.voiceSerial)) stopVoice(); };
    voiceAudio.addEventListener("ended", settle);
    voiceAudio.addEventListener("error", settle);
    document.body.appendChild(voiceAudio);
    return voiceAudio;
  }

  function playVoice(voice) {
    if (!initialized || muted || !hasUserInteracted || !voice?.src) return false;
    const priority = Number(voice.priority) || 0;
    if (activeVoice && activeVoice.priority >= priority) return false;
    if (activeVoice) stopVoice();
    const channel = ensureVoiceChannel();
    const serial = ++voiceSerial;
    activeVoice = { key: voice.key || voice.src, priority, serial };
    channel.dataset.voiceSerial = String(serial);
    channel.src = voice.src;
    try { channel.currentTime = 0; } catch (error) { /* 旧 WebView 未就绪时继续尝试播放 */ }
    channel.volume = clamp(volume, 0, 1);
    channel.muted = muted;
    refreshBgmDuck();
    void safeMediaPlay(channel, { onError: () => { if (activeVoice?.serial === serial) stopVoice(); } });
    return true;
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
    if (voiceAudio) { voiceAudio.muted = muted; if (muted) stopVoice(); }
    if (ambientAudio) { ambientAudio.muted = muted; if (muted) ambientAudio.pause(); else if (ambientKey && !document.hidden) void safeMediaPlay(ambientAudio); } // V0.9.26 环境层同守开关（关=真静音停播）
  }

  /* ===== V0.9.26 环境层通道：BGM 之外的第二循环（夜间虫鸣等），淡入淡出、随生命周期暂停 ===== */
  let ambientAudio = null;
  let ambientKey = null;
  let ambientFadeTimer = null;
  function ensureAmbientChannel() {
    if (ambientAudio) return ambientAudio;
    ambientAudio = document.createElement("audio");
    ambientAudio.loop = true;
    ambientAudio.preload = "auto";
    ambientAudio.hidden = true;
    ambientAudio.setAttribute("aria-hidden", "true");
    ambientAudio.addEventListener("error", () => { console.warn(`[环境音加载失败] ${ambientAudio.src}。游戏将继续运行。`); });
    document.body.appendChild(ambientAudio);
    return ambientAudio;
  }
  function ambientTargetVolume() {
    const def = ambientKey ? AMBIENTS[ambientKey] : null;
    return def ? clamp((def.baseVolume ?? 0.5) * volume, 0, 1) : 0;
  }
  function ambientFadeTo(target, ms, stopAtZero) {
    const a = ensureAmbientChannel();
    if (ambientFadeTimer) { window.clearInterval(ambientFadeTimer); ambientFadeTimer = null; }
    const steps = Math.max(1, Math.round((ms || 0) / 60));
    const from = a.volume;
    const to = clamp(target, 0, 1);
    let i = 0;
    ambientFadeTimer = window.setInterval(() => {
      i += 1;
      a.volume = clamp(from + (to - from) * (i / steps), 0, 1);
      if (i >= steps) {
        window.clearInterval(ambientFadeTimer);
        ambientFadeTimer = null;
        if (stopAtZero && to <= 0) { a.pause(); ambientKey = null; }
      }
    }, 60);
  }
  function playAmbient(key, { fadeMs = 2000 } = {}) {
    if (!initialized || muted) return false;
    const def = AMBIENTS[key];
    if (!def) { console.warn(`[环境音] 未知环境音：${key}`); return false; }
    const a = ensureAmbientChannel();
    if (ambientKey !== key) {
      try { a.src = def.src; a.load(); } catch (e) { /* 忽略 */ }
      a.volume = 0;
      ambientKey = key;
    }
    a.muted = muted;
    void safeMediaPlay(a); // 播放策略拒绝时静默，蛊庐内必然已有用户手势，正常不会触发
    ambientFadeTo(ambientTargetVolume(), fadeMs, false);
    return true;
  }
  function stopAmbient({ fadeMs = 2000 } = {}) {
    if (!ambientAudio || ambientKey === null) return;
    ambientFadeTo(0, fadeMs, true);
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
      try { active.currentTime = 0; } catch (error) { /* 静默降级 */ }
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
      active.volume = getBgmVolume();
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
        if (!await safeMediaPlay(active)) throw new Error("media playback rejected");
      } catch (error) {
        if (!shouldSuppressPlayWarning(error, quiet)) {
          console.warn(`[背景音乐恢复失败] ${scene.src}。请再次点击页面或音乐开关后重试。`, error);
        }
        updateControls();
        return false;
      }
      const resumed = await fadeChannel(active, 0, getBgmVolume(), fadeDuration, serial);
      if (resumed && serial === transitionSerial) active.volume = getBgmVolume();
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
      try { active.currentTime = 0; } catch (error) { /* 静默降级 */ }
    }

    const nextIndex = 0;
    const next = channels[nextIndex];
    next.pause();
    next.src = scene.src;
    try { next.currentTime = 0; } catch (error) { /* 静默降级 */ }
    next.volume = 0;
    next.loop = true;
    next.muted = muted;
    next.dataset.transitionSerial = String(serial);
    activeIndex = nextIndex;
    currentScene = sceneKey;
    updateControls();

    try {
      if (!await safeMediaPlay(next)) throw new Error("media playback rejected");
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

    const fadedIn = await fadeChannel(next, 0, getBgmVolume(), fadeDuration, serial);
    if (fadedIn && serial === transitionSerial) next.volume = getBgmVolume();
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
        safeMediaPlay(active)
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
    if (active && !fadeTimer) active.volume = getBgmVolume();
    if (voiceAudio && activeVoice) voiceAudio.volume = clamp(volume, 0, 1);
    if (ambientAudio && ambientKey && !ambientFadeTimer) ambientAudio.volume = ambientTargetVolume(); // V0.9.26 环境层随主音量
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
    try { channel.currentTime = 0; } catch (error) { /* 音效不可用时继续静默降级 */ }
    channel.volume = clamp(volume * volumeScale, 0, 1);
    channel.muted = muted;
    void safeMediaPlay(channel); // 音效也遵守浏览器播放策略；失败时静默处理，不影响战斗。
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
    if (ambientAudio && !ambientAudio.paused) ambientAudio.pause(); // V0.9.26 环境层持续音随页面隐藏暂停（省电）
    updateControls();
  }

  // 回到前台后，若音乐开启且已解锁、页面可见，则恢复当前场景。
  function resumeBgm() {
    if (!initialized || muted || !hasUserInteracted || document.hidden) return;
    if (ambientAudio && ambientKey) void safeMediaPlay(ambientAudio); // V0.9.26 环境层随前台恢复
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
    playAmbient,
    stopAmbient,
    toggleMute,
    setMusicEnabled,
    setVolume,
    unlockAudio,
    pauseBgm,
    resumeBgm,
    stopBgm,
    playVoice,
    stopVoice,
    getState,
    warmScene,
  });
  document.addEventListener("DOMContentLoaded", init);
}(window));
