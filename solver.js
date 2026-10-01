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
     * Format card into human-readable representation (e.g. ♥A, ♠K, ♦10)
     */
    getCardName(card) {
        if (!card) return '';
        const suitSymbols = { H: '♥', D: '♦', C: '♣', S: '♠' };
        const rankLabels = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
        const rankStr = rankLabels[card.value] || card.value.toString();
        return `${suitSymbols[card.suit]}${rankStr}`;
    },

    /**
     * Checks if there are any valid, productive moves remaining in the game.
     * @param {Object} state - The current game state
     * @returns {boolean} True if useful moves are available, false if unsolvable
     */
    checkSolvability(state) {
        const { tableau, foundation, stock, waste, deck } = state;
        const suits = ['H', 'D', 'C', 'S'];
        
        // 1. Check Tableau to Foundation moves
        for (let i = 0; i < 7; i++) {
            const col = tableau[i];
            if (col.length > 0) {
                const card = deck[col[col.length - 1]];
                for (let f = 0; f < 4; f++) {
                    const fPile = foundation[f];
                    const fSuit = suits[f];
                    if (this.isValidFoundationBuild(card, fPile.map(id => deck[id]), fSuit)) {
                        return true;
                    }
                }
            }
        }

        // 2. Check Tableau to Tableau moves (Filter out useless cyclic moves)
        for (let srcIdx = 0; srcIdx < 7; srcIdx++) {
            const srcCol = tableau[srcIdx];
            if (srcCol.length === 0) continue;

            let firstFaceUpIdx = -1;
            for (let k = 0; k < srcCol.length; k++) {
                if (deck[srcCol[k]].faceUp) {
                    firstFaceUpIdx = k;
                    break;
                }
            }
            if (firstFaceUpIdx === -1) continue;

            // Check moving the entire face-up stack starting at firstFaceUpIdx
            const cardToMove = deck[srcCol[firstFaceUpIdx]];
            for (let destIdx = 0; destIdx < 7; destIdx++) {
                if (srcIdx === destIdx) continue;
                const destCol = tableau[destIdx];

                if (destCol.length === 0) {
                    // Moving a King to an empty column is useful if it exposes a face-down card
                    if (cardToMove.value === 13 && firstFaceUpIdx > 0) {
                        return true;
                    }
                } else {
                    const targetCard = deck[destCol[destCol.length - 1]];
                    if (this.isValidTableauBuild(cardToMove, targetCard)) {
                        // Moving stack is useful if:
                        // a) It reveals a face-down card (firstFaceUpIdx > 0)
                        // b) It clears the source column completely (firstFaceUpIdx === 0 and non-King)
                        if (firstFaceUpIdx > 0) {
                            return true;
                        }
                        if (firstFaceUpIdx === 0 && cardToMove.value !== 13) {
                            return true;
                        }
                    }
                }
            }

            // Check if splitting a stack (at k > firstFaceUpIdx) allows the newly exposed card at k-1 to go to Foundation
            for (let k = firstFaceUpIdx + 1; k < srcCol.length; k++) {
                const subCardToMove = deck[srcCol[k]];
                const exposedCard = deck[srcCol[k - 1]];

                let exposedCanGoToFoundation = false;
                for (let f = 0; f < 4; f++) {
                    const fPile = foundation[f];
                    const fSuit = suits[f];
                    if (this.isValidFoundationBuild(exposedCard, fPile.map(id => deck[id]), fSuit)) {
                        exposedCanGoToFoundation = true;
                        break;
                    }
                }

                if (exposedCanGoToFoundation) {
                    for (let destIdx = 0; destIdx < 7; destIdx++) {
                        if (srcIdx === destIdx) continue;
                        const destCol = tableau[destIdx];
                        if (destCol.length > 0) {
                            const targetCard = deck[destCol[destCol.length - 1]];
                            if (this.isValidTableauBuild(subCardToMove, targetCard)) {
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
            
            for (let i = 0; i < 7; i++) {
                const col = tableau[i];
                if (col.length === 0) {
                    if (wasteCard.value === 13) return true;
                } else {
                    const targetCard = deck[col[col.length - 1]];
                    if (this.isValidTableauBuild(wasteCard, targetCard)) return true;
                }
            }
            
            for (let f = 0; f < 4; f++) {
                const fPile = foundation[f];
                const fSuit = suits[f];
                if (this.isValidFoundationBuild(wasteCard, fPile.map(id => deck[id]), fSuit)) return true;
            }
        }

        // 4. Check Stock Pile (and rest of Waste)
        const deckCardsToCheck = [...stock, ...waste];
        for (const cardId of deckCardsToCheck) {
            const card = deck[cardId];
            
            for (let i = 0; i < 7; i++) {
                const col = tableau[i];
                if (col.length === 0) {
                    if (card.value === 13) return true;
                } else {
                    const targetCard = deck[col[col.length - 1]];
                    if (this.isValidTableauBuild(card, targetCard)) return true;
                }
            }
            
            for (let f = 0; f < 4; f++) {
                const fPile = foundation[f];
                const fSuit = suits[f];
                if (this.isValidFoundationBuild(card, fPile.map(id => deck[id]), fSuit)) return true;
            }
        }

        return false;
    },

    /**
     * Evaluates all legal moves and returns the best recommended next move.
     * @param {Object} state - The current game state
     * @returns {Object|null} Move recommendation object or null if no moves
     */
    getBestMove(state) {
        const { tableau, foundation, stock, waste, deck } = state;
        const suits = ['H', 'D', 'C', 'S'];

        // 1. Priority 1: Tableau to Foundation
        for (let i = 0; i < 7; i++) {
            const col = tableau[i];
            if (col.length > 0) {
                const cardId = col[col.length - 1];
                const card = deck[cardId];
                for (let f = 0; f < 4; f++) {
                    const fPile = foundation[f];
                    const fSuit = suits[f];
                    if (this.isValidFoundationBuild(card, fPile.map(id => deck[id]), fSuit)) {
                        return {
                            type: 'tableau_to_foundation',
                            fromType: 'tableau',
                            fromIndex: i,
                            toType: 'foundation',
                            toIndex: f,
                            cardId: cardId,
                            description: `Move ${this.getCardName(card)} to Foundation`
                        };
                    }
                }
            }
        }

        // 2. Priority 2: Waste to Foundation
        if (waste.length > 0) {
            const cardId = waste[waste.length - 1];
            const card = deck[cardId];
            for (let f = 0; f < 4; f++) {
                const fPile = foundation[f];
                const fSuit = suits[f];
                if (this.isValidFoundationBuild(card, fPile.map(id => deck[id]), fSuit)) {
                    return {
                        type: 'waste_to_foundation',
                        fromType: 'waste',
                        fromIndex: 0,
                        toType: 'foundation',
                        toIndex: f,
                        cardId: cardId,
                        description: `Move ${this.getCardName(card)} to Foundation`
                    };
                }
            }
        }

        // 3. Priority 3: Tableau to Tableau that reveals a face-down card
        for (let srcIdx = 0; srcIdx < 7; srcIdx++) {
            const srcCol = tableau[srcIdx];
            if (srcCol.length === 0) continue;

            let firstFaceUpIdx = -1;
            for (let k = 0; k < srcCol.length; k++) {
                if (deck[srcCol[k]].faceUp) {
                    firstFaceUpIdx = k;
                    break;
                }
            }
            if (firstFaceUpIdx <= 0) continue; // Must have face-down cards underneath to reveal

            const cardId = srcCol[firstFaceUpIdx];
            const movingCard = deck[cardId];

            for (let destIdx = 0; destIdx < 7; destIdx++) {
                if (srcIdx === destIdx) continue;
                const destCol = tableau[destIdx];

                if (destCol.length === 0) {
                    if (movingCard.value === 13) {
                        return {
                            type: 'tableau_to_tableau',
                            fromType: 'tableau',
                            fromIndex: srcIdx,
                            toType: 'tableau',
                            toIndex: destIdx,
                            cardId: cardId,
                            description: `Move ${this.getCardName(movingCard)} to empty Column ${destIdx + 1}`
                        };
                    }
                } else {
                    const targetCard = deck[destCol[destCol.length - 1]];
                    if (this.isValidTableauBuild(movingCard, targetCard)) {
                        return {
                            type: 'tableau_to_tableau',
                            fromType: 'tableau',
                            fromIndex: srcIdx,
                            toType: 'tableau',
                            toIndex: destIdx,
                            cardId: cardId,
                            description: `Move ${this.getCardName(movingCard)} onto ${this.getCardName(targetCard)}`
                        };
                    }
                }
            }
        }

        // 4. Priority 4: Waste to Tableau
        if (waste.length > 0) {
            const cardId = waste[waste.length - 1];
            const wasteCard = deck[cardId];

            for (let destIdx = 0; destIdx < 7; destIdx++) {
                const destCol = tableau[destIdx];
                if (destCol.length > 0) {
                    const targetCard = deck[destCol[destCol.length - 1]];
                    if (this.isValidTableauBuild(wasteCard, targetCard)) {
                        return {
                            type: 'waste_to_tableau',
                            fromType: 'waste',
                            fromIndex: 0,
                            toType: 'tableau',
                            toIndex: destIdx,
                            cardId: cardId,
                            description: `Move ${this.getCardName(wasteCard)} onto ${this.getCardName(targetCard)}`
                        };
                    }
                }
            }

            if (wasteCard.value === 13) {
                for (let destIdx = 0; destIdx < 7; destIdx++) {
                    if (tableau[destIdx].length === 0) {
                        return {
                            type: 'waste_to_tableau',
                            fromType: 'waste',
                            fromIndex: 0,
                            toType: 'tableau',
                            toIndex: destIdx,
                            cardId: cardId,
                            description: `Move ${this.getCardName(wasteCard)} to empty Column ${destIdx + 1}`
                        };
                    }
                }
            }
        }

        // 5. Priority 5: Tableau to Tableau that empties a column (frees spot for King)
        for (let srcIdx = 0; srcIdx < 7; srcIdx++) {
            const srcCol = tableau[srcIdx];
            if (srcCol.length === 0) continue;

            let firstFaceUpIdx = -1;
            for (let k = 0; k < srcCol.length; k++) {
                if (deck[srcCol[k]].faceUp) {
                    firstFaceUpIdx = k;
                    break;
                }
            }

            if (firstFaceUpIdx === 0) {
                const cardId = srcCol[0];
                const movingCard = deck[cardId];
                if (movingCard.value === 13) continue; // Moving King from empty base is redundant

                for (let destIdx = 0; destIdx < 7; destIdx++) {
                    if (srcIdx === destIdx) continue;
                    const destCol = tableau[destIdx];

                    if (destCol.length > 0) {
                        const targetCard = deck[destCol[destCol.length - 1]];
                        if (this.isValidTableauBuild(movingCard, targetCard)) {
                            return {
                                type: 'tableau_to_tableau',
                                fromType: 'tableau',
                                fromIndex: srcIdx,
                                toType: 'tableau',
                                toIndex: destIdx,
                                cardId: cardId,
                                description: `Move ${this.getCardName(movingCard)} onto ${this.getCardName(targetCard)} to clear Column ${srcIdx + 1}`
                            };
                        }
                    }
                }
            }
        }

        // 6. Priority 6: Draw Card from Stock
        if (stock.length > 0) {
            return {
                type: 'draw_stock',
                fromType: 'stock',
                fromIndex: 0,
                toType: 'waste',
                toIndex: 0,
                description: 'Draw a card from Stock'
            };
        }

        // 7. Priority 7: Recycle Waste to Stock
        if (waste.length > 0) {
            return {
                type: 'recycle_waste',
                fromType: 'waste',
                fromIndex: 0,
                toType: 'stock',
                toIndex: 0,
                description: 'Recycle Waste pile back to Stock'
            };
        }

        return null;
    },

    /**
     * Checks if the game is ready for Auto-Solve.
     * Auto-solve is available when all cards in the tableau are face-up.
     */
    canAutoSolve(state) {
        const { tableau, deck } = state;
        for (let i = 0; i < 7; i++) {
            for (const cardId of tableau[i]) {
                if (!deck[cardId].faceUp) return false;
            }
        }
        return true;
    },

    /**
     * Finds the next single move to perform during Auto-Solve.
     */
    findNextAutoSolveMove(state) {
        const { tableau, foundation, stock, waste, deck } = state;
        const suits = ['H', 'D', 'C', 'S'];

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

        // 3. Try Tableau to Tableau move if it unblocks cards
        for (let i = 0; i < 7; i++) {
            const col = tableau[i];
            if (col.length > 0) {
                const cardId = col[0];
                const card = deck[cardId];
                if (card.value === 13) continue;
                for (let t = 0; t < 7; t++) {
                    if (i === t) continue;
                    const destCol = tableau[t];
                    if (destCol.length > 0) {
                        const targetCard = deck[destCol[destCol.length - 1]];
                        if (this.isValidTableauBuild(card, targetCard)) {
                            return {
                                type: 'tableau_to_tableau',
                                fromIndex: i,
                                toIndex: t,
                                cards: [...col]
                            };
                        }
                    }
                }
            }
        }

        // 4. Draw card or recycle waste
        if (stock.length > 0) {
            return {
                type: 'draw_card'
            };
        } else if (waste.length > 0) {
            return {
                type: 'recycle_waste'
            };
        }

        return null;
    }
};

// Export for use in app.js
window.Solver = Solver;
