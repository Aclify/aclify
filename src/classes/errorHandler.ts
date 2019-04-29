import { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { HttpError } from './httpError';

/**
 * @description Error handler for the Express middleware.
 * @param contentType (html|json) defaults to plain text.
 * @returns {function(*=, *, *, *)}
 */
export function errorHandler(contentType: string): ErrorRequestHandler {
  let method = 'end';

  if (contentType === 'json') {
    method = 'json';
  }

  if (contentType === 'html') {
    method = 'send';
  }

  return (err: HttpError, _req: Request, res: Response, next: NextFunction): void | Response => { // tslint:disable-line variable-name
    if (err.name !== 'HttpError' || err.errorCode === undefined) {
      return next(err);
    }

    return res.status(err.errorCode)[method](err.message); // tslint:disable-line no-unsafe-any
  };
}
