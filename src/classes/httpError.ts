/**
 * {@inheritDoc}
 * @description HttpError class.
 */
export class HttpError {
  // @ts-ignore
  private name: string;
  // @ts-ignore
  private message: string;
  // @ts-ignore
  private errorCode: number;

  /**
   * @description Constructor.
   * @param code
   * @param message
   */
  constructor(code:number, message: string) {
    this.errorCode = code;
    this.message = message;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, Error.prototype);
  }
}
