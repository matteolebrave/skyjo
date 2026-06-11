const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const host = window.location.hostname === "localhost"
    ? "localhost:8765"
    : window.location.host;

const ws = new WebSocket(`${protocol}//${host}/ws`);

console.log("protocol =", protocol);
console.log("host =", host);
console.log("url =", `${protocol}//${host}/ws`);
// 

let myName = null;
let gameOver = false;
let roundOver = false;

// Réception des messages du serveur
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("Reçu :", data);

    if (data.type === "your_name") {
        myName = data.name;
        console.log("Je suis :", myName);
    }
    else if (data.type === "game_start") {
        gameOver = false;
        roundOver = false;
        console.log("La partie commence !");
    }
    else if (data.type === "game_state") {
        if (!gameOver && !roundOver) updateUI(data);
    }
    else if (data.type === "phase_change") {
        console.log("Phase :", data.phase);
    }
    else if (data.type === "error") {
        alert("Erreur : " + data.message);
    }
    else if (data.type === "end_round") {
        roundOver = true;
        const game = document.getElementById("game");
        game.innerHTML = "<h2>Fin de manche !</h2>";

        // Scores
        const scores = document.createElement("ul");
        for (const [name, score] of Object.entries(data.scores)) {
            const li = document.createElement("li");
            li.textContent = name + " : " + score + " points";
            scores.appendChild(li);
        }
        game.appendChild(scores);

        // Grilles
        const playersGrid = document.createElement("div");
        playersGrid.style.display = "grid";
        playersGrid.style.gridTemplateColumns = "1fr 1fr";
        playersGrid.style.gap = "16px";
        playersGrid.style.marginBottom = "16px";

        for (const [name, hand] of Object.entries(data.hands)) {
            const section = document.createElement("div");
            section.className = "player-section";

            const title = document.createElement("h3");
            title.textContent = name;
            section.appendChild(title);

            const table = document.createElement("table");
            hand.forEach(row => {
                const tr = document.createElement("tr");
                row.forEach(card => {
                    const td = document.createElement("td");
                    td.textContent = card.value;
                    td.className = cardClass(card);
                    td.style.padding = "10px";
                    td.style.textAlign = "center";
                    tr.appendChild(td);
                });
                table.appendChild(tr);
            });
            section.appendChild(table);
            playersGrid.appendChild(section);
        }

        game.appendChild(playersGrid);

        // Bouton prêt
        const btn = document.createElement("button");
        btn.textContent = "Prêt pour la prochaine manche !";
        btn.className = "btn-ready";
        btn.onclick = () => {
            sendAction({ action: "ready" });
            btn.textContent = "En attente de l'autre joueur...";
            btn.disabled = true;
        };
        game.appendChild(btn);
    }
    else if (data.type === "game_over") {
        gameOver = true;
        const game = document.getElementById("game");
        game.innerHTML = "<h2>Partie terminée !</h2>";
        
        // Gagnant
        const winner = document.createElement("p");
        winner.textContent = "🏆 Gagnant : " + data.winner;
        game.appendChild(winner);

        // Scores
        const scores = document.createElement("ul");
        for (const [name, score] of Object.entries(data.scores)) {
            const li = document.createElement("li");
            li.textContent = name + " : " + score + " points";
            scores.appendChild(li);
        }
        game.appendChild(scores);

        // Grilles finales
        const playersGrid = document.createElement("div");
        playersGrid.style.display = "grid";
        playersGrid.style.gridTemplateColumns = "1fr 1fr";
        playersGrid.style.gap = "16px";
        playersGrid.style.marginBottom = "16px";

        for (const [name, hand] of Object.entries(data.hands)) {
            const section = document.createElement("div");
            section.className = "player-section";

            const title = document.createElement("h3");
            title.textContent = name;
            section.appendChild(title);

            const table = document.createElement("table");
            hand.forEach(row => {
                const tr = document.createElement("tr");
                row.forEach(card => {
                    const td = document.createElement("td");
                    td.textContent = card.value;
                    td.className = cardClass(card);
                    td.style.padding = "10px";
                    td.style.textAlign = "center";
                    tr.appendChild(td);
                });
                table.appendChild(tr);
            });
            section.appendChild(table);
            playersGrid.appendChild(section);
        }

        game.appendChild(playersGrid);

        // Bouton rejouer
        const btn = document.createElement("button");
        btn.textContent = "Rejouer !";
        btn.className = "btn-restart";
        btn.onclick = () => {
            sendAction({ action: "restart" });
            btn.textContent = "En attente de l'autre joueur...";
            btn.disabled = true;
        };
        game.appendChild(btn);
    }
    else if (data.type === "waiting") {
        document.getElementById("nbPlayersDiv").style.display = "none";
        document.getElementById("game").style.display = "block";
        document.getElementById("login").style.display = "none";
        const game = document.getElementById("game");
        game.innerHTML = `<p>En attente des joueurs... ${data.current}/${data.total}</p>`;
    }
    else if (data.type === "player_disconnected") {
        const game = document.getElementById("game");
        game.innerHTML = `
            <div style="text-align:center; padding: 2rem;">
                <h2>Connexion perdue</h2>
                <p>${data.name} s'est déconnecté.</p>
                <button class="btn-restart" onclick="location.reload()">
                    Retourner à l'accueil
                </button>
            </div>
        `;
    }
};

ws.onclose = () => {
    const game = document.getElementById("game");
    game.innerHTML = `
        <div style="text-align:center; padding: 2rem;">
            <h2>Connexion perdue</h2>
            <p>La connexion au serveur a été interrompue.</p>
            <button class="btn-restart" onclick="location.reload()">
                Retourner à l'accueil
            </button>
        </div>
    `;
};
// Envoi d'une action au serveur
function sendAction(action) {
    ws.send(JSON.stringify(action));
}

// Mise à jour de l'interface
function updateUI(state) {
    const game = document.getElementById("game");
    game.innerHTML = "";

    // Joueur courant
    const turn = document.createElement("p");
    turn.textContent = "Tour de : " + state.current_player;
    game.appendChild(turn);

    // Défausse et pioche
    const pile = document.createElement("div");
    pile.style.display = "flex";
    pile.style.gap = "16px";
    pile.style.alignItems = "center";
    pile.style.marginBottom = "16px";

    // Défausse
    const discardCard = document.createElement("div");
    discardCard.style.textAlign = "center";
    const discardLabel = document.createElement("p");
    discardLabel.textContent = "Défausse";
    discardLabel.style.fontSize = "0.8rem";
    discardLabel.style.color = "#5F5E5A";
    discardLabel.style.marginBottom = "4px";
    const discardTd = document.createElement("div");
    discardTd.className = state.discard_top !== null ? cardClass({visible: true, value: state.discard_top}) : "card hidden";
    discardTd.textContent = state.discard_top !== null ? state.discard_top : "?";
    discardCard.appendChild(discardLabel);
    discardCard.appendChild(discardTd);
    pile.appendChild(discardCard);

    const deckCard = document.createElement("div");
    deckCard.style.textAlign = "center";
    const deckLabel = document.createElement("p");
    deckLabel.textContent = "Pioche";
    deckLabel.style.fontSize = "0.8rem";
    deckLabel.style.color = "#5F5E5A";
    deckLabel.style.marginBottom = "4px";
    const deckTd = document.createElement("div");
    deckTd.className = "card hidden";
    deckTd.textContent = "?";

    deckCard.appendChild(deckLabel);
    deckCard.appendChild(deckTd);
    pile.appendChild(deckCard);

    // Carte piochée
    if (state.drawn_card !== null) {
        const drawnCard = document.createElement("div");
        drawnCard.style.textAlign = "center";
        const drawnLabel = document.createElement("p");
        drawnLabel.textContent = "En main";
        drawnLabel.style.fontSize = "0.8rem";
        drawnLabel.style.color = "#5F5E5A";
        drawnLabel.style.marginBottom = "4px";
        const drawnTd = document.createElement("div");
        drawnTd.className = cardClass({visible: true, value: state.drawn_card});
        drawnTd.textContent = state.drawn_card;
        drawnTd.style.display = "flex";
        drawnTd.style.alignItems = "center";
        drawnTd.style.justifyContent = "center";
        drawnCard.appendChild(drawnLabel);
        drawnCard.appendChild(drawnTd);
        pile.appendChild(drawnCard);
    }

    game.appendChild(pile);

    // Main de chaque joueur
    const playersGrid = document.createElement("div");
    playersGrid.style.display = "grid";
    playersGrid.style.gridTemplateColumns = "1fr 1fr";
    playersGrid.style.gap = "16px";
    playersGrid.style.marginBottom = "16px";

    for (const [name, hand] of Object.entries(state.hands)) {
        const section = document.createElement("div");
        section.className = "player-section" + (name === state.current_player ? " active" : "");

        const title = document.createElement("h3");
        title.textContent = name + (name === myName ? " (moi)" : "") + " — " + state.scores[name] + " pts";
        section.appendChild(title);

        const table = document.createElement("table");
        hand.forEach((row, rowIndex) => {
            const tr = document.createElement("tr");
            row.forEach((card, colIndex) => {
                const td = document.createElement("td");
                td.textContent = card.visible ? card.value : "?";
                td.className = cardClass(card);
                td.style.padding = "10px";
                td.style.cursor = "pointer";
                td.style.minWidth = "30px";
                td.style.textAlign = "center";

                if (name === myName) {
                    td.onclick = () => {
                        if (state.drawn_card !== null) {
                            sendAction({ action: "place_card", row: rowIndex, col: colIndex });
                        } else if (!card.visible) {
                            sendAction({ action: "reveal_card", row: rowIndex, col: colIndex });
                        }
                    };
                    if (state.drawn_card !== null || state.must_reveal) {
                        td.style.backgroundColor = "#90EE90";
                    }
                    if (card.visible) {
                        td.style.cursor = "default";
                    }
                }
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });
        section.appendChild(table);
        playersGrid.appendChild(section);
    }

    game.appendChild(playersGrid);

    // Boutons d'action
    const actions = document.createElement("div");
    console.log("state.drawn_from =", state.drawn_from);
    // Piocher — caché si carte déjà piochée
    if (state.drawn_card === null) {
        const btnDeck = document.createElement("button");
        btnDeck.className = "btn-deck";
        btnDeck.textContent = "Piocher";
        btnDeck.onclick = () => sendAction({ action: "draw_deck" });
        actions.appendChild(btnDeck);
    }

    // Prendre la défausse — caché si carte déjà piochée
    if (state.drawn_card === null) {
        const btnDiscard = document.createElement("button");
        btnDiscard.className = "btn-discard";
        btnDiscard.textContent = "Prendre la défausse";
        btnDiscard.onclick = () => sendAction({ action: "draw_discard" });
        actions.appendChild(btnDiscard);
    }

    // Défausser — caché si carte vient de la défausse
    if (state.drawn_card !== null && state.drawn_from !== "discard") {
        const btnDefausser = document.createElement("button");
        btnDefausser.className = "btn-defausser";
        btnDefausser.textContent = "Défausser la carte piochée";
        btnDefausser.onclick = () => sendAction({ action: "discard_drawn" });
        actions.appendChild(btnDefausser);
    }

    game.appendChild(actions);
}

function joinGame() {
    const input = document.getElementById("nameInput").value.trim();
    if (!input) return;
    const nbPlayers = document.getElementById("nbPlayers").value;
    sendAction({ action: "join", name: input, nb_players: parseInt(nbPlayers) });
    document.getElementById("login").style.display = "none";
    document.getElementById("game").style.display = "block";
}

function cardClass(card) {
    if (!card.visible) return "card hidden";
    if (card.value < 0) return "card val-neg";
    if (card.value === 0) return "card val-zero";
    if (card.value <= 4) return "card val-low";
    if (card.value <= 8) return "card val-mid";
    if (card.value <= 10) return "card val-high";
    return "card val-max";
}

function resetServer() {
    fetch('/reset')
        .then(() => alert("Serveur réinitialisé ! Vous pouvez relancer une partie."))
        .catch(() => alert("Erreur lors de la réinitialisation."));
}