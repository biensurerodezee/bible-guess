import { LitElement, html } from 'https://esm.sh/lit';
import api from './bible-api.js';

export class BibleGuessGame extends LitElement {
  static properties = {
    verses: { type: Array },
    currentVerse: { type: Object },
    score: { type: Number },
    timeLeft: { type: Number },
    feedbackVisible: { type: Boolean },
    feedbackStatus: { type: String }, // 'correct', 'wrong', 'skipped'
    feedbackMessage: { type: String },
    gameEnded: { type: Boolean }
  };

  constructor() {
    super();
    this.verses = [];
    this.score = 0;
    this.timeLeft = 180;
    this.feedbackVisible = false;
    this.feedbackStatus = '';
    this.feedbackMessage = '';
    this.gameEnded = false;
    this.currentVerse = {};
    this._timerInterval = null;
  }

  createRenderRoot() {
    return this; // Render into light DOM so Tailwind works
  }

  async loadVerses() {
    try {
      // read api info to get a random book
      const lang = 'en'; // 'pt', 'fr', 'es'
      const randomBB = api.books[Math.floor(Math.random()*api.books.length)];  
      const response = await fetch(
        'https://raw.githubusercontent.com/biensurerodezee/bible/main/'+lang+'/'+randomBB.id+'/'+randomBB.id+'.json'
      );
      const data = await response.json();
      const chapterIndex = Math.floor(Math.random()*data.chapters.length);
      const chapter = data.chapters[chapterIndex];
      // Map each verse to an object with a `text` and `book` field
      this.verses = chapter.map((verse, verseIndex) => ({
        text: verse,
        book: randomBB[lang],
        chapterNumber: chapterIndex + 1,
        verseNumber: verseIndex + 1,
        language: lang,
      }));
      this.requestUpdate();
    } catch (err) {
      console.error('Failed to load verses:', err);
      this.verses = [
        { text: "Error, could not find this book id on the API:", book: randomBB.id }
      ];
    }
  }

  async connectedCallback() {
    super.connectedCallback();
    await this.loadVerses();
    this.startGame();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._timerInterval);
  }

  async updated(changedProperties) {
    // prepare a new set of verses to choose from, for the next round
    if (changedProperties.has('currentVerse')) {
      await this.loadVerses();
    }
  }

  startGame() {
    this.nextVerse();
    this._timerInterval = setInterval(() => {
      if (this.timeLeft > 0) {
        this.timeLeft--;
        this.requestUpdate();
      } else {
        clearInterval(this._timerInterval);
        this.endGame();
      }
    }, 1000);
  }

    nextVerse() {
      this.feedbackVisible = false;
      this.feedbackStatus = '';
      this.feedbackMessage = '';
      this.currentVerse = this.verses[Math.floor(Math.random() * this.verses.length)];
      console.log("this.currentVerse", this.currentVerse);

      this.updateComplete.then(() => {
        const input = this.querySelector('#guess');
        if (input) input.value = '';
      });
    }

    submitGuess() {
      if (this.feedbackVisible || this.gameEnded) return;

        const input = this.querySelector('#guess');
        const guess = input?.value.trim();
        if (!guess) return;

      if (guess.toLowerCase() === this.currentVerse.book.toLowerCase()) {
        this.score++;
        this.feedbackStatus = 'correct';
        this.feedbackMessage = '✅ Correct!';
      } else {
        this.feedbackStatus = 'wrong';
        this.feedbackMessage = `❌ Wrong! Correct book: ${this.currentVerse.book}`;
      }

      // Show feedback *after DOM is stable*
      this.updateComplete.then(() => {
        this.feedbackVisible = true;
        this.requestUpdate();
      });
    }


  skipVerse() {
    if (this.feedbackVisible || this.gameEnded) return;
    this.feedbackStatus = 'skipped';
    this.feedbackMessage = `⏭ Skipped! Correct book: ${this.currentVerse.book}`;
    this.feedbackVisible = true;
    this.requestUpdate();
  }

  endGame() {
    this.gameEnded = true;
    this.feedbackStatus = 'ended';
    this.feedbackMessage = `⏰ Time's up! Final score: ${this.score}`;
    this.feedbackVisible = true;
    this.requestUpdate();
  }

    render() {
      const minutes = Math.floor(this.timeLeft / 60).toString().padStart(2, '0');
      const seconds = (this.timeLeft % 60).toString().padStart(2, '0');
      const feedbackClass = this.feedbackStatus === 'correct'
        ? 'border-green-500 text-green-600'
        : this.feedbackStatus === 'wrong' || this.feedbackStatus === 'skipped'
        ? 'border-red-500 text-red-600'
        : '';

      return html`
        <div class="fixed top-3 right-5 text-xl font-bold" id="timer">${minutes}:${seconds}</div>
        <div class="fixed top-3 left-5 text-blue-600 underline cursor-pointer" id="skip" @click="${this.skipVerse}">⏭ Skip</div>
        <div class="text-2xl mx-6 my-12" id="verse">
            &nbsp;
        </div>
        <div class="text-2xl mx-6 my-12 text-center" id="verse">
          ${this.currentVerse.chapterNumber ? `${this.currentVerse.chapterNumber}` : '.'}:${this.currentVerse.verseNumber ? `${this.currentVerse.verseNumber}` : '.'}
          ${this.currentVerse.text ? `"${this.currentVerse.text}"` : 'Loading verse...'}
        </div>

        ${!this.feedbackVisible && !this.gameEnded
          ? html`
              <div class="flex items-center justify-center gap-2 mt-4">
                <input
                  id="guess"
                  type="text"
                  placeholder="Type the Bible book here..."
                  class="border px-3 py-2 rounded w-72"
                  @keydown="${e => { if (e.key === 'Enter') this.submitGuess(); }}"
                />
                <button
                  @click="${this.submitGuess}"
                  class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                >
                  Submit
                </button>
              </div>
            `
          : html``}

        <div class="mt-6 text-lg" id="score">Correct: ${this.score}</div>

        ${this.feedbackVisible
          ? html`
              <div
                id="feedback"
                class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white bg-opacity-90 border-4 rounded-xl px-8 py-6 shadow-xl text-2xl z-50 text-center ${feedbackClass}"
              >
                <div>${this.feedbackMessage}</div>
                ${this.feedbackStatus !== 'ended'
                  ? html`<button
                      @click="${this.nextVerse}"
                      class="mt-5 bg-gray-800 text-white px-5 py-2 rounded hover:bg-gray-900 text-lg"
                    >
                      Next
                    </button>`
                  : ''}
              </div>
            `
          : ''}
      `;
    }

}

customElements.define('bible-guess-game', BibleGuessGame);

