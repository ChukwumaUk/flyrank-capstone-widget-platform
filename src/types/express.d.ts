// Tell TypeScript that Express's Request may carry a `user`,
// attached by our auth middleware after verifying the token.
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email?: string };
    }
  }
}

export {};