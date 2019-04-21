import { defaults, union, difference } from 'lodash';
import { IStore } from '..';
import * as Sequelize from 'sequelize';

/**
 * {@inheritDoc}
 * @description Sequelize store.
 */
export class SequelizeStore implements IStore {
  private buckets: string[];
  private db: Sequelize.Sequelize;
  private transaction: [];
  private readonly options: { prefix: string };

  constructor(db: Sequelize.Sequelize, options) {
    this.buckets = ['meta', 'parents', 'permissions', 'resources', 'roles', 'users'];
    this.options = defaults({}, options, {prefix: ''});
    this.db = this.setup(db, this.options);
  }

  /**
   * @description Begins a transaction.
   * @return void
   */
  public begin(): void {
    this.transaction = [];
  }

  /**
   * @description Ends a transaction (and executes it).
   * @return Promise<void>
   */
  public async end(): Promise<void> {
    // @ts-ignore
    // await this.db.Sequelize.Promise.reduce(this.transaction, (res, func) => func(), null);


    await Promise.all(this.transaction.map(async (fn: Function | Promise<void>) => {
      return fn instanceof Promise ? fn.then(() => Promise.resolve()) : fn()
    }));
  }

  /**
   * @description Cleans the whole storage.
   * @return Promise<void>
   */
  public async clean(): Promise<void> {
    return this.setup(this.db, this.options).clean(this.db, this.options);
  }

  /**
   * @description Gets the contents at the bucket's key.
   * @param bucket
   * @param key
   * @return Promise<string[]>
   */
  public async get(bucket: string, key: string | number): Promise<string[]> {
    const row = await this.findRow(bucket, key);
    if (!row) {
      return [];
    }

    if (bucket.indexOf('allows_') === 0) {
      // @ts-ignore
      return SequelizeStore.getPermission(key, row);
    }

    return row.value;
  }

  /**
   * @description Returns the union of the values in the given keys.
   * @param bucket
   * @param keys
   * @return Promise<string[]>
   */
  public async union(bucket: string, keys: string[]): Promise<string[]> {
    const rows = await this.findRows(bucket, keys);
    if (bucket.indexOf('allows_') === 0) {
      // @ts-ignore
      return SequelizeStore.getPermission(keys, rows);
    }

    return union(...rows.map((row) => row.value));
  }

  /**
   * @description Adds values to a given key inside a bucket.
   * @param bucket
   * @param key
   * @param values
   * @return void
   */
  public add(bucket: string, key: string | number, values: number | number[] | string | string[]): void {
    const valuesTmp = Array.isArray(values) ? values : [values];
    let bucketTmp = bucket;
    let keyTmp = key;
    // @ts-ignore
    this.transaction.push(async () => {
      const row = await this.findRow(bucketTmp, keyTmp);
      let update;
      if (bucketTmp.indexOf('allows_') === 0) {
        update = (row && row.value) ? row.value : {};
        update[keyTmp] = union(update[keyTmp], valuesTmp);
        keyTmp = bucketTmp;
        bucketTmp = 'permissions';
      } else {
        update = union(row && row.value, valuesTmp);
      }
      // @ts-ignore
      await this.getModel(bucketTmp).upsert({key: keyTmp, value: JSON.stringify(update)});
    });
  }

  /**
   * @description Delete the given key(s) at the bucket
   * @param bucket
   * @param keys
   * @return Promise<void>
   */
  public async del(bucket: string, keys: string | string[]): Promise<void> {
    const keysTmp = Array.isArray(keys) ? keys : [keys];

    // @ts-ignore
    this.transaction.push(async () => {
      if (bucket.indexOf('allows_') === 0) {
        // @ts-ignore
        const row = await this.findRow(bucket);
        if (!row) return;
        const update = row.value;
        keysTmp.forEach((key) => {
          update[key] = undefined;
        });
        row.set('value', JSON.stringify(update)).save();
      }

      await this.getModel(bucket)
      // @ts-ignore
        .destroy({where: {key: {[this.db.Sequelize.Op.in]: keysTmp}}});
    });
  }

  /**
   * @description Removes values from a given key inside a bucket.
   * @param bucket
   * @param key
   * @param values
   * @return Promise<void>
   */
  public async remove(bucket: string, key: string | number, values: number | number[] | string | string[]): Promise<void> {
    const valuesTmp = Array.isArray(values) ? values : [values];

    // @ts-ignore
    this.transaction.push(async () => {
      const row = await this.findRow(bucket, key);
      let update;
      if (!row) return;
      if (bucket.indexOf('allows_') === 0) {
        update = row.value;
        update[key] = difference(update[key], valuesTmp);
      } else {
        update = difference(row.value, valuesTmp);
      }
      const rowTmp = row;
      rowTmp.value = JSON.stringify(update);
      await rowTmp.save();
    });
  }

  /**
   * @description Closes store connection.
   * @return Promise<void>
   */
  async close(): Promise<void> {
    await this.db.close();
  }

  setup(db, options) {
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

  getModel(bucket) {
    return this.db.models[this.options.prefix + bucket];
  }

  findRow(bucket, key) {
    let bucketTmp = bucket;
    let keyTmp = key;
    let perm = false;

    if (bucketTmp.indexOf('allows_') === 0) {
      keyTmp = bucketTmp;
      bucketTmp = 'permissions';
      perm = true;
    }

    // @ts-ignore
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

  findRows(bucket, keys) {
    if (bucket.indexOf('allows_') === 0) {
      // @ts-ignore
      return this.findRow(bucket);
    }
    // @ts-ignore
    return this.getModel(bucket)
      .findAll({
        where: {
          key: {
            // @ts-ignore
            [this.db.Sequelize.Op.in]: keys.map((key) => key.toString()),
          },
        },
        attributes: ['key', 'value'],
      })
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

  static getPermission(keys, row) {
    const res = (row && row.value) ? row.value : {};
    const keysTmp = Array.isArray(keys) ? keys : [keys];
    return union(...keysTmp.map((key) => res[key] || []));
  }
}
