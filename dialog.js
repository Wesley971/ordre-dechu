// dialog.js - Fenêtre de dialogue : texte qui s'écrit lettre par lettre, et choix
// Une page est une chaîne HTML, ou { html, sfx } pour jouer un son à l'ouverture de la page

const Dialog = {
  onConfirm: null, // réaction à « Valider » : finir d'écrire la page, ou passer à la suivante

  open(title) {
    $("#dialog-title").innerHTML = title;
    $("#dialog-title").hidden = !title;
    $("#dialog").hidden = false;
    Input.push(action => {
      if (action === "confirm" && this.onConfirm) this.onConfirm();
    });
  },

  close() {
    Input.pop();
    this.onConfirm = null;
    $("#dialog").hidden = true;
  },

  async show({ title = "", pages }) {
    this.open(title);
    for (const page of pages) {
      const { html, sfx } = typeof page === "string" ? { html: page } : page;
      if (sfx) Sfx.play(sfx);
      await this.type(html);
      await this.waitForNext();
    }
    this.close();
  },

  // Pose une question ; options : [{ id, label }] · renvoie l'id de l'option choisie
  async choose({ title = "", text, options }) {
    this.open(title);
    await this.type(text);

    const list = $("#dialog-choices");
    const items = options.map(option => {
      const item = document.createElement("li");
      item.className = "menu-item";
      item.textContent = option.label;
      return item;
    });
    list.replaceChildren(...items);
    list.hidden = false;
    const index = await pickOption(items, { preselect: false }); // Valider seul ne peut pas choisir par accident
    list.hidden = true;

    this.close();
    return options[index].id;
  },

  // Les balises sont recopiées d'un coup, le texte lettre par lettre ; « Valider » affiche tout
  type(html) {
    const text = $("#dialog-text");
    const tokens = html.split(/(<[^>]+>)/).filter(Boolean);
    let shown = "", tokenIndex = 0, charIndex = 0;
    $("#dialog-next").hidden = true;

    return new Promise(resolve => {
      const finish = () => {
        clearInterval(timer);
        text.innerHTML = html;
        this.onConfirm = null;
        resolve();
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

      this.onConfirm = finish;
    });
  },

  // Affiche ▼ et attend « Valider » pour passer à la suite
  waitForNext() {
    const next = $("#dialog-next");
    next.hidden = false;
    return new Promise(resolve => {
      this.onConfirm = () => {
        Sfx.play("cursor");
        next.hidden = true;
        this.onConfirm = null;
        resolve();
      };
    });
  },
};
