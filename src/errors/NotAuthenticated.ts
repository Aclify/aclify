/**
 * {@inheritDoc}
 * @description NotAuthenticated class.
 */
export class NotAuthenticated extends Error {

  /**
   * @description Pass message to Error class.
   * @param message
   */
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, NotAuthenticated.prototype);
  }
}
