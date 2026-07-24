"use strict";

/* 四名蛊修固定语音：只保留页面运行期防重复标记，绝不写入 runState/game 或存档。 */
(function createNmgVoiceDirector(global) {
  // 发布器与离线缓存从活动脚本收集字面资源路径；此清单不保存玩法状态。
  const VOICE_ASSET_MANIFEST = Object.freeze([
    "assets/audio/voices/longevity_select_01.mp3", "assets/audio/voices/longevity_start_01.mp3", "assets/audio/voices/longevity_battle_01.mp3", "assets/audio/voices/longevity_elite_01.mp3", "assets/audio/voices/longevity_boss_01.mp3", "assets/audio/voices/longevity_burn_01.mp3", "assets/audio/voices/longevity_burn_02.mp3", "assets/audio/voices/longevity_lowlife_01.mp3", "assets/audio/voices/longevity_restore_01.mp3", "assets/audio/voices/longevity_victory_01.mp3", "assets/audio/voices/longevity_bosswin_01.mp3", "assets/audio/voices/longevity_defeat_01.mp3", "assets/audio/voices/longevity_ending_01.mp3",
    "assets/audio/voices/fate_select_01.mp3", "assets/audio/voices/fate_start_01.mp3", "assets/audio/voices/fate_battle_01.mp3", "assets/audio/voices/fate_elite_01.mp3", "assets/audio/voices/fate_boss_01.mp3", "assets/audio/voices/fate_fulfill_01.mp3", "assets/audio/voices/fate_fulfill_02.mp3", "assets/audio/voices/fate_lowlife_01.mp3", "assets/audio/voices/fate_restore_01.mp3", "assets/audio/voices/fate_victory_01.mp3", "assets/audio/voices/fate_bosswin_01.mp3", "assets/audio/voices/fate_defeat_01.mp3", "assets/audio/voices/fate_ending_01.mp3",
    "assets/audio/voices/blood_select_01.mp3", "assets/audio/voices/blood_start_01.mp3", "assets/audio/voices/blood_battle_01.mp3", "assets/audio/voices/blood_elite_01.mp3", "assets/audio/voices/blood_boss_01.mp3", "assets/audio/voices/blood_sacrifice_01.mp3", "assets/audio/voices/blood_sacrifice_02.mp3", "assets/audio/voices/blood_lowlife_01.mp3", "assets/audio/voices/blood_restore_01.mp3", "assets/audio/voices/blood_victory_01.mp3", "assets/audio/voices/blood_bosswin_01.mp3", "assets/audio/voices/blood_defeat_01.mp3", "assets/audio/voices/blood_ending_01.mp3",
    "assets/audio/voices/poison_select_01.mp3", "assets/audio/voices/poison_start_01.mp3", "assets/audio/voices/poison_battle_01.mp3", "assets/audio/voices/poison_elite_01.mp3", "assets/audio/voices/poison_boss_01.mp3", "assets/audio/voices/poison_corrosion_01.mp3", "assets/audio/voices/poison_corrosion_02.mp3", "assets/audio/voices/poison_lowlife_01.mp3", "assets/audio/voices/poison_restore_01.mp3", "assets/audio/voices/poison_victory_01.mp3", "assets/audio/voices/poison_bosswin_01.mp3", "assets/audio/voices/poison_defeat_01.mp3", "assets/audio/voices/poison_ending_01.mp3",
    "assets/audio/voices/dragon_select_01.mp3", "assets/audio/voices/dragon_start_01.mp3", "assets/audio/voices/dragon_battle_01.mp3", "assets/audio/voices/dragon_elite_01.mp3", "assets/audio/voices/dragon_boss_01.mp3", "assets/audio/voices/dragon_transform_01.mp3", "assets/audio/voices/dragon_transform_02.mp3", "assets/audio/voices/dragon_lowlife_01.mp3", "assets/audio/voices/dragon_restore_01.mp3", "assets/audio/voices/dragon_victory_01.mp3", "assets/audio/voices/dragon_bosswin_01.mp3", "assets/audio/voices/dragon_defeat_01.mp3", "assets/audio/voices/dragon_ending_01.mp3",
  ]);
  const voice = (key, priority) => Object.freeze({ key, src: `assets/audio/voices/${key}.mp3`, priority });
  const heroVoices = (prefix, coreEvent, coreOne, coreTwo) => {
    const entries = {
    select: voice(`${prefix}_select_01`, 40), start: voice(`${prefix}_start_01`, 40),
    battle: voice(`${prefix}_battle_01`, 50), elite: voice(`${prefix}_elite_01`, 50), boss: voice(`${prefix}_boss_01`, 80),
    [coreOne]: voice(`${prefix}_${coreOne}`, 70), [coreTwo]: voice(`${prefix}_${coreTwo}`, 70),
    lowlife: voice(`${prefix}_lowlife_01`, 70), restore: voice(`${prefix}_restore_01`, 10), victory: voice(`${prefix}_victory_01`, 60),
      bosswin: voice(`${prefix}_bosswin_01`, 80), defeat: voice(`${prefix}_defeat_01`, 90), ending: voice(`${prefix}_ending_01`, 100),
    };
    Object.defineProperty(entries, "coreEvent", { value: coreEvent, enumerable: false });
    Object.defineProperty(entries, "bossWin", { value: entries.bosswin, enumerable: false });
    return Object.freeze(entries);
  };
  const HERO_VOICES = Object.freeze({
    longevity: heroVoices("longevity", "burn", "burn_01", "burn_02"),
    fate: heroVoices("fate", "fulfill", "fulfill_01", "fulfill_02"),
    blood: heroVoices("blood", "sacrifice", "sacrifice_01", "sacrifice_02"),
    poison: heroVoices("poison", "corrosion", "corrosion_01", "corrosion_02"),
    dragon: heroVoices("dragon", "transform", "transform_01", "transform_02"),
  });
  const LONGEVITY_VOICES = HERO_VOICES.longevity;

  function createVoiceDirector({ play = () => false, stop = () => {} } = {}) {
    let runtime = null;
    const makeState = () => ({ select: false, start: false, normalBattles: 0, coreIndex: 0, coreTurn: null, lowlife: false, restore: false });
    const resetRun = () => { runtime = Object.fromEntries(Object.keys(HERO_VOICES).map((heroId) => [heroId, makeState()])); };
    const resetBattle = () => {
      if (!runtime) resetRun();
      Object.values(runtime).forEach((state) => { state.lowlife = false; state.restore = false; state.coreTurn = null; });
    };
    const choose = (heroId, event, turn) => {
      if (!runtime) resetRun();
      const voices = HERO_VOICES[heroId];
      const state = runtime[heroId];
      if (!voices || !state) return null;
      if (event === "select" && !state.select) { state.select = true; return voices.select; }
      if (event === "start" && !state.start) { state.start = true; return voices.start; }
      if (event === "battle" && state.normalBattles < 2) { state.normalBattles += 1; return voices.battle; }
      if (event === "elite") return voices.elite;
      if (event === "boss") return voices.boss;
      if (event === voices.coreEvent && state.coreTurn !== turn) {
        state.coreTurn = turn;
        return state.coreIndex++ % 2 ? voices[Object.keys(voices).find((key) => key.endsWith("_02"))] : voices[Object.keys(voices).find((key) => key.endsWith("_01") && key !== "select")];
      }
      if (event === "lowlife" && !state.lowlife) { state.lowlife = true; return voices.lowlife; }
      if (event === "restore" && !state.restore) { state.restore = true; return voices.restore; }
      if (event === "victory") return voices.victory;
      if (event === "bossWin") return voices.bosswin;
      if (event === "defeat") return voices.defeat;
      if (event === "ending") return voices.ending;
      return null;
    };
    resetRun();
    return Object.freeze({ resetRun, resetBattle, stop, trigger(event, { heroId, turn } = {}) { const chosen = choose(heroId, event, turn); return chosen ? play(chosen) : false; } });
  }
  function createLongevityVoiceDirector(options) {
    const director = createVoiceDirector(options);
    return Object.freeze({
      resetRun: director.resetRun,
      resetBattle: director.resetBattle,
      stop: director.stop,
      trigger(event, details = {}) { return details.heroId === "longevity" ? director.trigger(event, details) : false; },
    });
  }

  const director = createVoiceDirector({ play: (entry) => global.AudioManager?.playVoice?.(entry) || false, stop: () => global.AudioManager?.stopVoice?.() });
  global.NMGVoiceDirector = director;
  // 兼容首批朝暮门禁，避免既有覆盖失效。
  global.NMGVoiceInternals = Object.freeze({ HERO_VOICES, VOICE_ASSET_MANIFEST, createVoiceDirector, LONGEVITY_VOICES, createLongevityVoiceDirector });
}(window));
