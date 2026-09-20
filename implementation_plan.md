# Technical Guide: Building a Premium Klondike Solitaire Game

This document provides complete, step-by-step architectural and logical instructions to build a premium, high-performance Klondike Solitaire game from scratch using HTML, CSS, and Vanilla JavaScript. 

It covers the visual design, state management, custom physics-like animations, pointer-based drag-and-drop, and the algorithms for checking unsolvability and running an automated solve sequence.

---

## 1. Project Architecture & File Structure
To keep the application fast, modular, and easy to run without a build step, structure the project into four files:
- **`index.html`**: Semantic layout, HUD (Heads-Up Display), SVGs, and modal overlays.
- **`style.css`**: CSS custom properties (themes), responsive layouts, 3D card designs, and transition curves.
- **`app.js`**: Core game engine, state management, history stacks (undo/redo), pointer-event drag-and-drop, and the FLIP animation coordinator.
- **`solver.js`**: Board state analysis (deadlock detection) and the auto-solve gameplay loop.

---

## 2. HTML Structure & Layout
The HTML should establish a clean hierarchical layout using semantic HTML5 tags:

1. **App Container (`.app-container`)**:
   - The main wrapper. Add background decorative elements (like blurred glowing circles) to create depth.
2. **HUD Header (`.game-header`)**:
   - **Logo / Title**: "Solitaire" with a smaller subtitle "Klondike".
   - **Stats Panel**: Three text blocks showing **Time** (`MM:SS`), **Moves** (count), and **Score** (points).
   - **Status Indicator**: A status dot (colored green/yellow/red) and a text label indicating the current board state (e.g., "Analyzing...", "Moves Available", "No Moves Left").
   - **Controls**: Button icons for **Undo**, **Redo**, **Theme Toggle**, and a primary button for **New Game**. Use inline SVGs for these icons.
3. **Game Board (`.game-board`)**:
   - **Top Row (`.board-top-row`)**:
     - **Deck Area**: Contain the **Stock Pile** (face-down draw pile) and the **Waste Pile** (face-up pile).
     - **Foundations Area**: Four individual piles for Hearts, Diamonds, Clubs, and Spades. Each pile should have a large, faded suit symbol placeholder centered inside it.
   - **Bottom Area (`.tableau-area`)**:
     - A grid containing 7 **Tableau Column** wrappers. Each column is a container where cards will be stacked vertically.
4. **Overlays**:
   - **Win Modal**: A full-screen blurred overlay with a trophy icon, final statistics, and a "Play Again" button.
   - **Unsolvable Banner**: A banner pinned to the bottom of the viewport that slides up when no moves are remaining. It should contain "Undo" and "New Deal" quick action buttons.
5. **Drag Container (`#drag-container`)**:
   - A blank, floating `div` positioned at the top-left of the viewport (`position: fixed; pointer-events: none; z-index: 9999`). This will temporarily hold cards while they are being dragged.

---

## 3. CSS Styling & Design System
Use modern CSS techniques to create a premium, polished feel:

### A. Theme Variables
Define CSS variables in `:root` and override them under a `[data-theme="dark"]` selector:
- **Emerald Felt Theme (Default)**: Use a radial gradient for the background going from a vibrant forest green in the center to a deep, dark emerald at the edges. Use a warm gold accent color.
- **Midnight Dark Theme**: Use a radial gradient going from a deep slate-indigo to midnight black. Use a glowing indigo/lavender accent color.
- **Glassmorphism**: Give the HUD header, modals, and banners a semi-transparent background (e.g., `rgba(255, 255, 255, 0.06)`), a thin border, and a heavy backdrop-filter blur (`12px` to `20px`).

### B. Card Layout & Responsiveness
- Rather than hardcoding pixel sizes, define the card width using `clamp()` so it scales smoothly across mobile and desktop screens:
  `--card-width: clamp(48px, 8.8vw, 92px);`
  `--card-height: calc(var(--card-width) * 1.4);`
- Use this `--card-width` and `--card-height` for all card elements, stock, waste, foundations, and tableau columns to ensure perfect alignment.
- Lay out the 7 tableau columns using `display: grid` with `grid-template-columns: repeat(7, 1fr)` and a flexible gap.

### C. 3D Card Design
- Each card is a `div` with `position: absolute; transform-style: preserve-3d; transition: transform 0.25s`.
- Inside the card, create two face elements: `.card-front` and `.card-back`. Both must have `position: absolute; backface-visibility: hidden`.
- Rotate the card back by 180 degrees: `transform: rotateY(180deg)`.
- When a card has the `.face-down` class, rotate the entire card `transform: rotateY(180deg)`. This creates a native 3D flipping transition when the class is toggled.
- **Card Front**: Clean white background, charcoal text for black suits, crimson text for red suits. Large centered suit symbol and smaller rank/suit indicators in the top-left and bottom-right corners.
- **Card Back**: Design a high-quality geometric pattern. For example, a dark gradient background with a thin gold inner border and a subtle tiled pattern.
- **Hover Lift**: Add a hover effect to face-up, playable cards: `transform: translateY(-6px)` and an increased drop shadow.

### D. Tableau Stacking
- Within a `.tableau-column`, position cards absolutely.
- To stack them vertically, calculate their `top` offset dynamically in JavaScript based on their index in the column. Face-down cards should be stacked tighter (e.g., `14px` offset) and face-up cards looser (e.g., `26px` offset) to show the ranks clearly.

---

## 4. Game State & Initialization

### A. State Representation
In `app.js`, maintain a single `state` object:
- `deck`: A dictionary mapping unique card IDs (e.g., `"H-1"` for Ace of Hearts, `"S-13"` for King of Spades) to their properties:
  `{ id, suit, value, faceUp }`
- `stock`: An array of card IDs currently in the stock.
- `waste`: An array of card IDs currently in the waste.
- `foundation`: An array of 4 arrays, each holding the card IDs in that foundation pile.
- `tableau`: An array of 7 arrays, each holding the card IDs in that column (from bottom-most to top-most card).
- `history` & `redoStack`: Arrays storing copies of previous states for the Undo/Redo system.
- `moves`, `score`, `elapsedSeconds`: Numeric statistics.

### B. Game Startup
1. Generate a deck of 52 card objects (4 suits: Hearts `H`, Diamonds `D`, Clubs `C`, Spades `S`; 13 values: 1 to 13).
2. Shuffle the card IDs using the **Fisher-Yates shuffle** algorithm.
3. Deal the cards to the 7 tableau columns:
   - Column 0 gets 1 card, Column 1 gets 2 cards, ..., Column 6 gets 7 cards.
   - For each column, set the last card's `faceUp` property to `true`. All others remain `false`.
4. Place the remaining 24 cards into the `stock` array.
5. Set `moves` and `score` to 0, reset the timer, and render the board.

---

## 5. High-Performance FLIP Rendering Engine
To avoid screen flickering and enable smooth card flight animations, **do not recreate card DOM elements during gameplay**. Instead:
1. Create 52 card DOM elements once during initialization and cache them in a dictionary.
2. In the `renderBoard(animate)` function, move these existing DOM elements to their new parent containers (`dom.stock`, `dom.waste`, `.tableau-column`, etc.) using `appendChild()`.
3. To animate cards flying from one pile to another, implement the **FLIP (First, Last, Invert, Play)** animation pipeline:

### The FLIP Algorithm:
- **First**: If `animate` is true, loop through all 52 card elements. If a card is currently in the DOM, record its current viewport bounding rectangle using `getBoundingClientRect()`. Store these in a temporary map.
- **Update DOM**: Reposition all cards in the DOM by appending them to their new parent containers, setting their new `top` offsets, updating their `zIndex`, and adding/removing the `.face-down` class.
- **Last**: Loop through all cards again and record their new viewport bounding rectangles.
- **Invert**: For each card, calculate the difference in position:
  `dx = oldRect.left - newRect.left;`
  `dy = oldRect.top - newRect.top;`
- **Play**: If `dx` or `dy` is not zero, the card has moved. Temporarily disable CSS transitions on the card, and apply a transform to translate it back to its starting position:
  `transform: translate(dx, dy) rotateY(180deg or 0deg)`
  Force a browser reflow (by reading `cardEl.offsetHeight`). Then, re-enable CSS transitions and set the transform to `translate(0, 0)`. The browser will smoothly animate the card from its old position to its new position.

---

## 6. Pointer-Event Drag-and-Drop
Rather than using the restrictive HTML5 Drag and Drop API, implement a custom drag-and-drop system using **Pointer Events** (`pointerdown`, `pointermove`, `pointerup`). This ensures smooth animations, multi-card dragging, and native mobile touch support.

### A. Pointer Down (`pointerdown`)
- Triggered when clicking/touching a card.
- Verify the card is `faceUp`. If it's face-down and in the stock pile, trigger the **Draw Card** action instead.
- Identify the source pile:
  - If the card is in the waste or foundation, only this card can be dragged.
  - If the card is in the tableau, find its index in that column's array. The dragged stack consists of this card and **all cards stacked below it** in the column.
- Save the initial pointer coordinates and calculate the offset between the pointer and the top-left corner of the card.
- Record the original CSS `top`, `zIndex`, and parent of each card in the dragged stack so they can snap back if the move is invalid.
- Move the dragged card elements into the floating `#drag-container` and position them absolutely, offsetting each card vertically by `26px`.
- Call `setPointerCapture` on the card to lock pointer tracking to this element.

### B. Pointer Move (`pointermove`)
- Update the floating `#drag-container` coordinates to match the pointer's current coordinates minus the initial click offset.
- **Visual Feedback**: Find the element under the pointer using `document.elementFromPoint()`. Since the floating cards in the drag container have `pointer-events: none` in CSS, the browser will look through them and return the board pile underneath. If the pile is a valid drop target, add a highlight class (e.g., a gold dashed border).

### C. Pointer Up (`pointerup`)
- Release pointer capture.
- Find the pile container under the pointer.
- **Validate the Move**:
  - **Tableau Target**: 
    - If the column is empty, the bottom card of the dragged stack must be a **King** (value 13).
    - If the column is not empty, the bottom card of the dragged stack must be of the **opposite color** and **exactly one rank lower** than the top card of the target column.
  - **Foundation Target**:
    - Only a **single card** can be dropped on a foundation.
    - If the foundation is empty, the card must be an **Ace** (value 1).
    - If it is not empty, the card must match the foundation's suit and be **exactly one rank higher** than the current top card of the foundation.
- **If Valid**: Update the game state (remove cards from source pile, append to destination pile), check if the top card of the source tableau column is now face-down and flip it face-up, save the state to the history stack, and call `renderBoard(true)`.
- **If Invalid**: Animate all cards in the dragged stack flying back to their original positions using the FLIP technique.

---

## 7. Solitaire Game Rules & Controls

### A. Draw & Recycle Pile
- **Draw**: When clicking the stock pile, take the top card from the `stock` array, set its `faceUp` property to `true`, and push it to the `waste` array.
- **Recycle**: When the stock pile is empty, clicking the empty stock pile container should reverse the `waste` array, set all their `faceUp` properties to `false`, move them back to the `stock` array, and clear the `waste`.
- Bind a click listener to the empty stock pile container (`dom.stock`). Ensure it only triggers if the click target is the container itself (`e.target === dom.stock`) to prevent double-triggering when clicking the last card of the stock.

### B. Double-Click to Home
- When a card is double-clicked, check if it can be placed on any of the four foundation piles.
- If a valid foundation is found, automatically move the card, flip the new top card of the source column, update stats, and render.

### C. Undo / Redo
- **Undo**: Pop the last state from the `history` stack, push the current state to the `redoStack`, restore the popped state, and render the board.
- **Redo**: Pop the last state from the `redoStack`, push the current state to the `history` stack, restore the popped state, and render.
- Listen for keyboard shortcuts: `Ctrl+Z` (Undo) and `Ctrl+Y` (Redo).

---

## 8. Unsolvability Checker (Deadlock Detector)
After every move, analyze the board to determine if any moves are possible. The board is solvable if **at least one** of the following conditions is met:

1. **Tableau to Foundation**: The top card of any of the 7 tableau columns can be placed on any of the 4 foundation piles.
2. **Tableau to Tableau**: Any face-up card in the tableau (and its stack) can be placed on another tableau column.
   - *Optimization*: To avoid false positives on useless cycles, ignore moves where a King is moved from one empty column to another empty column, or when a King at the bottom of a column with no face-down cards underneath is moved to an empty column.
3. **Waste to Board**: The top card of the waste pile can be placed on any tableau column or foundation pile.
4. **Stock/Waste Deck Analysis**: Iterate through all cards remaining in the stock and waste arrays. For each card, check if it could be placed on any of the current tableau columns or foundation piles. If even one card in the deck can be played, a move is available (since the player can draw until they reach it).

If none of these conditions are met, the game is in a deadlock. Slide the **Unsolvable Banner** into view.

---

## 9. Auto-Solve Sequence
The game is winnable without further player decisions when **there are no face-down cards left in the tableau**. At this point, trigger the auto-solve sequence:

1. Lock the board to prevent further player interaction (`state.isAnimating = true`).
2. Run an automated loop that performs one move at a time:
   - Look at the top card of each tableau column and the top card of the waste pile.
   - If any of these cards can be placed on a foundation, execute that move, update the UI, and schedule the next iteration of the loop using `setTimeout` (e.g., with a `180ms` delay to show a cascading animation).
   - If no cards can go to the foundations, but the stock pile is not empty, perform a **Draw Card** action.
   - If the stock is empty but the waste has cards, perform a **Recycle Waste** action.
3. Repeat the loop until all 4 foundations contain 13 cards (the game is won).
4. Stop the timer, display the Win Modal, and trigger a confetti celebration (by spawning floating colored `div` elements and animating them falling down the screen).
