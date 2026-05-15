# Battleship

A browser-based Battleship game where you play against a smart AI opponent.

## Features

- **Ship Placement**: Place your ships manually by clicking on the grid, or use the Random button for automatic placement. Rotate ships with the R key or Rotate button.
- **Turn-Based Gameplay**: Classic Battleship rules — fire at the enemy grid to find and sink their fleet.
- **Smart AI Opponent**: The AI uses a hunt/target strategy with probability-density scoring. It switches from random hunting (using a checkerboard pattern) to targeted pursuit when it gets a hit, following the direction of the ship.
- **Visual Feedback**: Hit, miss, and sunk animations with color-coded markers.
- **Battle Log**: Real-time log of all shots fired by both players.
- **Ship Counter**: Track how many ships remain for each player.
- **Responsive Design**: Works on desktop and mobile screens.
- **Game Over Screen**: Victory/defeat modal with shot statistics and a Play Again button.

## How to Play

1. **Place Ships**: Click a ship from the list, then click on the board to place it. Press R to rotate. Or click Random.
2. **Start Game**: Once all 5 ships are placed, click Start Game.
3. **Fire**: Click cells on the Enemy Waters grid to fire. Red = hit, gray dot = miss.
4. **Win**: Sink all 5 enemy ships before the AI sinks yours.

## Ships

| Ship       | Size |
|------------|------|
| Carrier    | 5    |
| Battleship | 4    |
| Cruiser    | 3    |
| Submarine  | 3    |
| Destroyer  | 2    |

## Running Locally

Open `index.html` in any modern browser, or serve with:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Tech Stack

- Vanilla HTML, CSS, JavaScript
- No dependencies or build step required
