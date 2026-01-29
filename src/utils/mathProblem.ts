import type { MathProblem } from '../types';

/**
 * Generates a random math problem for the math dismissal challenge.
 * Creates problems with addition, subtraction, or multiplication operations.
 * 
 * @returns A MathProblem object with question string and numeric answer
 */
export function generateMathProblem(): MathProblem {
  const operations = ['+', '-', '*'];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  let a: number, b: number, answer: number;

  switch (operation) {
    case '+':
      a = Math.floor(Math.random() * 50) + 10;
      b = Math.floor(Math.random() * 50) + 10;
      answer = a + b;
      break;
    case '-':
      a = Math.floor(Math.random() * 50) + 30;
      b = Math.floor(Math.random() * 30) + 1;
      answer = a - b;
      break;
    case '*':
      a = Math.floor(Math.random() * 12) + 2;
      b = Math.floor(Math.random() * 12) + 2;
      answer = a * b;
      break;
    default:
      a = 10;
      b = 10;
      answer = 20;
  }

  return {
    question: `${a} ${operation} ${b}`,
    answer,
  };
}
