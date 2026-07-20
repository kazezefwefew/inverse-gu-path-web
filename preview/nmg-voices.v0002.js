"use strict";

/* 朝暮固定语音：仅保存页面运行期的防重复标记，绝不写入 runState/game 或存档。 */
(function createNmgVoiceDirector(global) {
  const LONGEVITY_VOICES = Object.freeze({
    select: { key: "longevity_select_01", src: "assets/audio/voices/longevity_select_01.mp3", priority: 40 },
    start: { key: "longevity_start_01", src: "assets/audio/voices/longevity_start_01.mp3", priority: 40 },
    battle: { key: "longevity_battle_01", src: "assets/audio/voices/longevity_battle_01.mp3", priority: 50 },
    elite: { key: "longevity_elite_01", src: "assets/audio/voices/longevity_elite_01.mp3", priority: 50 },
    boss: { key: "longevity_boss_01", src: "assets/audio/voices/longevity_boss_01.mp3", priority: 80 },
    burn1: { key: "longevity_burn_01", src: "assets/audio/voices/longevity_burn_01.mp3", priority: 70 },
    burn2: { key: "longevity_burn_02", src: "assets/audio/voices/longevity_burn_02.mp3", priority: 70 },
    lowlife: { key: "longevity_lowlife_01", src: "assets/audio/voices/longevity_lowlife_01.mp3", priority: 70 },
    restore: { key: "longevity_restore_01", src: "assets/audio/voices/longevity_restore_01.mp3", priority: 10 },
    victory: { key: "longevity_victory_01", src: "assets/audio/voices/longevity_victory_01.mp3", priority: 60 },
    bossWin: { key: "longevity_bosswin_01", src: "assets/audio/voices/longevity_bosswin_01.mp3", priority: 80 },
    defeat: { key: "longevity_defeat_01", src: "assets/audio/voices/longevity_defeat_01.mp3", priority: 90 },
    ending: { key: "longevity_ending_01", src: "assets/audio/voices/longevity_ending_01.mp3", priority: 100 },
  });

  function createLongevityVoiceDirector({ play = () => false, stop = () => {} } = {}) {
    let runtime = null;
    const resetRun = () => {
      runtime = { select: false, start: false, normalBattles: 0, burnIndex: 0, burnTurn: null, lowlife: false, restore: false };
    };
    const resetBattle = () => { if (!runtime) resetRun(); runtime.lowlife = false; runtime.restore = false; runtime.burnTurn = null; };
    const choose = (event, turn) => {
      if (!runtime) resetRun();
      if (event === "select" && !runtime.select) { runtime.select = true; return LONGEVITY_VOICES.select; }
      if (event === "start" && !runtime.start) { runtime.start = true; return LONGEVITY_VOICES.start; }
      if (event === "battle" && runtime.normalBattles < 2) { runtime.normalBattles += 1; return LONGEVITY_VOICES.battle; }
      if (event === "elite") return LONGEVITY_VOICES.elite;
      if (event === "boss") return LONGEVITY_VOICES.boss;
      if (event === "burn" && runtime.burnTurn !== turn) { runtime.burnTurn = turn; const voice = runtime.burnIndex++ % 2 ? LONGEVITY_VOICES.burn2 : LONGEVITY_VOICES.burn1; return voice; }
      if (event === "lowlife" && !runtime.lowlife) { runtime.lowlife = true; return LONGEVITY_VOICES.lowlife; }
      if (event === "restore" && !runtime.restore) { runtime.restore = true; return LONGEVITY_VOICES.restore; }
      if (event === "victory") return LONGEVITY_VOICES.victory;
      if (event === "bossWin") return LONGEVITY_VOICES.bossWin;
      if (event === "defeat") return LONGEVITY_VOICES.defeat;
      if (event === "ending") return LONGEVITY_VOICES.ending;
      return null;
    };
    resetRun();
    return Object.freeze({
      resetRun,
      resetBattle,
      stop,
      trigger(event, { heroId, turn } = {}) {
        if (heroId !== "longevity") return false;
        const voice = choose(event, turn);
        return voice ? play(voice) : false;
      },
    });
  }

  const director = createLongevityVoiceDirector({
    play: (voice) => global.AudioManager?.playVoice?.(voice) || false,
    stop: () => global.AudioManager?.stopVoice?.(),
  });
  global.NMGVoiceDirector = director;
  global.NMGVoiceInternals = Object.freeze({ LONGEVITY_VOICES, createLongevityVoiceDirector });
}(window));
