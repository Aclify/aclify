import _ from 'lodash'

const noop = {
  params: () => this,
  end: () => {
  }
}

export class Contract {

  constructor(args) {
    if (Contract.debug === true) {
      Contract.fulfilled = false
      Contract.args = _.toArray(args)
      Contract.checkedParams = []
      return Contract
    }
    return noop
  }

  /**
   * @description Set parameters Contract
   * @param arguments
   * @return {*}
   */
  static params() {
    this.fulfilled |= this._checkParameters(this.args, _.toArray(arguments))
    if (this.fulfilled) return noop

    this.checkedParams.push(arguments)
    return this
  }

  /**
   * @description Validate data
   */
  static end() {
    if (!this.fulfilled) {
      this._printParametersError(this.args, this.checkedParams)
      throw new Error('Broke parameter Contract')
    }
  }

  /**
   * @description Return type of object
   * @param obj
   * @return {string}
   * @private
   */
  _typeOf(obj) {
    return Array.isArray(obj) ? 'array' : typeof obj
  }

  /**
   * @description Check parameters
   * @param args
   * @param Contract
   * @return {boolean}
   * @private
   */
  _checkParameters(args, Contract) {
    let fulfilled, types, type

    if (args.length !== Contract.length) return false

    for (let i = 0; i < args.length; i++) {
      try {
        types = Contract[i].split('|')
      } catch (e) {
        console.error(e, args)
      }

      if (args[i]) {
        type = this._typeOf(args[i])
        fulfilled = false
        for (let j = 0; j < types.length; j++) {
          if (type === types[j]) {
            fulfilled = true
            break
          }
        }
      }

      if (fulfilled === false) return false
    }
    return true
  }

  /**
   * @description Print parameter errors
   * @param args
   * @param checkedParams
   * @private
   */
  _printParametersError(args, checkedParams) {
    let msg = 'Parameter mismatch.\nInput:\n( '
    let type
    _.each(args, (input, key) => {
      type = this._typeOf(input)
      if (key !== 0) msg += ', '
      msg += `${input}: ${type}`
    })

    msg += ')\nAccepted:\n'

    for (let i = 0; i < checkedParams.length; i++) {
      msg += `(${this._argsToString(checkedParams[i])})\n`
    }
    console.error(msg)
  }

  /**
   * @description Convert arguments to string
   * @param args
   * @return {string}
   * @private
   */
  _argsToString(args) {
    let res = ""
    _.each(args, (arg, key) => {
      if (key !== 0) res += ', '
      res += arg
    })
    return res
  }
}
