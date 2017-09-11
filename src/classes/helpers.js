// @flow

export class Helpers {

  static makeArray(arr){
    return Array.isArray(arr) ? arr : [arr];
  }

  static allowsBucket(role){
    return 'allows_'+role;
  }

  static keyFromAllowsBucket(str) {
    return str.replace(/^allows_/, '');
  }
}
