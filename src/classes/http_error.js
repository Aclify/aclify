// @flow
export default class HttpError {
  constructor(code, message) {
    this.errorCode = code;
    this.message = message;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, Error.prototype);
  }
}
