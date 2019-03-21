/**
 * @description Common.
 */
export class Common {
  public prefix: string;

  constructor() {
    this.prefix = 'allows_';
  }

  /**
   * @description Returns an array.
   * @param value
   * @return string
   */
  public static makeArray(value: string | string[]): string[] {
    return Array.isArray(value) ? value : [value];
  }

  public allowsBucket(role: string): string {
    return this.prefix + role;
  }

  public keyFromAllowsBucket(str: string): string {
    return str.replace(new RegExp(`^${this.prefix}`), '');
  }
}
