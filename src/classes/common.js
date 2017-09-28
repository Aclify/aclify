// @flow
export default class Common {
  prefix: string;

  constructor() {
    this.prefix = 'allows_';
  }

  static makeArray(arr: mixed): Array<any> {
    return Array.isArray(arr) ? arr : [arr];
  }

  allowsBucket(role: string): string {
    return this.prefix + role;
  }

  keyFromAllowsBucket(str: string): string {
    return str.replace(new RegExp(`^${this.prefix}`), '');
  }
}
