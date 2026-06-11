import asyncio
import websockets
import json
from game_logic import Card, Player, Game
import os
import aiohttp
from aiohttp import web


async def serve_frontend(request):
    return web.FileResponse('./frontend/index.html')

PORT = int(os.environ.get("PORT", 8765))


CLIENTS = {}   # { websocket: player }
GAME = None
NB_PLAYERS = None
RESTART_VOTES = set()
READY_VOTES = set()


def game_state():
    current_player = GAME.current_player_index
    discard_top = GAME.discard[-1].value if GAME.discard else None
    drawn_card = GAME.drawn_card.value if GAME.drawn_card else None
    hands = {
    player.name: [
        [{"value": card.value, "visible": card.visible} for card in row]
        for row in player.hand]
    for player in GAME.players
    }
    scores = {player.name: player.score for player in GAME.players}

    return {
    "type": "game_state",
    "current_player": GAME.players[current_player].name,
    "discard_top": discard_top,
    "drawn_card": drawn_card,
    "must_reveal": GAME.must_reveal,
    "hands": hands,
    "scores": scores,
    "drawn_from": GAME.drawn_from
    }

async def broadcast(buffer):
    if CLIENTS:
        data = json.dumps(buffer)
        dead = []
        for ws in CLIENTS:
            try:
                await ws.send_str(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            del CLIENTS[ws]

async def end_round_check():
    GAME.apply_scores()
    if GAME.is_game_over():
        winner = min(GAME.players, key=lambda p: p.score)
        await broadcast({
            "type": "game_over",
            "winner": winner.name,
            "scores": {p.name: p.score for p in GAME.players},
            "hands": {
                p.name: [
                    [{"value": card.value, "visible": True} for card in row]
                    for row in p.hand
                ]
                for p in GAME.players
            }
        })
    else:
        hands_snapshot = {
            p.name: [
                [{"value": card.value, "visible": True} for card in row]
                for row in p.hand
            ]
            for p in GAME.players
        }
        GAME.setup_round()
        await broadcast({
            "type": "end_round",
            "scores": {p.name: p.score for p in GAME.players},
            "hands": hands_snapshot
        })

async def handle_action(websocket, data):
    print(f"handle_action reçu : {data}")
    try:
        print(f"try passé")
        player = CLIENTS[websocket]
        action = data.get("action")

        print(f" action: {action}")
        # Phase révélation initiale
        if action == "ready":
            READY_VOTES.add(player)
            if len(READY_VOTES) == NB_PLAYERS:
                READY_VOTES.clear()
                await broadcast({"type": "game_start"})
                await broadcast(game_state())

        if action == "restart":
            print(f"restart reçu de {player.name}, votes: {len(RESTART_VOTES)+1}/{NB_PLAYERS}")
            RESTART_VOTES.add(player)
            if len(RESTART_VOTES) == NB_PLAYERS:
                RESTART_VOTES.clear()
                for p in GAME.players:
                    p.score = 0
                GAME.setup_round()
                await broadcast({"type": "game_start"})
                await broadcast(game_state())

        if GAME.phase == "reveal":
            if action == "reveal_card":
                row, col = data["row"], data["col"]
                player.reveal_card(row, col)
                GAME.reveals[player] += 1

                if GAME.reveals[player] == 2:
                    GAME.next_player()
                if all(GAME.reveals[p] == 2 for p in GAME.players):
                    GAME.determine_first_player()
                    GAME.phase = "play"
                    await broadcast({"type": "phase_change", "phase": "play"})
            await broadcast(game_state())

        # Phase de jeu normal
        elif GAME.phase == "play":
            current = GAME.players[GAME.current_player_index]
            if player != current:
                await websocket.send_str(json.dumps({"type": "error", "message": "Ce n'est pas ton tour"}))
                return
            if GAME.must_reveal and action != "reveal_card":
                await websocket.send_str(json.dumps({"type": "error", "message": "Tu dois retourner une carte"}))
                return
            if action == "draw_deck":
                GAME.drawn_card = GAME.draw_from_deck()
                GAME.drawn_from = "deck"
                await broadcast(game_state())

            elif action == "draw_discard":
                GAME.drawn_card = GAME.draw_from_discard()
                GAME.drawn_from = "discard"
                await broadcast(game_state())

            elif action == "place_card":
                row, col = data["row"], data["col"]
                old_card = current.place_card(row,col,GAME.drawn_card)
                GAME.discard.append(old_card)
                removed = current.check_column()
                GAME.discard.extend(removed)
                GAME.drawn_card = None
                if GAME.check_end_round():
                    await end_round_check()
                else:
                    GAME.next_player()
                await broadcast(game_state())

            elif action == "discard_drawn":
                GAME.discard.append(GAME.drawn_card)
                GAME.drawn_card = None
                GAME.must_reveal = True
                await broadcast(game_state())
            
            elif action == "reveal_card" and GAME.must_reveal:
                row, col = data["row"], data["col"]
                current.reveal_card(row, col)
                removed = current.check_column()    
                GAME.discard.extend(removed) 
                GAME.must_reveal = False
                if GAME.check_end_round():
                    await end_round_check()
                else:
                    GAME.next_player()
                await broadcast(game_state())
        
                
    except Exception as e:
        import traceback
        traceback.print_exc()
        await websocket.send_str(json.dumps({"type": "error", "message": str(e)}))

async def handler(websocket):
    global GAME, NB_PLAYERS, RESTART_VOTES, READY_VOTES
    print("Nouvelle connexion")
    try:
        async for message in websocket:
            print("message reçu =", message)
            if message.type == aiohttp.WSMsgType.TEXT:
                data = json.loads(message.data)
                if data.get("action") == "join" and websocket not in CLIENTS:  # ← indenté ici
                    print(f"join reçu : {data['name']}")
                    player_name = data["name"]
                    player = Player(player_name)
                    CLIENTS[websocket] = player
                    print(f"{player_name} connecté")
                    await websocket.send_str(json.dumps({"type": "your_name", "name": player_name}))
                    if len(CLIENTS) == 1:
                        NB_PLAYERS = data.get("nb_players", 2)
                        print(f"Partie créée pour {NB_PLAYERS} joueurs")
                    await broadcast({"type": "waiting", "current": len(CLIENTS), "total": NB_PLAYERS})
                    if len(CLIENTS) == NB_PLAYERS:
                        GAME = Game(list(CLIENTS.values()))
                        GAME.setup_round()
                        await broadcast({"type": "game_start"})
                        await broadcast(game_state())
                else:
                    await handle_action(websocket, data)
            elif message.type == aiohttp.WSMsgType.ERROR:
                print(f"Erreur WebSocket : {websocket.exception()}")
    except Exception as e:
        print(f"Déconnexion : {e}")
        if websocket in CLIENTS:
            name = CLIENTS[websocket].name
            del CLIENTS[websocket]
            GAME = None
            RESTART_VOTES = set()
            READY_VOTES = set()
            if len(CLIENTS) == 0:
                NB_PLAYERS = None  # ← seulement si plus personne
            await broadcast({"type": "player_disconnected", "name": name})

async def websocket_handler(request):
    ws = web.WebSocketResponse()
    print("test")
    await ws.prepare(request)
    await handler(ws)
    return ws

async def reset_server(request):
    global GAME, NB_PLAYERS, RESTART_VOTES, READY_VOTES, CLIENTS
    GAME = None
    NB_PLAYERS = None
    RESTART_VOTES = set()
    READY_VOTES = set()
    CLIENTS = {}
    return web.Response(text="Serveur réinitialisé !")

async def main():
    app = web.Application()
    app.router.add_get('/', serve_frontend)
    app.router.add_get('/ws', websocket_handler)
    app.router.add_get('/reset', reset_server) 
    app.router.add_static('/frontend', './frontend')
    print(app)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', PORT)
    await site.start()
    print(f"Serveur démarré sur le port {PORT}")
    await asyncio.Future()

asyncio.run(main())
