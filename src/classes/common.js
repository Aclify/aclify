// @flow

export default class Common {

  allowPrefix: string;

  makeArray(arr: mixed) {
    return Array.isArray(arr) ? arr : [arr];
  }

  allowsBucket(role: string) {
    return this.allowPrefix + role;
  }

  keyFromAllowsBucket(str: string) {
    return str.replace(`/^${this.allowPrefix}/`, '');
  }
}
