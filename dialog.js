// dialog.js - Fenêtre de dialogue avec texte qui s'écrit lettre par lettre
// Une page est une chaîne HTML, ou { html, sfx } pour jouer un son à l'ouverture de la page

const Dialog = {
  advance: null, // passe à la suite : termine la page en cours ou la ferme

  async show({ title = "", pages }) {
    const box = $("#dialog");
    $("#dialog-title").innerHTML = title;
    $("#dialog-title").hidden = !title;
    box.hidden = false;
    Input.push(action => {
      if (action === "confirm" && this.advance) this.advance();
    });

    for (const page of pages) {
      const { html, sfx } = typeof page === "string" ? { html: page } : page;
      if (sfx) Sfx.play(sfx);
      await this.typePage(html);
    }

    Input.pop();
    box.hidden = true;
  },

  typePage(html) {
    const text = $("#dialog-text");
    const next = $("#dialog-next");
    // Les balises sont recopiées d'un coup, le texte lettre par lettre
    const tokens = html.split(/(<[^>]+>)/).filter(Boolean);
    let shown = "", tokenIndex = 0, charIndex = 0, typing = true;
    next.hidden = true;

    return new Promise(resolve => {
      const finish = () => {
        clearInterval(timer);
        text.innerHTML = html;
        typing = false;
        next.hidden = false;
      };

      const timer = setInterval(() => {
        while (tokenIndex < tokens.length && tokens[tokenIndex].startsWith("<")) {
          shown += tokens[tokenIndex++];
        }
        if (tokenIndex < tokens.length) {
          const token = tokens[tokenIndex];
          shown += token[charIndex++];
          if (charIndex >= token.length) { tokenIndex++; charIndex = 0; }
        }
        text.innerHTML = shown;
        if (tokenIndex >= tokens.length) finish();
      }, CONFIG.timing.typewriter);

      this.advance = () => {
        if (typing) return finish();
        Sfx.play("cursor");
        this.advance = null;
        resolve();
      };
    });
  },
};
