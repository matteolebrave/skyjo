## Lib
import random

## Class

class Card:
    def __init__(self,value):
        self.value = value
        self.visible = False

    def reveal(self):
        if not self.visible:
            self.visible = True

    def __repr__(self):
        return str(self.value) if self.visible else "?"

class Player:
    def __init__(self, name):
        self.name = name
        self.hand = []
        self.score = 0

    def reveal_card(self,row,col):
        self.hand[row][col].reveal()

    def visible_score(self):
        score = 0
        for row in range(3):
            for col in range(len(self.hand[0])):
                if self.hand[row][col].visible:
                    score += self.hand[row][col].value
        return score
    
    def total_score(self):
        total = 0
        for row in range(3):
            for col in range(len(self.hand[0])):
                    total += self.hand[row][col].value
        return total
    
    def is_done(self):
        #count = 0
        #for row in self.hand:
        #    for card in row:
        #        if card.visible:
        #            count += 1
        #return count >= 2 
        for row in range(3):
            for col in range(len(self.hand[0])):
                    if not self.hand[row][col].visible:
                        return False
        return True
    
    def __repr__(self):
        rows = []
        for row in self.hand:
            rows.append(" ".join(f"{str(card):>{len(self.hand[0])}}" for card in row))
        return f"{self.name} :\n" + "\n".join(rows)
    
    def check_column(self):
        discard = []
        for col in range(len(self.hand[0]) - 1, -1, -1):
                if all(self.hand[row][col].visible for row in range(3)):
                    if  self.hand[0][col].value == self.hand[1][col].value == self.hand[2][col].value:
                        for row in self.hand:
                            discard.append(row.pop(col))
        return discard

    def place_card(self, row, col, new_card):
        old_card = self.hand[row][col]
        new_card.reveal()
        self.hand[row][col] = new_card
        return old_card
    
class Game:
    def __init__(self,PLAYERS):
        self.players = PLAYERS
        self.discard = []
        self.current_player_index = 0
        self.round_ender = None
        self.phase = None
        self.deck = self._build_deck()

    def _build_deck(self):
        deck = []
        deck.extend(Card(-2) for _ in range(5))
        deck.extend(Card(-1) for _ in range(10))
        deck.extend(Card(0) for _ in range(15))
        deck.extend(Card(i) for i in range(1, 13) for _ in range(10))
        random.shuffle(deck)
        return deck

    def setup_round(self):
        self.discard = []
        self.round_ender = None 
        self.phase = "reveal"
        self.deck = self._build_deck()
        for player in self.players:
            player.hand = [
                [self.deck.pop() for _ in range(4)]
                for _ in range(3)
            ]
        self.discard.append(self.deck.pop())  # première carte du deck
        self.reveals = {player: 0 for player in self.players}
        self.drawn_card = None
        self.must_reveal = False

    def next_player(self):
        self.current_player_index = (self.current_player_index + 1) % len(self.players)

    def draw_from_deck(self):
        if len(self.deck) == 0:
            tmp = self.discard
            self.discard = [tmp.pop()]
            random.shuffle(tmp)
            for card in tmp:
                card.visible = False
            self.deck = tmp
        return self.deck.pop()
    
    def draw_from_discard(self):
        return self.discard.pop()
    
    def check_end_round(self):
        for player in self.players:
            if player.is_done():
                self.round_ender = player
                return True
        return False
    
    def apply_scores(self):
        Totals = []
        for player in self.players:
            for row in range(3):
                for col in range(len(player.hand[0])):
                    player.reveal_card(row,col)
            Totals.append(player.total_score())
        for player in self.players:
            score = player.total_score()
            if player == self.round_ender and score > min(Totals):
                player.score += 2*(score)
            else:
                player.score += score
    
    def is_game_over(self):
        for player in self.players:
            if player.score >= 100:
                self.phase = None
                return True
        return False
    
    def determine_first_player(self):
        var = 0
        for player in self.players:
            tmp = player.visible_score()
            if tmp >= var:
                var = tmp
        for player in self.players:
            if player.visible_score() == var:
                self.current_player_index = self.players.index(player)



