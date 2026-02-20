const HIGH_SCORE_KEY = 'zombie-shooter-highscore';

export class Screens {
  constructor() {
    this.el = {
      loading: document.getElementById('loading-screen'),
      loadingFill: document.getElementById('loading-fill'),
      menu: document.getElementById('menu-screen'),
      pause: document.getElementById('pause-screen'),
      gameover: document.getElementById('gameover-screen'),
      finalScore: document.getElementById('final-score'),
      finalStats: document.getElementById('final-stats'),
      newHighScore: document.getElementById('new-high-score'),
      menuHighScore: document.getElementById('menu-high-score'),
      controlsHint: document.getElementById('controls-hint'),
    };

    // Buttons
    this.btnPlay = document.getElementById('btn-play');
    this.btnHow = document.getElementById('btn-how');
    this.btnResume = document.getElementById('btn-resume');
    this.btnQuit = document.getElementById('btn-quit');
    this.btnRestart = document.getElementById('btn-restart');
    this.btnMenu = document.getElementById('btn-menu');

    this.highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
    this._showingControls = false;
  }

  // Callbacks
  onPlay = null;
  onResume = null;
  onQuit = null;
  onRestart = null;
  onMenu = null;

  init() {
    this.btnPlay.addEventListener('click', () => {
      if (this.onPlay) this.onPlay();
    });

    this.btnHow.addEventListener('click', () => {
      this._showingControls = !this._showingControls;
      this.el.controlsHint.style.color = this._showingControls ? '#aab' : '#445';
    });

    this.btnResume.addEventListener('click', () => {
      if (this.onResume) this.onResume();
    });

    this.btnQuit.addEventListener('click', () => {
      if (this.onQuit) this.onQuit();
    });

    this.btnRestart.addEventListener('click', () => {
      if (this.onRestart) this.onRestart();
    });

    this.btnMenu.addEventListener('click', () => {
      if (this.onMenu) this.onMenu();
    });

    this._updateHighScoreDisplay();
  }

  _updateHighScoreDisplay() {
    if (this.highScore > 0) {
      this.el.menuHighScore.textContent = `HIGH SCORE: ${this.highScore.toLocaleString()}`;
    } else {
      this.el.menuHighScore.textContent = '';
    }
  }

  setLoadingProgress(pct) {
    this.el.loadingFill.style.width = pct + '%';
  }

  showLoading() {
    this._hideAll();
    this.el.loading.classList.remove('hidden');
  }

  showMenu() {
    this._hideAll();
    this._updateHighScoreDisplay();
    this.el.menu.classList.remove('hidden');
  }

  showPause() {
    this.el.pause.classList.remove('hidden');
  }

  hidePause() {
    this.el.pause.classList.add('hidden');
  }

  showGameOver(stats) {
    this._hideAll();
    this.el.gameover.classList.remove('hidden');

    const score = stats.score || 0;
    this.el.finalScore.textContent = score.toLocaleString();

    // Stats
    this.el.finalStats.innerHTML = [
      `Wave Reached: ${stats.wave}`,
      `Zombies Killed: ${stats.kills}`,
      `Accuracy: ${stats.accuracy.toFixed(1)}%`,
      `Highest Combo: ${stats.highestCombo}x`,
    ].join('<br>');

    // High score check
    if (score > this.highScore) {
      this.highScore = score;
      localStorage.setItem(HIGH_SCORE_KEY, score.toString());
      this.el.newHighScore.classList.remove('hidden');
    } else {
      this.el.newHighScore.classList.add('hidden');
    }
  }

  _hideAll() {
    this.el.loading.classList.add('hidden');
    this.el.menu.classList.add('hidden');
    this.el.pause.classList.add('hidden');
    this.el.gameover.classList.add('hidden');
  }

  hideAll() {
    this._hideAll();
  }
}
