const noop = {};
import util from 'util';
import _ from 'lodash';

noop.params = function(){
  return this;
};
noop.end = () => {};

class contract {
  constructor(args) {
    if(contract.debug===true){
      contract.fulfilled = false;
      contract.args = _.toArray(args);
      contract.checkedParams = [];
      return contract;
    }else{
      return noop;
    }
  }

  static params() {
    let i;
    let len;
    this.fulfilled |= checkParams(this.args, _.toArray(arguments));
    if(this.fulfilled){
      return noop;
    }else{
      this.checkedParams.push(arguments);
      return this;
    }
  }

  static end() {
    if(!this.fulfilled){
      printParamsError(this.args, this.checkedParams);
      throw new Error('Broke parameter contract');
    }
  }
}

const typeOf = obj => Array.isArray(obj) ? 'array':typeof obj;

var checkParams = (args, contract) => {
  let fulfilled;
  let types;
  let type;
  let i;
  let j;

  if(args.length !== contract.length){
    return false;
  }else{
    for(i=0; i<args.length; i++){
      try{
        types = contract[i].split('|');
      }catch(e){
        console.log(e, args)
      }
      if (args[i]) {
        type = typeOf(args[i]);
        fulfilled = false;
        for(j=0; j<types.length; j++){
          if (type === types[j]){
            fulfilled = true;
            break;
          }
        }
      }
      if(fulfilled===false){
        return false;
      }
    }
    return true;
  }
};

var printParamsError = (args, checkedParams) => {
  let msg = 'Parameter mismatch.\nInput:\n( ';
  let type;
  let input;
  let i;
  _.each(args, (input, key) => {
    type = typeOf(input);
    if(key != 0){
      msg += ', '
    }
    msg += `${input}: ${type}`;
  })

  msg += ')\nAccepted:\n';

  for (i=0; i<checkedParams.length;i++){
    msg += `(${argsToString(checkedParams[i])})\n`;
  }

  console.log(msg);
};

var argsToString = args => {
  let res = "";
  _.each(args, (arg, key) => {
    if(key != 0){
      res += ', ';
    }
    res += arg;
  })
  return res;
}

exports = module.exports = contract;
