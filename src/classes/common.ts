/**
 * @description Common.
 */
export class Common {
  prefix: string;

  constructor() {
    this.prefix = 'allows_';
  }

  /**
   * @description Returns an array.
   * @param value
   * @return string
   */
  static makeArray(value: string | string[]): string[] {
    return Array.isArray(value) ? value : [value];
  }

  allowsBucket(role: string): string {
    return this.prefix + role;
  }

  keyFromAllowsBucket(str: string): string {
    return str.replace(new RegExp(`^${this.prefix}`), '');
  }
}
