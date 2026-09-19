/**
 * Solitaire Solver and Auto-Solve Engine
 */

const Solver = {
    // Helper to get card object from ID
    getCard(id, deck) {
        return deck[id];
    },

    // Helper to check if two cards can be stacked in the Tableau (descending, alternating colors)
    isValidTableauBuild(childCard, parentCard) {
        if (!childCard || !parentCard) return false;
        
        const childColor = (childCard.suit === 'H' || childCard.suit === 'D') ? 'red' : 'black';
        const parentColor = (parentCard.suit === 'H' || parentCard.suit === 'D') ? 'red' : 'black';
        
        return (childColor !== parentColor) && (childCard.value === parentCard.value - 1);
    },

    // Helper to check if a card can be placed on a Foundation (ascending by suit)
    isValidFoundationBuild(card, foundationPile, foundationSuit) {
        if (!card) return false;
        if (card.suit !== foundationSuit) return false;
        
        if (foundationPile.length === 0) {
            return card.value === 1; // Must be Ace
        } else {
            const topCard = foundationPile[foundationPile.length - 1];
            return card.value === topCard.value + 1;
        }
    },

    /**
     * Checks if there are any valid moves remaining in the game.
     * @param {Object} state - The current game state
     * @returns {boolean} True if moves are available, false if unsolvable
     */
    checkSolvability(state) {
        const { tableau, foundation, stock, waste, deck } = state;
        
        // 1. Check Tableau to Foundation moves
        // Only the top card of a tableau column (last item in the array) can go to foundation
        for (let i = 0; i < 7; i++) {
            const col = tableau[i];
            if (col.length > 0) {
                const card = deck[col[col.length - 1]];
                for (let f = 0; f < 4; f++) {
                    const fPile = foundation[f];
                    const fSuit = ['H', 'D', 'C', 'S'][f]; // Assuming foundations are mapped this way
                    if (this.isValidFoundationBuild(card, fPile.map(id => deck[id]), fSuit)) {
                        return true; // Can move tableau card to foundation
                    }
                }
            }
        }

        // 2. Check Tableau to Tableau moves
        // Any face-up card (and the stack below it) can be moved to another column
        for (let srcIdx = 0; srcIdx < 7; srcIdx++) {
            const srcCol = tableau[srcIdx];
            if (srcCol.length === 0) continue;

            // Find the index of the first face-up card in this column
            let firstFaceUpIdx = -1;
            for (let k = 0; k < srcCol.length; k++) {
                if (deck[srcCol[k]].faceUp) {
                    firstFaceUpIdx = k;
                    break;
                }
            }

            if (firstFaceUpIdx === -1) continue;

            // We can try to move any stack starting from firstFaceUpIdx to the end of the column
            for (let k = firstFaceUpIdx; k < srcCol.length; k++) {
                const cardToMove = deck[srcCol[k]];
                
                // Try to place it on any other column
                for (let destIdx = 0; destIdx < 7; destIdx++) {
                    if (srcIdx === destIdx) continue;
                    
                    const destCol = tableau[destIdx];
                    if (destCol.length === 0) {
                        // Can move a King to an empty column
                        // Exception: Moving a King that is already the bottom-most card of its column
                        // and has no face-down cards under it is a useless move (doesn't progress the game)
                        if (cardToMove.value === 13 && k > 0) {
                            return true; 
                        }
                    } else {
                        const targetCard = deck[destCol[destCol.length - 1]];
                        // Only the top card of a moving stack needs to match the target card
                        if (k === firstFaceUpIdx || k === srcCol.length - 1) {
                            // Normally we move the entire face-up stack. 
                            // In some cases we might split a stack, but in Klondike, you usually move the whole face-up stack.
                            // Let's check if the card at 'k' can be placed on 'targetCard'
                            if (this.isValidTableauBuild(cardToMove, targetCard)) {
                                // If it's a split move, is it useful? Yes, if it exposes a face-down card or frees a column.
                                return true;
                            }
                        }
                    }
                }
            }
        }

        // 3. Check Waste to Tableau / Foundation
        if (waste.length > 0) {
            const wasteCard = deck[waste[waste.length - 1]];
            
            // Can it go to Tableau?
            for (let i = 0; i < 7; i++) {
                const col = tableau[i];
                if (col.length === 0) {
                    if (wasteCard.value === 13) return true; // King to empty
                } else {
                    const targetCard = deck[col[col.length - 1]];
                    if (this.isValidTableauBuild(wasteCard, targetCard)) return true;
                }
            }
            
            // Can it go to Foundation?
            for (let f = 0; f < 4; f++) {
                const fPile = foundation[f];
                const fSuit = ['H', 'D', 'C', 'S'][f];
                if (this.isValidFoundationBuild(wasteCard, fPile.map(id => deck[id]), fSuit)) return true;
            }
        }

        // 4. Check Stock Pile (and rest of Waste)
        // If there are cards in the stock, we can draw. 
        // But drawing is only useful if some card in the stock/waste can eventually be played.
        // Let's check if ANY card in the stock or waste can be played on the current board state.
        const deckCardsToCheck = [...stock, ...waste];
        for (const cardId of deckCardsToCheck) {
            const card = deck[cardId];
            
            // Can this card be played on any tableau?
            for (let i = 0; i < 7; i++) {
                const col = tableau[i];
                if (col.length === 0) {
                    if (card.value === 13) return true;
                } else {
                    const targetCard = deck[col[col.length - 1]];
                    if (this.isValidTableauBuild(card, targetCard)) return true;
                }
            }
            
            // Can this card be played on any foundation?
            for (let f = 0; f < 4; f++) {
                const fPile = foundation[f];
                const fSuit = ['H', 'D', 'C', 'S'][f];
                if (this.isValidFoundationBuild(card, fPile.map(id => deck[id]), fSuit)) return true;
            }
        }

        // If we reach here, absolutely no moves are possible
        return false;
    },

    /**
     * Checks if the game is ready for Auto-Solve.
     * Auto-solve is available when all cards in the tableau are face-up,
     * and there are no face-down cards remaining (stock/waste can still have cards,
     * we will just auto-play them).
     */
    canAutoSolve(state) {
        const { tableau, deck } = state;
        
        // Check if there are any face-down cards in the tableau
        for (let i = 0; i < 7; i++) {
            for (const cardId of tableau[i]) {
                if (!deck[cardId].faceUp) return false;
            }
        }
        
        // If all cards in the tableau are face-up, we can auto-solve
        return true;
    },

    /**
     * Finds the next single move to perform during Auto-Solve.
     * Returns an object describing the move, or null if no move can be made.
     */
    findNextAutoSolveMove(state) {
        const { tableau, foundation, stock, waste, deck } = state;
        const suits = ['H', 'D', 'C', 'S'];

        // Helper to check if a card can go to a foundation
        const getTargetFoundationIndex = (card) => {
            for (let f = 0; f < 4; f++) {
                const fPile = foundation[f];
                const fSuit = suits[f];
                if (this.isValidFoundationBuild(card, fPile.map(id => deck[id]), fSuit)) {
                    return f;
                }
            }
            return -1;
        };

        // 1. Try to move from Tableau to Foundation
        for (let i = 0; i < 7; i++) {
            const col = tableau[i];
            if (col.length > 0) {
                const cardId = col[col.length - 1];
                const card = deck[cardId];
                const fIdx = getTargetFoundationIndex(card);
                if (fIdx !== -1) {
                    return {
                        type: 'tableau_to_foundation',
                        cardId: cardId,
                        fromIndex: i,
                        toIndex: fIdx
                    };
                }
            }
        }

        // 2. Try to move from Waste to Foundation
        if (waste.length > 0) {
            const cardId = waste[waste.length - 1];
            const card = deck[cardId];
            const fIdx = getTargetFoundationIndex(card);
            if (fIdx !== -1) {
                return {
                    type: 'waste_to_foundation',
                    cardId: cardId,
                    toIndex: fIdx
                };
            }
        }

        // 3. If no cards can go to foundation, but we have cards in stock/waste,
        // we should draw a card to reveal more, or cycle the deck.
        if (stock.length > 0) {
            return {
                type: 'draw_card'
            };
        } else if (waste.length > 0) {
            // If stock is empty but waste has cards, recycle them
            return {
                type: 'recycle_waste'
            };
        }

        return null; // No more moves (should not happen if game is winnable and we are auto-solving)
    }
};

// Export for use in app.js
window.Solver = Solver;
