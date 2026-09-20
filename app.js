/**
 * Klondike Solitaire - Core Game Engine & Interaction
 */

// Game State
const state = {
    deck: {},         // cardId -> { id, suit, value, faceUp }
    stock: [],        // Array of cardIds
    waste: [],        // Array of cardIds
    tableau: [[], [], [], [], [], [], []], // 7 columns of cardIds
    foundation: [[], [], [], []],          // 4 piles of cardIds (H, D, C, S)
    
    // Statistics
    moves: 0,
    score: 0,
    startTime: null,
    elapsedSeconds: 0,
    timerInterval: null,
    
    // Undo/Redo Stacks
    history: [],
    redoStack: [],
    
    // Settings
    theme: 'felt', // 'felt' or 'dark'
    
    // Lock for animations
    isAnimating: false
};

// Drag & Drop State
const drag = {
    active: false,
    isDragging: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    cards: [],        // Array of cardIds being dragged
    sourcePile: null, // { type: 'tableau'|'waste'|'foundation', index: number }
    originalOffsets: [], // { top, left } of dragged elements
    dragOffset: { x: 0, y: 0 }
};

// DOM Elements
const dom = {
    stock: document.getElementById('stock-pile'),
    waste: document.getElementById('waste-pile'),
    foundations: [
        document.getElementById('foundation-0'),
        document.getElementById('foundation-1'),
        document.getElementById('foundation-2'),
        document.getElementById('foundation-3')
    ],
    tableauArea: document.getElementById('tableau-area'),
    tableaus: [
        document.getElementById('tableau-0'),
        document.getElementById('tableau-1'),
        document.getElementById('tableau-2'),
        document.getElementById('tableau-3'),
        document.getElementById('tableau-4'),
        document.getElementById('tableau-5'),
        document.getElementById('tableau-6')
    ],
    timer: document.getElementById('timer-val'),
    moves: document.getElementById('moves-val'),
    score: document.getElementById('score-val'),
    undoBtn: document.getElementById('undo-btn'),
    redoBtn: document.getElementById('redo-btn'),
    themeBtn: document.getElementById('theme-btn'),
    newGameBtn: document.getElementById('new-game-btn'),
    winModal: document.getElementById('win-modal'),
    winTime: document.getElementById('win-time'),
    winMoves: document.getElementById('win-moves'),
    winScore: document.getElementById('win-score'),
    playAgainBtn: document.getElementById('play-again-btn'),
    dragContainer: document.getElementById('drag-container'),
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    unsolvableBanner: document.getElementById('unsolvable-banner'),
    bannerUndo: document.getElementById('banner-undo'),
    bannerNew: document.getElementById('banner-new')
};

// Card Pool - 52 reusable card DOM elements to prevent recreate flicker
const cardDOMElements = {};

/* --- Game Initialization --- */

function initGame() {
    // Reset state
    state.stock = [];
    state.waste = [];
    state.tableau = [[], [], [], [], [], [], []];
    state.foundation = [[], [], [], []];
    state.moves = 0;
    state.score = 0;
    state.elapsedSeconds = 0;
    state.history = [];
    state.redoStack = [];
    state.isAnimating = false;
    
    stopTimer();
    state.startTime = null;
    updateStatsUI();
    hideWinModal();
    hideUnsolvableBanner();
    
    // Create card objects
    const suits = ['H', 'D', 'C', 'S'];
    state.deck = {};
    
    let cardIndex = 0;
    for (const suit of suits) {
        for (let value = 1; value <= 13; value++) {
            const id = `${suit}-${value}`;
            state.deck[id] = {
                id: id,
                suit: suit,
                value: value,
                faceUp: false
            };
            
            // Create DOM element if it doesn't exist
            if (!cardDOMElements[id]) {
                cardDOMElements[id] = createCardDOM(id, suit, value);
            }
            // Reset classes
            const cardEl = cardDOMElements[id];
            cardEl.className = 'card face-down';
            cardEl.style.transform = '';
            cardEl.style.transition = '';
            cardEl.style.top = '0px';
            cardEl.style.left = '0px';
        }
    }
    
    // Create a flat array of IDs and shuffle
    const shuffler = Object.keys(state.deck);
    for (let i = shuffler.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffler[i], shuffler[j]] = [shuffler[j], shuffler[i]];
    }
    
    // Deal Tableau
    let dealIndex = 0;
    for (let col = 0; col < 7; col++) {
        for (let row = col; row < 7; row++) {
            const cardId = shuffler[dealIndex++];
            state.tableau[row].push(cardId);
            
            // Turn the last card of each column face up
            if (row === col) {
                state.deck[cardId].faceUp = true;
            }
        }
    }
    
    // Rest of the cards go to Stock
    while (dealIndex < shuffler.length) {
        state.stock.push(shuffler[dealIndex++]);
    }
    
    // Render initial board
    renderBoard(false); // Draw initial without animations to make it instant
    
    // Start solvability analysis
    runSolvabilityCheck();
}

// Create Card DOM element
function createCardDOM(id, suit, value) {
    const card = document.createElement('div');
    card.id = id;
    card.className = 'card face-down';
    card.setAttribute('data-suit', suit);
    card.setAttribute('data-value', value);
    
    const suitSymbols = { H: '♥', D: '♦', C: '♣', S: '♠' };
    const rankLabels = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
    const rankStr = rankLabels[value] || value.toString();
    const suitSymbol = suitSymbols[suit];
    
    card.innerHTML = `
        <div class="card-face card-front">
            <div class="card-corner">
                <span class="card-rank">${rankStr}</span>
                <span class="card-suit-small">${suitSymbol}</span>
            </div>
            <div class="card-center-suit">${suitSymbol}</div>
            <div class="card-corner" style="transform: rotate(180deg);">
                <span class="card-rank">${rankStr}</span>
                <span class="card-suit-small">${suitSymbol}</span>
            </div>
        </div>
        <div class="card-face card-back"></div>
    `;
    
    // Bind Pointer Events for Dragging
    card.addEventListener('pointerdown', handlePointerDown);
    // Double click to auto-home
    card.addEventListener('dblclick', handleDoubleClick);
    
    return card;
}

/* --- Render Engine (With FLIP Animation Support) --- */

function renderBoard(animate = true) {
    // 1. Record old rects of all cards currently in the DOM
    const oldRects = {};
    if (animate) {
        Object.keys(state.deck).forEach(id => {
            const el = cardDOMElements[id];
            if (el && el.parentElement) {
                oldRects[id] = el.getBoundingClientRect();
            }
        });
    }

    // Helper to position a card in a pile
    const positionCard = (id, parentEl, topOffset, zIndex, faceUp) => {
        const el = cardDOMElements[id];
        const cardData = state.deck[id];
        
        // Update faceUp state in card DOM
        cardData.faceUp = faceUp;
        if (faceUp) {
            el.classList.remove('face-down');
            el.classList.add('playable');
        } else {
            el.classList.add('face-down');
            el.classList.remove('playable');
        }
        
        // Append to new parent (automatically removes from old parent)
        parentEl.appendChild(el);
        el.style.top = `${topOffset}px`;
        el.style.zIndex = zIndex;
    };

    // 2. Position Stock cards
    state.stock.forEach((id, index) => {
        positionCard(id, dom.stock, 0, index + 1, false);
    });

    // 3. Position Waste cards
    state.waste.forEach((id, index) => {
        positionCard(id, dom.waste, 0, index + 1, true);
    });

    // 4. Position Foundations
    for (let f = 0; f < 4; f++) {
        const pileEl = dom.foundations[f];
        state.foundation[f].forEach((id, index) => {
            positionCard(id, pileEl, 0, index + 1, true);
        });
    }

    // 5. Position Tableau Columns
    for (let col = 0; col < 7; col++) {
        const colEl = dom.tableaus[col];
        const cards = state.tableau[col];
        
        let topOffset = 0;
        cards.forEach((id, index) => {
            const cardData = state.deck[id];
            positionCard(id, colEl, topOffset, index + 1, cardData.faceUp);
            // Calculate offset for next card
            topOffset += cardData.faceUp ? 26 : 14;
        });
    }

    // 6. Perform FLIP animations for cards that moved
    if (animate) {
        Object.keys(state.deck).forEach(id => {
            const el = cardDOMElements[id];
            const oldRect = oldRects[id];
            if (el && oldRect) {
                const newRect = el.getBoundingClientRect();
                const dx = oldRect.left - newRect.left;
                const dy = oldRect.top - newRect.top;
                
                if (dx !== 0 || dy !== 0) {
                    const isFlipped = el.classList.contains('face-down');
                    const rotY = isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
                    
                    el.style.transition = 'none';
                    el.style.transform = `translate(${dx}px, ${dy}px) ${rotY}`;
                    
                    // Force reflow
                    el.offsetHeight;
                    
                    el.style.transition = 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)';
                    el.style.transform = `translate(0px, 0px) ${rotY}`;
                    
                    // Clean up transition after completion
                    setTimeout(() => {
                        if (!drag.active) {
                            el.style.transition = '';
                        }
                    }, 300);
                }
            }
        });
    }

    // Update button states
    dom.undoBtn.disabled = state.history.length === 0;
    dom.redoBtn.disabled = state.redoStack.length === 0;
}

/* --- Gameplay Logic & Moves --- */

function drawCard() {
    if (state.isAnimating) return;
    
    saveState();
    
    if (state.stock.length > 0) {
        const cardId = state.stock.pop();
        state.deck[cardId].faceUp = true;
        state.waste.push(cardId);
        state.score = Math.max(0, state.score + 5); // +5 for drawing
    } else if (state.waste.length > 0) {
        // Recycle waste to stock
        // Reverse waste and put it back to stock, and face down
        state.stock = [...state.waste].reverse();
        state.stock.forEach(id => {
            state.deck[id].faceUp = false;
        });
        state.waste = [];
        state.score = Math.max(0, state.score - 20); // Penalty for recycling
    } else {
        return; // Nothing to draw or recycle
    }
    
    state.moves++;
    startTimer();
    renderBoard(true);
    runSolvabilityCheck();
}

// Try to auto-move a card to a legal spot (Foundation or Tableau)
function tryAutoMove(cardId) {
    if (state.isAnimating) return false;
    
    const card = state.deck[cardId];
    if (!card || !card.faceUp) return false;
    
    const sourcePile = findCardPile(cardId);
    if (!sourcePile) return false;
    
    let cardsToMove = [];
    if (sourcePile.type === 'tableau') {
        const col = state.tableau[sourcePile.index];
        const cardIdx = col.indexOf(cardId);
        if (cardIdx === -1) return false;
        cardsToMove = col.slice(cardIdx);
    } else if (sourcePile.type === 'waste') {
        if (state.waste[state.waste.length - 1] !== cardId) return false;
        cardsToMove = [cardId];
    } else if (sourcePile.type === 'foundation') {
        const fPile = state.foundation[sourcePile.index];
        if (fPile[fPile.length - 1] !== cardId) return false;
        cardsToMove = [cardId];
    }
    
    if (cardsToMove.length === 0) return false;
    
    const movingCard = state.deck[cardsToMove[0]];
    const suits = ['H', 'D', 'C', 'S'];
    
    // Priority 1: Move to Foundation (only allowed if moving a single card)
    if (cardsToMove.length === 1 && sourcePile.type !== 'foundation') {
        for (let f = 0; f < 4; f++) {
            const fPile = state.foundation[f];
            const fSuit = suits[f];
            if (Solver.isValidFoundationBuild(movingCard, fPile.map(id => state.deck[id]), fSuit)) {
                saveState();
                
                // Remove from source
                if (sourcePile.type === 'tableau') {
                    state.tableau[sourcePile.index].pop();
                    autoFlipTopTableau(sourcePile.index);
                } else if (sourcePile.type === 'waste') {
                    state.waste.pop();
                }
                
                // Add to foundation
                state.foundation[f].push(cardId);
                
                state.moves++;
                state.score += 10;
                
                updateStatsUI();
                renderBoard(true);
                checkGameWin();
                runSolvabilityCheck();
                return true;
            }
        }
    }
    
    // Priority 2: Move to Tableau Column
    const tableauTargets = [];
    for (let t = 0; t < 7; t++) {
        if (sourcePile.type === 'tableau' && sourcePile.index === t) continue;
        tableauTargets.push(t);
    }
    
    // Sort: non-empty tableau columns first, empty columns second
    tableauTargets.sort((a, b) => {
        const lenA = state.tableau[a].length;
        const lenB = state.tableau[b].length;
        if (lenA > 0 && lenB === 0) return -1;
        if (lenA === 0 && lenB > 0) return 1;
        return 0;
    });
    
    for (const t of tableauTargets) {
        const destCol = state.tableau[t];
        let isValid = false;
        
        if (destCol.length === 0) {
            // Kings can move to empty columns
            if (movingCard.value === 13) {
                if (sourcePile.type === 'tableau') {
                    const srcCol = state.tableau[sourcePile.index];
                    const srcCardIdx = srcCol.indexOf(cardId);
                    // Skip if it's already the bottom-most card of a column with no face-down cards underneath
                    const hasFaceDownBehind = srcCol.slice(0, srcCardIdx).some(id => !state.deck[id].faceUp);
                    if (srcCardIdx === 0 && !hasFaceDownBehind) {
                        isValid = false;
                    } else {
                        isValid = true;
                    }
                } else {
                    isValid = true; // Waste or Foundation to empty column is valid
                }
            }
        } else {
            const targetCardId = destCol[destCol.length - 1];
            const targetCard = state.deck[targetCardId];
            isValid = Solver.isValidTableauBuild(movingCard, targetCard);
        }
        
        if (isValid) {
            saveState();
            
            // Remove from source
            if (sourcePile.type === 'tableau') {
                const col = state.tableau[sourcePile.index];
                col.splice(col.length - cardsToMove.length, cardsToMove.length);
                autoFlipTopTableau(sourcePile.index);
            } else if (sourcePile.type === 'waste') {
                state.waste.splice(state.waste.length - cardsToMove.length, cardsToMove.length);
            } else if (sourcePile.type === 'foundation') {
                state.foundation[sourcePile.index].pop();
            }
            
            // Add to destination
            state.tableau[t] = state.tableau[t].concat(cardsToMove);
            
            // Score tracking
            if (sourcePile.type === 'waste') {
                state.score += 5;
            } else if (sourcePile.type === 'foundation') {
                state.score = Math.max(0, state.score - 15);
            }
            
            state.moves++;
            startTimer();
            updateStatsUI();
            renderBoard(true);
            checkGameWin();
            runSolvabilityCheck();
            return true;
        }
    }
    
    return false;
}

// Check and perform double-click auto-move
function handleDoubleClick(e) {
    const cardEl = e.currentTarget;
    tryAutoMove(cardEl.id);
}

// Find which pile a card is currently in
function findCardPile(cardId) {
    // Check waste
    if (state.waste.includes(cardId)) {
        return { type: 'waste', index: 0 };
    }
    
    // Check foundation
    for (let f = 0; f < 4; f++) {
        if (state.foundation[f].includes(cardId)) {
            return { type: 'foundation', index: f };
        }
    }
    
    // Check tableau
    for (let t = 0; t < 7; t++) {
        if (state.tableau[t].includes(cardId)) {
            return { type: 'tableau', index: t };
        }
    }
    
    return null;
}

// Auto-flip the top card of a tableau column if it's face down
function autoFlipTopTableau(colIndex) {
    const col = state.tableau[colIndex];
    if (col.length > 0) {
        const topCardId = col[col.length - 1];
        if (!state.deck[topCardId].faceUp) {
            state.deck[topCardId].faceUp = true;
            state.score += 5; // +5 points for flipping card
            return true;
        }
    }
    return false;
}

/* --- Custom Pointer-Event Drag & Drop --- */

function handlePointerDown(e) {
    // Only left click/primary pointer, and when not animating
    if (e.button !== 0 || state.isAnimating) return;
    
    const cardEl = e.currentTarget;
    const cardId = cardEl.id;
    const card = state.deck[cardId];
    
    // Can only drag face-up cards
    if (!card.faceUp) {
        return;
    }
    
    const sourcePile = findCardPile(cardId);
    if (!sourcePile) return;
    
    // Identify which cards are being dragged
    let draggedCards = [];
    if (sourcePile.type === 'tableau') {
        const col = state.tableau[sourcePile.index];
        const cardIdx = col.indexOf(cardId);
        // Drag this card and all cards stacked below it
        draggedCards = col.slice(cardIdx);
    } else if (sourcePile.type === 'waste') {
        // Only the top waste card can be dragged
        if (state.waste[state.waste.length - 1] !== cardId) return;
        draggedCards = [cardId];
    } else if (sourcePile.type === 'foundation') {
        // Only the top foundation card can be dragged
        const fPile = state.foundation[sourcePile.index];
        if (fPile[fPile.length - 1] !== cardId) return;
        draggedCards = [cardId];
    }
    
    if (draggedCards.length === 0) return;
    
    // Set active drag state
    drag.active = true;
    drag.isDragging = false;
    drag.pointerId = e.pointerId;
    drag.startX = e.clientX;
    drag.startY = e.clientY;
    drag.cards = draggedCards;
    drag.sourcePile = sourcePile;
    
    // Get card position relative to viewport to calculate pointer offset
    const rect = cardEl.getBoundingClientRect();
    drag.dragOffset.x = e.clientX - rect.left;
    drag.dragOffset.y = e.clientY - rect.top;
    
    // Record original screen positions of all cards in the stack for snapping back
    drag.originalOffsets = draggedCards.map(id => {
        const el = cardDOMElements[id];
        const r = el.getBoundingClientRect();
        return {
            id: id,
            top: el.style.top,
            zIndex: el.style.zIndex,
            parent: el.parentElement,
            rect: r
        };
    });
    
    // Set up floating drag container
    dom.dragContainer.style.left = `${rect.left}px`;
    dom.dragContainer.style.top = `${rect.top}px`;
    
    // Move dragged elements to drag container
    draggedCards.forEach((id, index) => {
        const el = cardDOMElements[id];
        el.classList.add('dragging');
        dom.dragContainer.appendChild(el);
        
        // Offset stacked cards in drag container
        el.style.top = `${index * 26}px`;
        el.style.left = '0px';
        el.style.zIndex = (index + 1).toString();
    });
    
    // Capture pointer to receive move/up events even if pointer leaves card
    cardEl.setPointerCapture(e.pointerId);
    cardEl.addEventListener('pointermove', handlePointerMove);
    cardEl.addEventListener('pointerup', handlePointerUp);
    cardEl.addEventListener('pointercancel', handlePointerCancel);
}

function handlePointerMove(e) {
    if (!drag.active || drag.pointerId !== e.pointerId) return;
    
    // Distance check to confirm user is dragging
    const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
    if (dist > 4) {
        drag.isDragging = true;
    }
    
    if (drag.isDragging) {
        const x = e.clientX - drag.dragOffset.x;
        const y = e.clientY - drag.dragOffset.y;
        
        dom.dragContainer.style.left = `${x}px`;
        dom.dragContainer.style.top = `${y}px`;
        
        // Visual feedback: Highlight potential drop targets
        highlightPotentialTargets(e.clientX, e.clientY);
    }
}

function handlePointerUp(e) {
    if (!drag.active || drag.pointerId !== e.pointerId) return;
    
    const cardEl = e.currentTarget;
    cardEl.releasePointerCapture(e.pointerId);
    
    // Remove listeners
    cardEl.removeEventListener('pointermove', handlePointerMove);
    cardEl.removeEventListener('pointerup', handlePointerUp);
    cardEl.removeEventListener('pointercancel', handlePointerCancel);
    
    if (drag.isDragging) {
        // Find target pile
        const targetPile = findDropTarget(e.clientX, e.clientY);
        
        let moveSuccessful = false;
        
        if (targetPile) {
            moveSuccessful = executeDragMove(targetPile);
        }
        
        if (!moveSuccessful) {
            // Snap back with animation
            snapBackCards();
        } else {
            // Move was successful, finalize state
            drag.cards.forEach(id => {
                cardDOMElements[id].classList.remove('dragging');
            });
            drag.active = false;
            drag.isDragging = false;
            
            state.moves++;
            startTimer();
            updateStatsUI();
            
            checkGameWin();
            runSolvabilityCheck();
        }
        
        // Clean up highlights
        clearHighlights();
    } else {
        // User tapped the card without dragging!
        // Instantly restore cards to original parent before performing tap auto-move
        drag.originalOffsets.forEach(orig => {
            const el = cardDOMElements[orig.id];
            el.classList.remove('dragging');
            orig.parent.appendChild(el);
            el.style.top = orig.top;
            el.style.zIndex = orig.zIndex;
        });
        
        const tappedCardId = drag.cards[0];
        drag.active = false;
        drag.isDragging = false;
        
        tryAutoMove(tappedCardId);
    }
}

function handlePointerCancel(e) {
    const cardEl = e.currentTarget;
    cardEl.releasePointerCapture(e.pointerId);
    cardEl.removeEventListener('pointermove', handlePointerMove);
    cardEl.removeEventListener('pointerup', handlePointerUp);
    cardEl.removeEventListener('pointercancel', handlePointerCancel);
    
    if (drag.isDragging) {
        snapBackCards();
        clearHighlights();
    } else {
        drag.originalOffsets.forEach(orig => {
            const el = cardDOMElements[orig.id];
            el.classList.remove('dragging');
            orig.parent.appendChild(el);
            el.style.top = orig.top;
            el.style.zIndex = orig.zIndex;
        });
        drag.active = false;
        drag.isDragging = false;
    }
}

// Highlights valid piles under the dragging pointer
function highlightPotentialTargets(clientX, clientY) {
    clearHighlights();
    
    const target = findDropTarget(clientX, clientY);
    if (!target) return;
    
    if (target.type === 'tableau') {
        dom.tableaus[target.index].classList.add('highlight-drop');
    } else if (target.type === 'foundation') {
        dom.foundations[target.index].classList.add('highlight-drop');
    }
}

function clearHighlights() {
    dom.tableaus.forEach(el => el.classList.remove('highlight-drop'));
    dom.foundations.forEach(el => el.classList.remove('highlight-drop'));
}

// Find which pile lies under the current pointer coordinates
function findDropTarget(x, y) {
    // Temporarily hide drag container so elementFromPoint sees underneath it
    // Wait, we already have pointer-events: none on drag container, so we don't need to hide it!
    const element = document.elementFromPoint(x, y);
    if (!element) return null;
    
    // 1. Check if hovering over a tableau column or card in a tableau column
    const tableauCol = element.closest('.tableau-column');
    if (tableauCol) {
        const idx = parseInt(tableauCol.getAttribute('data-index'));
        return { type: 'tableau', index: idx };
    }
    
    // 2. Check if hovering over a foundation pile or card in a foundation pile
    const foundationPile = element.closest('.foundation-pile');
    if (foundationPile) {
        const idStr = foundationPile.id; // foundation-0, etc
        const idx = parseInt(idStr.split('-')[1]);
        return { type: 'foundation', index: idx };
    }
    
    // 3. Check if hovering over a card and climb up to find its column/pile
    const card = element.closest('.card');
    if (card && !card.classList.contains('dragging')) {
        const parent = card.parentElement;
        if (parent.classList.contains('tableau-column')) {
            const idx = parseInt(parent.getAttribute('data-index'));
            return { type: 'tableau', index: idx };
        } else if (parent.classList.contains('foundation-pile')) {
            const idStr = parent.id;
            const idx = parseInt(idStr.split('-')[1]);
            return { type: 'foundation', index: idx };
        }
    }
    
    return null;
}

// Validate and execute the drag-and-drop move
function executeDragMove(target) {
    const movingCardId = drag.cards[0];
    const movingCard = state.deck[movingCardId];
    
    // 1. Move to Tableau Column
    if (target.type === 'tableau') {
        const destCol = state.tableau[target.index];
        
        let isValid = false;
        if (destCol.length === 0) {
            // Only Kings can start empty columns
            isValid = (movingCard.value === 13);
        } else {
            const targetCardId = destCol[destCol.length - 1];
            const targetCard = state.deck[targetCardId];
            isValid = Solver.isValidTableauBuild(movingCard, targetCard);
        }
        
        if (isValid) {
            saveState();
            
            // Remove from source
            removeCardsFromSource();
            
            // Add to destination
            state.tableau[target.index] = state.tableau[target.index].concat(drag.cards);
            
            // Score tracking
            if (drag.sourcePile.type === 'waste') {
                state.score += 5; // Waste to Tableau
            } else if (drag.sourcePile.type === 'foundation') {
                state.score = Math.max(0, state.score - 15); // Foundation to Tableau (penalty)
            }
            
            // Handle source reveal
            if (drag.sourcePile.type === 'tableau') {
                autoFlipTopTableau(drag.sourcePile.index);
            }
            
            renderBoard(true);
            return true;
        }
    }
    
    // 2. Move to Foundation Pile
    if (target.type === 'foundation') {
        // Can only move a single card to foundation
        if (drag.cards.length > 1) return false;
        
        const destPile = state.foundation[target.index];
        const suits = ['H', 'D', 'C', 'S'];
        const fSuit = suits[target.index];
        
        const isValid = Solver.isValidFoundationBuild(movingCard, destPile.map(id => state.deck[id]), fSuit);
        
        if (isValid) {
            saveState();
            
            // Remove from source
            removeCardsFromSource();
            
            // Add to foundation
            state.foundation[target.index].push(movingCardId);
            
            // Score tracking
            if (drag.sourcePile.type === 'tableau') {
                state.score += 10; // Tableau to Foundation
            } else if (drag.sourcePile.type === 'waste') {
                state.score += 10; // Waste to Foundation
            }
            
            // Handle source reveal
            if (drag.sourcePile.type === 'tableau') {
                autoFlipTopTableau(drag.sourcePile.index);
            }
            
            renderBoard(true);
            return true;
        }
    }
    
    return false;
}

// Remove dragged cards from their source pile in the state
function removeCardsFromSource() {
    const count = drag.cards.length;
    if (drag.sourcePile.type === 'tableau') {
        const col = state.tableau[drag.sourcePile.index];
        col.splice(col.length - count, count);
    } else if (drag.sourcePile.type === 'waste') {
        state.waste.splice(state.waste.length - count, count);
    } else if (drag.sourcePile.type === 'foundation') {
        state.foundation[drag.sourcePile.index].pop();
    }
}

// Snap dragged cards back to their original positions with an animation
function snapBackCards() {
    state.isAnimating = true;
    
    let completedCount = 0;
    const total = drag.cards.length;
    
    drag.originalOffsets.forEach((orig, index) => {
        const el = cardDOMElements[orig.id];
        el.classList.remove('dragging');
        
        // 1. Calculate current screen position of the card inside the floating container
        const currentRect = el.getBoundingClientRect();
        
        // 2. Put it back in its original parent
        orig.parent.appendChild(el);
        el.style.top = orig.top;
        el.style.zIndex = orig.zIndex;
        
        // 3. Calculate target screen position
        const targetRect = el.getBoundingClientRect();
        
        // 4. Set transition and transform
        const dx = currentRect.left - targetRect.left;
        const dy = currentRect.top - targetRect.top;
        
        const isFlipped = el.classList.contains('face-down');
        const rotY = isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
        
        el.style.transition = 'none';
        el.style.transform = `translate(${dx}px, ${dy}px) ${rotY}`;
        
        // Force reflow
        el.offsetHeight;
        
        // Animate
        el.style.transition = 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)';
        el.style.transform = `translate(0px, 0px) ${rotY}`;
        
        // Clean up
        setTimeout(() => {
            el.style.transition = '';
            completedCount++;
            if (completedCount === total) {
                state.isAnimating = false;
                drag.active = false;
                renderBoard(false); // Clean redraw
            }
        }, 260);
    });
}

/* --- Undo / Redo History System --- */

// Save deep copy of game state to history
function saveState() {
    // Keep history size reasonable
    if (state.history.length > 50) {
        state.history.shift();
    }
    
    const stateCopy = {
        deck: JSON.parse(JSON.stringify(state.deck)),
        stock: [...state.stock],
        waste: [...state.waste],
        tableau: state.tableau.map(col => [...col]),
        foundation: state.foundation.map(f => [...f]),
        score: state.score,
        moves: state.moves
    };
    
    state.history.push(stateCopy);
    state.redoStack = []; // Clear redo stack on new actions
}

function undo() {
    if (state.history.length === 0 || state.isAnimating) return;
    
    // Save current state to redo stack
    const currentCopy = {
        deck: JSON.parse(JSON.stringify(state.deck)),
        stock: [...state.stock],
        waste: [...state.waste],
        tableau: state.tableau.map(col => [...col]),
        foundation: state.foundation.map(f => [...f]),
        score: state.score,
        moves: state.moves
    };
    state.redoStack.push(currentCopy);
    
    // Restore state
    const prevState = state.history.pop();
    restoreState(prevState);
    
    state.moves++;
    updateStatsUI();
    renderBoard(true);
    runSolvabilityCheck();
}

function redo() {
    if (state.redoStack.length === 0 || state.isAnimating) return;
    
    // Save current state to history
    const currentCopy = {
        deck: JSON.parse(JSON.stringify(state.deck)),
        stock: [...state.stock],
        waste: [...state.waste],
        tableau: state.tableau.map(col => [...col]),
        foundation: state.foundation.map(f => [...f]),
        score: state.score,
        moves: state.moves
    };
    state.history.push(currentCopy);
    
    // Restore state
    const nextState = state.redoStack.pop();
    restoreState(nextState);
    
    state.moves++;
    updateStatsUI();
    renderBoard(true);
    runSolvabilityCheck();
}

function restoreState(savedState) {
    state.deck = savedState.deck;
    state.stock = savedState.stock;
    state.waste = savedState.waste;
    state.tableau = savedState.tableau;
    state.foundation = savedState.foundation;
    state.score = savedState.score;
}

/* --- HUD Stats & Timer --- */

function startTimer() {
    if (state.startTime) return; // Already running
    
    state.startTime = Date.now() - (state.elapsedSeconds * 1000);
    state.timerInterval = setInterval(() => {
        state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
        updateTimerUI();
    }, 1000);
}

function stopTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
}

function updateTimerUI() {
    const minutes = Math.floor(state.elapsedSeconds / 60);
    const seconds = state.elapsedSeconds % 60;
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    dom.timer.textContent = timeStr;
}

function updateStatsUI() {
    dom.moves.textContent = state.moves.toString();
    dom.score.textContent = state.score.toString();
}

/* --- Solvability Analysis & Win Detection --- */

function runSolvabilityCheck() {
    // If game is already won, don't show unsolvable
    const isWon = checkGameWin(false);
    if (isWon) return;
    
    // Check if auto-solve is available
    if (Solver.canAutoSolve(state)) {
        updateSolvabilityUI('autosolve');
        // Start auto-solve automatically!
        triggerAutoSolve();
        return;
    }
    
    // Standard solvability check
    const isSolvable = Solver.checkSolvability(state);
    
    if (isSolvable) {
        updateSolvabilityUI('solvable');
        hideUnsolvableBanner();
    } else {
        updateSolvabilityUI('unsolvable');
        showUnsolvableBanner();
    }
}

function updateSolvabilityUI(status) {
    dom.statusDot.className = 'status-dot';
    
    if (status === 'solvable') {
        dom.statusDot.classList.add('green');
        dom.statusText.textContent = 'Moves Available';
    } else if (status === 'autosolve') {
        dom.statusDot.classList.add('green');
        dom.statusText.textContent = 'Solving Board... ⚡';
    } else if (status === 'unsolvable') {
        dom.statusDot.classList.add('yellow');
        dom.statusText.textContent = 'No Moves Left ⚠️';
    }
}

function showUnsolvableBanner() {
    dom.unsolvableBanner.classList.add('active');
}

function hideUnsolvableBanner() {
    dom.unsolvableBanner.classList.remove('active');
}

function checkGameWin(triggerUI = true) {
    // Check if all 4 foundations are full (13 cards each)
    const isWon = state.foundation.every(f => f.length === 13);
    
    if (isWon && triggerUI) {
        stopTimer();
        showWinModal();
    }
    
    return isWon;
}

/* --- Auto-Solve Sequence --- */

function triggerAutoSolve() {
    if (state.isAnimating) return;
    
    state.isAnimating = true;
    
    const runStep = () => {
        // Verify win first
        if (checkGameWin(true)) {
            state.isAnimating = false;
            return;
        }
        
        const nextMove = Solver.findNextAutoSolveMove(state);
        
        if (!nextMove) {
            state.isAnimating = false;
            runSolvabilityCheck(); // Recalculate
            return;
        }
        
        // Execute the auto-move
        let moveMade = false;
        
        if (nextMove.type === 'tableau_to_foundation') {
            const { cardId, fromIndex, toIndex } = nextMove;
            state.tableau[fromIndex].pop();
            state.foundation[toIndex].push(cardId);
            state.score += 10;
            state.moves++;
            moveMade = true;
        } else if (nextMove.type === 'waste_to_foundation') {
            const { cardId, toIndex } = nextMove;
            state.waste.pop();
            state.foundation[toIndex].push(cardId);
            state.score += 10;
            state.moves++;
            moveMade = true;
        } else if (nextMove.type === 'draw_card') {
            const cardId = state.stock.pop();
            state.deck[cardId].faceUp = true;
            state.waste.push(cardId);
            state.moves++;
            moveMade = true;
        } else if (nextMove.type === 'recycle_waste') {
            state.stock = [...state.waste].reverse();
            state.stock.forEach(id => {
                state.deck[id].faceUp = false;
            });
            state.waste = [];
            state.moves++;
            moveMade = true;
        }
        
        if (moveMade) {
            updateStatsUI();
            renderBoard(true);
            
            // Schedule next step with a slight delay for beautiful animated cascade
            setTimeout(runStep, 180);
        } else {
            state.isAnimating = false;
        }
    };
    
    // Start the cascade
    setTimeout(runStep, 400);
}

/* --- UI Modals & Celebrations --- */

function showWinModal() {
    const minutes = Math.floor(state.elapsedSeconds / 60);
    const seconds = state.elapsedSeconds % 60;
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    dom.winTime.textContent = timeStr;
    dom.winMoves.textContent = state.moves.toString();
    dom.winScore.textContent = state.score.toString();
    
    dom.winModal.classList.add('active');
    
    // Launch Confetti!
    launchConfettiCelebration();
}

function hideWinModal() {
    dom.winModal.classList.remove('active');
}

// Confetti Effect
function launchConfettiCelebration() {
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6'];
    
    for (let i = 0; i < 100; i++) {
        const conf = document.createElement('div');
        conf.className = 'confetti-particle';
        conf.style.left = `${Math.random() * 100}vw`;
        conf.style.top = `-10px`;
        conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        conf.style.width = `${Math.random() * 8 + 6}px`;
        conf.style.height = `${Math.random() * 12 + 6}px`;
        conf.style.opacity = Math.random().toString();
        conf.style.transform = `rotate(${Math.random() * 360}deg)`;
        conf.style.position = 'fixed';
        conf.style.zIndex = '9999';
        conf.style.pointerEvents = 'none';
        
        document.body.appendChild(conf);
        
        // Animate
        const duration = Math.random() * 2.5 + 2;
        const xOffset = (Math.random() - 0.5) * 200;
        
        conf.animate([
            { transform: `translate(0, 0) rotate(0deg)`, opacity: 1 },
            { transform: `translate(${xOffset}px, 105vh) rotate(${Math.random() * 720}deg)`, opacity: 0 }
        ], {
            duration: duration * 1000,
            easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)',
            fill: 'forwards'
        });
        
        setTimeout(() => conf.remove(), duration * 1000);
    }
}

/* --- Theme Handling --- */

function toggleTheme() {
    if (state.theme === 'felt') {
        state.theme = 'dark';
        document.documentElement.setAttribute('data-theme', 'dark');
        dom.themeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
    } else {
        state.theme = 'felt';
        document.documentElement.removeAttribute('data-theme');
        dom.themeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
    }
}

/* --- Event Binding --- */

dom.stock.addEventListener('click', () => {
    drawCard();
});

dom.newGameBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to start a new game? Current progress will be lost.')) {
        initGame();
    }
});

dom.undoBtn.addEventListener('click', undo);
dom.redoBtn.addEventListener('click', redo);
dom.themeBtn.addEventListener('click', toggleTheme);
dom.playAgainBtn.addEventListener('click', () => {
    initGame();
});

dom.bannerUndo.addEventListener('click', () => {
    undo();
    hideUnsolvableBanner();
});

dom.bannerNew.addEventListener('click', () => {
    initGame();
});

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+Z for Undo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
    }
    // Ctrl+Y for Redo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
    }
});

// Start the game on load
window.addEventListener('DOMContentLoaded', () => {
    initGame();
});
