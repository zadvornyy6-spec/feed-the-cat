import * as Game from "./game.js";
import * as UI from "./ui.js";

function bindGameHooks() {
  Game.setHooks({
    toast: UI.toast,

    audioPlay: (name) => UI.AudioManager.play(name),

    fxFed: (xp) => {
      const center = UI.getCatCenter();
      UI.FXManager.feedFX(center.x, center.y, xp);
    },

    fxLevel: () => {
      UI.vibrate([20, 40, 30]);
      const center = UI.getCatCenter();
      UI.FXManager.levelFX(center.x, center.y);
    },

    fxSkinLevel: () => {
      UI.vibrate([15, 30, 20]);
      const center = UI.getCatCenter();
      UI.FXManager.skinLevelFX(center.x, center.y);
    },

    fxCook: () => {
      const center = UI.getCatCenter();
      UI.FXManager.cookFX(center.x, center.y);
    },

    fxBossHit: (damage) => {
      UI.fxBossHit(damage);
    },

    fxPrestige: () => {
      UI.vibrate([30, 40, 30, 40, 60]);
      const center = UI.getCatCenter();
      UI.FXManager.prestigeFX(center.x, center.y);
    },

    shakeScreen: UI.shakeScreen,

    renderAll: UI.renderAll,
    renderHUD: UI.renderHUD,
    renderBuffBar: UI.renderBuffBar,
    renderQuickFeed: UI.renderQuickFeed,
    updateCatAppearance: UI.updateCatAppearance,
    refreshCurrentModal: UI.refreshCurrentModal,
    renderTutorial: UI.renderTutorial,

    openBossFight: UI.openBossFight,
    updateBossFightUI: UI.updateBossFightUI,
    showBossResult: UI.showBossResult,
    showGachaResults: UI.showGachaResults,
    showTutorialReward: UI.showTutorialReward,
    musicPause: () => UI.MusicManager.pause(),
    musicResume: () => UI.MusicManager.resume(),
  });
}

function startLoop() {
  let lastFrame = performance.now();

  function loop(now) {
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;

    if (!document.hidden) {
      Game.update(dt);
      UI.FXManager.frame(dt);
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

async function bootstrap() {
  const loadingPromise = UI.Loading.simulate();

  UI.armAudioUnlock(); // вешаем «липкий» слушатель звука ДО initGame,
                       // чтобы ранний тап (выбор языка на медленном старте по вайфаю) не пропал
  await Game.initGame();

  bindGameHooks();
  UI.initUI();

  await loadingPromise;

  Game.Platform.loadingReady();
  UI.Loading.hide();

  Game.Platform.logEvent("game_start", {
    level: Game.state.global.player_level,
    prestige: Game.state.global.prestige_count,
  });

  Game.SaveManager.save();

  startLoop();
}

bootstrap().catch((err) => {
  console.error("Init failed", err);

  const text = document.querySelector("#load-text");

  if (text) {
    text.textContent = Game.t("loadError");
  }
});