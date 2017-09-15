// @flow
export default class Common {
  allowPrefix: string;

  constructor() {
    this.allowPrefix = 'allows_';
  }

  makeArray(arr: mixed): Array<any> {
    return Array.isArray(arr) ? arr : [arr];
  }

  allowsBucket(role: string) {
    return this.allowPrefix + role;
  }

  keyFromAllowsBucket(str: string) {
    return str.replace(`/^${this.allowPrefix}/`, '');
  }
}
