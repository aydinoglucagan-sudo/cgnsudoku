/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Grid = (number | null)[][];

const SIZE = 6;
const BOX_WIDTH = 3;
const BOX_HEIGHT = 2;

export function isValid(grid: Grid, row: number, col: number, num: number): boolean {
  // Check row
  for (let x = 0; x < SIZE; x++) {
    if (grid[row][x] === num) return false;
  }

  // Check column
  for (let x = 0; x < SIZE; x++) {
    if (grid[x][col] === num) return false;
  }

  // Check box
  const startRow = row - (row % BOX_HEIGHT);
  const startCol = col - (col % BOX_WIDTH);
  for (let i = 0; i < BOX_HEIGHT; i++) {
    for (let j = 0; j < BOX_WIDTH; j++) {
      if (grid[i + startRow][j + startCol] === num) return false;
    }
  }

  return true;
}

export function solve(grid: Grid): boolean {
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (grid[row][col] === null) {
        for (let num = 1; num <= SIZE; num++) {
          if (isValid(grid, row, col, num)) {
            grid[row][col] = num;
            if (solve(grid)) return true;
            grid[row][col] = null;
          }
        }
        return false;
      }
    }
  }
  return true;
}

export function generateSudoku(difficulty: number = 20): { initial: Grid; solved: Grid } {
  const solvedGrid: Grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  
  // Fill the grid with a valid solution
  const fillGrid = (row: number, col: number): boolean => {
    if (row === SIZE) return true;
    if (col === SIZE) return fillGrid(row + 1, 0);

    const nums = [1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5);
    for (const num of nums) {
      if (isValid(solvedGrid, row, col, num)) {
        solvedGrid[row][col] = num;
        if (fillGrid(row, col + 1)) return true;
        solvedGrid[row][col] = null;
      }
    }
    return false;
  };

  fillGrid(0, 0);

  // Copy solved grid
  const initialGrid: Grid = solvedGrid.map(row => [...row]);

  // Remove numbers
  let attempts = difficulty;
  while (attempts > 0) {
    const row = Math.floor(Math.random() * SIZE);
    const col = Math.floor(Math.random() * SIZE);
    if (initialGrid[row][col] !== null) {
      initialGrid[row][col] = null;
      attempts--;
    }
  }

  return { 
    initial: initialGrid, 
    solved: solvedGrid.map(row => [...row]) 
  };
}

export function isWin(grid: Grid, solved: Grid): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] !== solved[r][c]) return false;
    }
  }
  return true;
}
