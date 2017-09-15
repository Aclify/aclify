// @flow
export default class Common {
  makeArray(arr: mixed): Array<any> {
    return Array.isArray(arr) ? arr : [arr];
  }

  allowsBucket(role: string): string {
    return 'allows_' + role;
  }

  keyFromAllowsBucket(str: string): string {
    return str.replace(/^allows_/, '');
  }
}
