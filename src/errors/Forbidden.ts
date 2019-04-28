/**
 * {@inheritDoc}
 * @description Forbidden class.
 */
export class Forbidden extends Error {

  /**
   * @description Pass message to Error class.
   * @param message
   */
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, Forbidden.prototype);
  }
}
