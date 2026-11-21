# ANALISI PROGETTO — Mirror "Chess Free" (CrazyGames)

> Analisi completa di tutte le schermate e funzionalità del progetto presente in questo repository.
> Scopo: valutare cosa può essere riutilizzato / rimosso / aggiunto / modificato per trasformare il progetto in una **beta mobile-friendly per lezioni di scacchi individuali** (stanza privata + scacchiera condivisa + link esterno per audio/video).

---

## 1. Che cosa è questo repository

Il repo **non è un'app di scacchi modificabile**, ma un **mirror (copia) dell'intera pagina web di CrazyGames** del gioco *"Chess Free"* di Smartberry, con tutto l'ecosistema di advertising/tracking catturato durante l'acquisizione.

Struttura:

```
repo-chess/
├── .github/workflows/extract-project.yml   # CI che estrae lo zip in audit-extracted/
├── www.crazygames.com.zip                  # archivio originale del mirror (556 file, ~41 MB)
└── audit-extracted/                        # mirror estratto, ~110 domini
    ├── FILE-MANIFEST.txt                   # elenco dei 556 file acquisiti
    ├── www.crazygames.com/                 # pagina portale del gioco (Next.js)
    ├── builds.crazygames.com/              # gameframe CrazyGames (wrapper React v2.14.3)
    ├── chess-free.game-files.crazygames.com/chess-free/375/   # ★ IL GIOCO VERO E PROPRIO
    ├── _DataURI/                           # asset inline (data URI)
    └── ~100 cartelle di rete pubblicitarie/tracking (doubleclick, criteo, pubmatic, …)
```

Il gioco vero è solo questa cartella:

```
chess-free.game-files.crazygames.com/chess-free/375/
├── index.html
└── assets/
    ├── main-osqZAit2.js                  # bundle React (5,1 MB, minificato)
    ├── analytics-BHBrV_Gj.js             # SDK analytics (435 KB) — GA + Metrika
    ├── main-Cv7OJqtW.css                 # stili (476 KB)
    ├── BoardCellFigureMoves-Q5bXcpw7.css # animazioni movimento pezzi
    ├── Move-CX0pz_x1.wav                 # suono mossa
    └── Capture-BEU4p7FD.wav              # suono cattura
```

---

## 2. ⚠️ STATO DEL MIRROR: INCOMPLETO E NON ESEGUIBILE

Verifica effettuata confrontando i file referenziati nel bundle con i file presenti:

| Risorsa | Referenziati nel bundle | Presenti nel mirror |
|---|---|---|
| Chunk JS lazy (modali, traduzioni, motore, libro aperture, skins) | **~120** | **0** (solo `main` + `analytics`) |
| Motore scacchistico (`engine.js` / `engine.wasm.js`, worker UCI) | 2 | **0** |
| Libro aperture (`debutTree-DqOa8MU9.js`) | 1 | **0** |
| Traduzioni 14 lingue (`app.*.translations`, `base.*.translations`) | ~28+ | **0** |
| Set di pezzi/skins (~90 design, `k-/q-/r-/n-/b-/p-/w-*.png|webp`) | ~90 | **0** |
| Suoni mp3 (bonus, undo, gemme, emozioni, musica di sottofondo) | ~15+ | **0** (solo 2 wav) |

**Conseguenza pratica:** aprendo `index.html` il gioco si arresta dopo il bundle principale: tutte le schermate (modali) sono chunk lazy mancanti, il motore AI non c'è, le traduzioni no. **Il mirror non è un punto di partenza eseguibile.** Modificare un bundle minificato da 5 MB per "ritagliarlo" non è realistico: la strategia corretta è **ricostruire un'app minima** riusando le conoscenze di domain (regole, flussi, protocollo) documentate in questo file.

---

## 3. Stack tecnologico del gioco originale

| Livello | Tecnologia |
|---|---|
| UI | **React 19.2.5** + **Mantine v7** (AppShell, modali) |
| Build | **Vite** (SPA TSX, code-splitting con chunk lazy) |
| Regole scacchi | **chess.js** (bundled: arrocamento, en passant, promozione, patta per ripetizione/50 mosse/materiale insufficiente, PGN/FEN) |
| Motore AI | worker UCI (`engine.js` / `engine.wasm.js`) — Stockfish compilato [inferred da opzioni `MultiPV`, `Skill Level`, `copyprotection`] |
| Drag & drop | **react-dnd** |
| Stato | **EasyPeasy** (wrapper Redux) + **Zod** (validazione protocollo) |
| Board | DOM/CSS (49 keyframe di traslazione per lo slide dei pezzi), canvas solo per frecce suggerimento |
| Networking | **WebRTC data channel** + signaling WebSocket (`wss://netlib.poki.io`) + STUN Google |
| Persistenza | cloud save REST (`GET/POST /data/{game}/{player}`) + localStorage |
| PWA | nessuna nel gioco (il portale ha un suo service worker) |

---

## 4. Modalità di gioco (enum esatto dal codice)

Enum `gameType` nel bundle: `Single, AI, FakeOnline, TogetherOnline, Together, Online`.

1. **Gioca col computer (Single/AI)** — 21 livelli di difficoltà (vedi §7).
2. **Gioca online (Online)** — matchmaking pubblico con politica rating (delta ELO 250–2000), conferma avversario 15 s.
3. **Online con amici (TogetherOnline)** — P2P via link invito / game ID / dalla chat (`ConnectionByInviteLinkModal`, `ConnectionByPeerIdModal`).
4. **Gioca insieme stesso dispositivo (Together)** — hotseat: "Usi l'app come una scacchiera per giocare insieme?" (modalità senza server — base concettuale utile).
5. **Puzzle di matto (Puzzles)** — puzzle a tema, punteggio, rank, episodi con guida.
6. **"FakeOnline" (bot "Maio")** — dopo 30 s di matchmaking fallito viene creato un bot finto-umano (timing umano, emoji, abbandono, patta). Inganno UX da **rimuovere** assolutamente in un prodotto di lezioni.
7. **Spettatore (WatchingGame)** — guardare la partita live di un contatto dalla chat.
8. **Analisi post-partita (GameAnalyze)** — valutazione mosse (4 "Excellent" … -4 "Losing"), replay, "gioca da qui".
9. **Handicap** — opzione di svantaggio (feature flag `handicap`).

---

## 5. Schermate e interfaccia (inventario completo)

Shell: `AppShell` Mantine (variante anche `tv`). Stati schermo nell'enum: `Menu, NewGame, InGame, AfterGame, GameAISettings, GameFriendSettings, GameSingleSettings, GameAnalyze, WatchingGame`.

### 5.1 Menu / impostazioni partita
| Schermata | Contenuto |
|---|---|
| Menu principale | voci: gioca col computer, gioca online, online con amici, gioca insieme, puzzle |
| `GameSingleSettingsModal` | setup partita vs computer |
| `GameAISettingsModal` | "Scegli un avversario" — livello AI |
| `GameFriendSettingsModal` | setup partita con amico (tempo, colore) |
| `GameCustomizeBoardModal` / `BoardSettingsModal` | personalizzazione: `boards / figures / dices / brightness` |
| `PublicLobbySettings` | crea lobby pubblica, politica rating |
| `OnlineTogetherModeSelectModal` | scelta modalità connessione amico |
| `OnlineGameStatusModal` / `OnlineTogetherGameStatusModal` | stato ricerca avversario, conferma match |
| `RulesModal` / `ChessRulesModal` | regole degli scacchi (pagine swipe) |
| `LangSettingsModal` | 18 lingue (en/ru inline, 14 via chunk mancanti) |
| `TimeFormatDetailsModal` | "{{0}} min. a partita +{{1}} sec. per mossa" |

### 5.2 Connessione / inviti
| Schermata | Contenuto |
|---|---|
| `ConnectionByInviteLinkModal` | "La partita partirà appena l'invitato apre il link" |
| `ConnectionByPeerIdModal` | connessione per ID ("inserisci ID per connetterti") |
| `OnlineTogetherFromChatModal` | invito partita dalla chat |

### 5.3 Fine partita
| Schermata | Contenuto |
|---|---|
| `GameResultModal` (+icon, +after-load) | vittoria/sconfitta/patta, vittoria bianchi/neri |
| `ConfirmVictoryModal` / `ConfirmDefeatModal` | conferma esito |
| `ConfirmGameQuitModal` / `ConfirmExitModal` | conferma uscita |
| `ConfirmRematchRequestModal` | "Accetti la rivincita?" |
| `RejectedByOpponentModal` | rifiuto avversario |
| `RatingChangeDetailsModal` | variazione ELO "calcolata secondo il sistema ELO" |

### 5.4 Social / profilo
| Schermata | Contenuto |
|---|---|
| `ChatModal` + `ChatSelectModal` | chat "1 on 1" + "Generale", reazioni emoji con suoni, censura, blocco |
| `UserProfileModal` | statistiche: partite, vittorie, rating massimo |
| `AvatarPickerModal` / `AvatarDetailsModal` | upload avatar, avatar DiceBear, reset |
| `AdminDetailsModal` | dettagli admin |
| `LeaderboardModal` | classifiche rating/punti/cash, periodi giorno/settimana/mese |
| `LeaguesModal` | leghe Bronze→Elite, "Rank: {{rankName}}" |
| `SchedulersModal` | eventi pianificati GamePush |

### 5.5 Monetizzazione
| Schermata | Contenuto |
|---|---|
| `PaymentsModal` / `PaymentSuccessModal` / `PaymentErrorModal` | acquisti |
| `PremiumModal` (+`PremiumTime`) | premium: monete/gemme giornaliere, avatar oro, tutti i design, **no-ad**, supporto prioritario |
| `CashValueIsZeroModal` | saldo scommessa insufficiente ("almeno 10 monete per puntare") |
| `RewardAcceptModal` / `RewardedVideoErrorModal` (+adblock) | video reward |

### 5.6 Sistema / in-game
| Schermata | Contenuto |
|---|---|
| `PromotionFigureSelector` | selezione pezzo promozione (dama/torre/alfiere/cavallo) |
| `AFKCancelGameModal` | "Sei ancora con noi?" (timeout 90 s / 15 s) |
| `DeleteLastSavedGameModal`, `CustomContinueModal`, `PlayerSaveStatus` | gestione salvataggi |
| Pannello mosse | tab "Moves", `GameHistory-button` |
| Pannello chat in-game | toggle show/hide chat |
| Frecce suggerimento | canvas overlay, MultiPV 3, "Generate hints" |
| Dialog emoji/reazioni | `open_emoji_dialog` |
| Condivisione | "By link" + screenshot board (html2canvas) |
| Banner pubblicitari | `cg-banner-bottom`, `cg-banner-right`, `crazy-games-banner` (970×90 / 728×90) |

---

## 6. Funzionalità di gioco (inventario)

- **Regole complete** via chess.js: arrocamento, en passant, promozione, stallo, ripetizione, 50 mosse, materiale insufficiente, PGN/FEN.
- **Orologi**: `untimed` | `sports-v1` (secondi partita + incremento) | `casual-turn-v1` (turni + riserva); preset bullet/blitz/rapid/classic (max 1800 s + 20 s).
- **Suggerimenti (hint)**: frecce motore; in online il contrario può chiedere hint (`hintRequest`, Allow/Reject); hint sbloccabili anche con video reward.
- **Annulla mossa (undo/takeback)**: "tua mossa e la risposta"; anche via reward; online con richiesta al contrario.
- **Resa**: "Vuoi abbandonare?"; soglie di resa AI per livello.
- **Patta**: proposta patta, `draw_by_agreement`.
- **Rivincita**: protocollo coordinato `coordinated-rematch-v1`.
- **Rating ELO + leghe** Bronze/Silver/Gold/Platinum/Diamond/Elite; penalità desertione.
- **Salvataggi**: cloud `GET/POST /data/{game}/{player}` + cronologia partite.
- **Analisi post-partita**: etichette qualità mosse (Excellent→Losing), replay, "play from here".
- **Skins**: ~90 design pezzi + temi board + luminosità, bloccati dietro gemme/ads/premium.
- **Giocatori**: nickname generati (13 dizionari), avatar upload/DiceBear, cornice oro premium.
- **Chat**: 1-on-1 + generale, censura, blocco utenti, reazioni emoji con audio, rate limit, gate punteggio.
- **Scommesse**: puntata oro sulle partite online (`betSize`, tassa).
- **Economia**: oro, monete, gemme, bonus giornaliero, doppio bonus via ad.
- **Condivisione**: link partita + screenshot scacchiera.
- **Protezione AFK** + blocco multi-tab; sostituzione avversario con bot se esce (`replaceGameByCriminal`).
- **Feedback errori**: report con screenshot automatico.
- Nessun import FEN/PGN da UI; nessun tutorial strutturato.

---

## 7. Avversario AI

- Worker UCI (JS + fallback WASM), opzioni `MultiPV`, `Skill Level`, `Move Overhead`; ricerca `go depth N / movetime / wtime btime winc binc` + analisi infinita per gli hint.
- **21 livelli** con tabella completa esposta nel codice: `NoviceLvl1` (100 Elo, mosse casuali da libro aperture) → … → `Grandmaster` (2550, depth 13) → `WorldChampion` (2850, depth 17) → `AI` (3000, skill 20, depth 20). Ogni livello: rating, skill UCI, depth, uso libro aperture, finestra errore (`delta` centipawn) e probabilità (`yawn`).
- Libro aperture pesato (`debutTree`) per i livelli deboli.
- **Strato "finto umano" (Maio)**: spread tempi mossa, probabilità abbandono 75–100 %, emoji, probabilità patta, rating ±250 — finge di essere una persona reale.

---

## 8. Multiplayer / rete

- **Trasporto**: WebRTC data channels con signaling su `wss://netlib.poki.io/v0/signaling` (host configurabile via flag `netlib_host`) + `/v0/channels?apikey=…`; admission REST con ticket; STUN `stun:stun.l.google.com:19302`. ID peer `usr…`, room `grp…`.
- **Matchmaking**: discovery lobby con filtro `{playerCount:1, activeSearch:true}`, politica rating, conferma match 15 s.
- **Protocollo v2** (Zod): eventi `opponent-connected, make-move, move-ended, make-emotion, casual-clock-owner-state, game-ended, connection-closing, match-recovery, coordinated-rematch, ready, newStageStarted, arenaReady`; capability `match-recovery-v1` (riconnessione con recupero posizione), `coordinated-rematch-v1`; campi `matchId / moveId / moveSequence`.
- **Robustezza**: retry/ack delle mosse con timeout, UI "Reconnecting"/"Connection restored", scadenza room ("The room has already expired").
- **Backend chat/salvataggi**: REST firmato (`X-Player-Secret`, `X-Signature`) su `user-service.myhd.info` e host netlib; chat generale + personale per progetti autorizzati (11406 incluso).
- **Presenza**: `Offline / ACTIVE_SEARCH_CONNECTING / ACTIVE_SEARCH / WAIT_FRIEND / GAME_PLAY / GAME_PLAY_ENDED`.

---

## 9. Integrazioni esterne (da rimuovere in un contesto privato)

| Integrazione | Dettagli |
|---|---|
| CrazyGames SDK | user, gameplayStart/Stop, happytime, banner, inviti — fornita dal gameframe |
| Poki SDK | `game-cdn.poki.com/scripts/v2/poki-sdk.js`, signaling netlib |
| GamePush (project 11406) | `gamepush.com`, `gs.eponesh.com`, `s3.gamepush.com`: rewards, achievements, pagamenti, storage, scheduler |
| Playgama | ads `partners.v0.2.js`, bridge nativo |
| Jogos | `jogos-sdk-v1.js`, gameId 10191, ads midgame |
| Yandex Games + Metrika | counter 93916599 (webvisor), storage `storage.yandexcloud.net` |
| Discord Activities | opcodes embedded app, permessi canale |
| VK / OK.ru | avatar, CSP `vkcors:` |
| Google Analytics | gtag |
| Sentry | 2 DSN `o187844.ingest.us.sentry.io` (nel gameframe) |
| ConfigCat | esperimenti A/B |
| Google IMA + Prebid | video ads, header bidding, banner, adblock detection |
| Backend proprietario | `user-service.myhd.info` (leaderboard, scheduler, bootstrap) |
| DiceBear | avatar API |

Il **gameframe** CrazyGames (React v2.14.3) gestisce: loading bar con messaggi rotanti, orchestrazione ads IMA/prebid (interstitial, rewarded, banner), detection adblock, glue SDK, inviti, relay analytics, Sentry.

Il **portale** mirrorato (pagina Next.js `chess-free.html`) contiene: header con ricerca/login, sidebar categorie, 4 slot pubblicitari, breadcrumbs, tag, descrizione gioco ("208K likes"), FAQ ("18 livelli da Beginner a World Champion"), sezioni mosse speciali, video gameplay, giochi correlati, footer legale.

---

## 10. Asset audio

Presenti nel mirror: `Move-CX0pz_x1.wav` (mossa), `Capture-BEU4p7FD.wav` (cattura) — PCM mono 44,1 kHz.
Mancanti ma referenziati: notifiche generiche, bonus, acquisti, monete, gemme, undo, nuovo design, start, 5 brani musica lounge, audio emozioni emoji.

---

## 11. Sintesi: riutilizzabilità per il progetto "lezioni di scacchi"

**Cos'è riutilizzabile davvero:**
- La **conoscenza di dominio** (regole, flussi di gioco, protocollo di riconnessione `match-recovery-v1`, orologi, undo/hint, flusso richiesta patta/rivincita) — documentata sopra, preziosa come specifica.
- Il **concetto di stanza privata via link** (`ConnectionByInviteLinkModal`: "la partita parte quando l'invitato apre il link") — esattamente il modello richiesto dalle lezioni.
- L'approccio tecnico: **chess.js per le regole** + board DOM/CSS + protocollo messaggi validato (Zod) + server che conserva lo stato per il rejoin.

**Cos'è NON riutilizzabile:**
- Il bundle minificato (impraticabile da modificare) e i chunk mancanti (motore, modali, traduzioni, skins).
- Tutta la piattaforma pubblicitaria/monetizzazione/social, che è l'opposto di ciò che serve.

**Conclusione:** il mirror va usato come **specifica di riferimento**, non come codebase. Il percorso pratico per la beta è ricostruire un'app minima (chess.js + board React + WebSocket/room + form richiesta lezione + pannello admin + editor posizione) — vedi piano dettagliato nel messaggio di accompagnamento.
