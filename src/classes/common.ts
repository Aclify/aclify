/**
 * {@inheritDoc}
 * @description Common class.
 */
export class Common {
  public prefix: string;

  constructor() {
    this.prefix = 'allows_';
  }

  /**
   * @description Returns an array.
   * @param value
   * @return string[]
   */
  public static MAKE_ARRAY(value: string | string[]): string[] {
    return Array.isArray(value) ? value : [value];
  }

  /**
   * @description Returns prefixed bucket name.
   * @param role
   * @return string
   */
  public allowsBucket(role: string): string {
    return this.prefix + role;
  }

  /**
   * @description Returns key without prefix.
   * @param str
   * @return string
   */
  public keyFromAllowsBucket(str: string): string {
    return str.replace(new RegExp(`^${this.prefix}`), '');
  }
}
