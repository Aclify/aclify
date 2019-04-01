// @flow
import _ from 'lodash';
import Store from '../interfaces/store';
import Common from '../classes/common';

export default class MySQL extends Common implements Store {
  buckets: {};

  transaction: Array<any>;

  constructor(db, options) {
    super();
    this.buckets = ['meta', 'parents', 'permissions', 'resources', 'roles', 'users'];
    this.options = _.defaults({}, options, {prefix: ''});
    this.db = this.setup(db, this.options);
  }

  /**
   * @description Begins a transaction.
   * @returns {Array.<any>}
   */
  begin(): Array<any> {
    // Returns a transaction object
    this.transaction = [];
    return this.transaction;
  }

  /**
   * @description Ends a transaction (and executes it).
   * @param cb
   * @returns {*}
   */
  end(cb): any {
    // Execute transaction
    return this.db.Sequelize.Promise.reduce(this.transaction, (res, func) => func(), null)
      .then()
      .nodeify(cb);
  }

  /**
   * @description Cleans the whole storage.
   * @param cb
   * @returns {*}
   */
  clean(cb): any {
    return this.setup().clean(this.db, this.options).nodeify(cb);
  }

  /**
   * @description Gets the contents at the bucket's key.
   * @param bucket
   * @param key
   * @param cb
   * @returns {*}
   */
  get(bucket, key, cb): any {
    return this.findRow(bucket, key)
      .then((row) => {
        if (!row) return [];
        if (bucket.indexOf('allows_') === 0) return MySQL.getPermission(key, row);
        return row.value;
      })
      .nodeify(cb);
  }

  /**
   * @description Returns the union of the values in the given keys.
   * @param bucket
   * @param keys
   * @param cb
   */
  union(bucket, keys, cb): any {
    return this.findRows(bucket, keys)
      .then((rows) => {
        if (bucket.indexOf('allows_') === 0) return MySQL.getPermission(keys, rows);
        return _.union(...rows.map((row) => row.value));
      })
      .nodeify(cb);
  }

  /**
   * @description Adds values to a given key inside a bucket.
   * @param bucket
   * @param key
   * @param values
   */
  add(bucket, key, values) {
    const valuesTmp = Array.isArray(values) ? values : [values];
    let bucketTmp = bucket;
    let keyTmp = key;
    this.transaction.push(() => this.findRow(bucketTmp, keyTmp)
      .then((row) => {
        let update;
        if (bucketTmp.indexOf('allows_') === 0) {
          update = (row && row.value) ? row.value : {};
          update[keyTmp] = _.union(update[keyTmp], valuesTmp);
          keyTmp = bucketTmp;
          bucketTmp = 'permissions';
        } else {
          update = _.union(row && row.value, valuesTmp);
        }
        return this.getModel(bucketTmp).upsert({key: keyTmp, value: JSON.stringify(update)});
      }));
  }

  /**
   * @description Delete the given key(s) at the bucket
   * @param bucket
   * @param keys
   */
  del(bucket, keys) {
    const keysTmp = Array.isArray(keys) ? keys : [keys];

    this.transaction.push(() => {
      if (bucket.indexOf('allows_') === 0) {
        return this.findRow(bucket)
          .then((row) => {
            if (!row) return;
            const update = row.value;
            keysTmp.forEach((key) => {
              update[key] = undefined;
            });
            row.set('value', JSON.stringify(update)).save();
          });
      }
      return this.getModel(bucket)
        .destroy({where: {key: {$in: keysTmp}}});
    });
  }

  /**
   * @description Removes values from a given key inside a bucket.
   * @param bucket
   * @param key
   * @param values
   */
  remove(bucket, key, values) {
    const valuesTmp = Array.isArray(values) ? values : [values];

    this.transaction.push(() => this.findRow(bucket, key)
      .then((row) => {
        let update;
        if (!row) return;
        if (bucket.indexOf('allows_') === 0) {
          update = row.value;
          update[key] = _.difference(update[key], valuesTmp);
        } else {
          update = _.difference(row.value, valuesTmp);
        }
        const rowTmp = row;
        rowTmp.value = JSON.stringify(update);
        rowTmp.save();
      }));
  }

  /**
   * @description Setup database.
   * @param db
   * @param options
   * @returns {*}
   */
  setup(db, options): {} {
    const {prefix} = options;
    const schema = options.schema || {};
    const defaultSchema = options.defaultSchema || {
      key: {type: db.Sequelize.STRING, primaryKey: true},
      value: {type: db.Sequelize.STRING(1000)},
    };

    this.buckets.forEach((table) => {
      const name = prefix + table;
      if (!db.models[name]) db.define(name, schema[table] || defaultSchema).sync();
    });
    return db;
  }

  /**
   * @description Returns model for bucket.
   * @param bucket
   * @returns {*}
   */
  getModel(bucket): {} {
    return this.db.models[this.options.prefix + bucket];
  }

  /**
   * @description Find the row for specific bucket.
   * @param bucket
   * @param key
   * @returns {Promise}
   */
  findRow(bucket, key): {} {
    let bucketTmp = bucket;
    let keyTmp = key;
    let perm = false;

    if (bucketTmp.indexOf('allows_') === 0) {
      keyTmp = bucketTmp;
      bucketTmp = 'permissions';
      perm = true;
    }

    return this.getModel(bucketTmp)
      .findOne({where: {key: keyTmp.toString()}, attributes: ['key', 'value']})
      .then((row) => {
        if (!row) return null;
        const rowTmp = row;

        if (row.value && JSON.parse(row.value)) {
          rowTmp.value = JSON.parse(row.value);
        } else {
          rowTmp.value = perm ? {} : [];
        }
        return rowTmp;
      });
  }

  /**
   * @description Find the row for specific bucket.
   * @param bucket
   * @param keys
   * @returns {Promise}
   */
  findRows(bucket, keys): Array<any> {
    if (bucket.indexOf('allows_') === 0) return this.findRow(bucket);
    return this.getModel(bucket)
      .findAll({where: {key: {$in: keys.map((key) => key.toString())}}, attributes: ['key', 'value']})
      .then((rows) => rows.map((row) => {
        const rowTmp = row;
        if (row.value && JSON.parse(row.value)) {
          rowTmp.value = JSON.parse(row.value);
        } else {
          rowTmp.value = [];
        }
        return row;
      }));
  }

  /**
   * @description Returns values for permissions bucket
   * @param keys
   * @param row
   * @returns {*}
   */
  static getPermission(keys, row): Array<any> {
    const res = (row && row.value) ? row.value : {};
    const keysTmp = Array.isArray(keys) ? keys : [keys];
    return _.union(...keysTmp.map((key) => res[key] || []));
  }
}
