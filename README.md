# 🃏 Klondike Solitaire — Premium Web Edition

A modern, high-performance, responsive Klondike Solitaire game built with **Vanilla JavaScript**, **CSS3 3D Transforms**, and **Semantic HTML5**. 

Featuring custom physics-like FLIP animations, single-tap auto-move, deadlock detection, automated solving, and dual theme support — with **zero external dependencies**.

---

## ✨ Features

- **🎯 Smart Tap-to-Move**: Tap any face-up card to automatically send it to the best legal spot (Foundations first, then Tableau columns).
- **✋ Custom Pointer Drag-and-Drop**: Touch & mouse drag system with target highlights and threshold detection for precision control.
- **✨ 3D Card Flipping & FLIP Animations**: Native CSS 3D card transforms with 60fps FLIP (First, Last, Invert, Play) movement animations.
- **🧠 Deadlock & Unsolvability Detection**: Built-in solver engine (`solver.js`) analyzes board state after every move and alerts you when no moves remain.
- **⚡ Automated Solve Sequence**: Cascading win celebration animation when all tableau cards are revealed face-up.
- **⏪ Deep Undo / Redo**: Unlimited step history stack with keyboard shortcut support (`Ctrl+Z` / `Ctrl+Y`).
- **🎨 Glassmorphism & Dual Themes**: Toggle between **Emerald Felt** (classic casino felt) and **Midnight Dark** (sleek slate & glow).
- **📱 Fully Responsive**: Fluid sizing using CSS `clamp()` and flex/grid systems for seamless play on desktop, tablet, and mobile.

---

## 🛠️ Project Structure

```text
├── index.html        # Main HTML layout, HUD stats header, win & unsolvable modals
├── style.css         # Theme design system, glassmorphic UI tokens, 3D card styles
├── app.js            # Core game state engine, gesture handler, rendering pipeline
└── solver.js         # Board deadlock detection algorithm & auto-solve cascade engine
```

---

## 🚀 Getting Started

### Local Play
No build steps or package installs required! Simply double-click `index.html` or open it in any modern web browser.

### Local Server (Optional)
If using VS Code or a local CLI server:
```bash
# Using Python
python3 -m http.server 8000

# Using Node / npx
npx serve .
```
Then visit `http://localhost:8000` in your browser.

---

## 🎮 How to Play

1. **Draw Cards**: Click the **Stock Pile** to draw cards into the **Waste Pile**.
2. **Move Cards**:
   - **Tap**: Click or tap any face-up card to auto-move it to a legal Foundation or Tableau pile.
   - **Drag**: Click and hold to drag single cards or face-up card stacks to target columns.
   - **Double-Click**: Auto-home top playable cards to Foundation piles.
3. **Recycle Stock**: When the Stock Pile is empty, click it to recycle cards from the Waste Pile back into stock.
4. **Foundation Goals**: Build up all 4 suits (Hearts, Diamonds, Clubs, Spades) from **Ace to King**.
5. **Tableau Building**: Stack cards in descending rank with **alternating red and black colors**.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> / <kbd>Cmd</kbd> + <kbd>Z</kbd> | **Undo** last move |
| <kbd>Ctrl</kbd> + <kbd>Y</kbd> / <kbd>Cmd</kbd> + <kbd>Y</kbd> | **Redo** move |

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
