import { ZodError } from 'zod';
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown, operation: string) {
  const known = error instanceof AppError || error instanceof ZodError;
  const status = error instanceof AppError ? error.status : error instanceof ZodError ? 400 : 500;
  console.error(
    JSON.stringify({
      operation,
      status,
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }),
  );
  return {
    status,
    body: {
      error: {
        message: known
          ? error instanceof ZodError
            ? 'Please check the supplied fields.'
            : error.message
          : 'Something went wrong. Please retry.',
        code: status,
      },
    },
  };
}
